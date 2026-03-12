export const onRequest: PagesFunction<{ DB: D1Database; STUDENTS_DB: D1Database }> = async (context) => {
    const { env, request } = context;
    const db = env.DB;
    const sdb = env.STUDENTS_DB;

    if (!db || !sdb) {
        return Response.json({ error: "One or more D1 bindings not found" }, { status: 500 });
    }

    if (request.method === "GET") {
        try {
            const url = new URL(request.url);
            const filterGrade = url.searchParams.get('grade');
            const filterYear = url.searchParams.get('year');

            let studentsQuery = "SELECT * FROM students";
            const params: any[] = [];
            if (filterGrade || filterYear) {
                studentsQuery += " WHERE ";
                const conditions = [];
                if (filterGrade) {
                    conditions.push("grade LIKE ?");
                    params.push(`%${filterGrade}%`);
                }
                if (filterYear) {
                    conditions.push("academicYear = ?");
                    params.push(filterYear);
                }
                studentsQuery += conditions.join(" AND ");
            }

            // Subjects Query: ดึงวิชาที่เป็น Template ของชั้นนั้น (year IS NULL)
            let subjectsQuery = "SELECT * FROM subjects";
            const subParams: any[] = [];
            if (filterGrade) {
                subjectsQuery += " WHERE class_level = ? AND (year = ? OR year IS NULL)";
                subParams.push(filterGrade, Number(filterYear) || 0);
            }

            const [stdRes, subRes, scoRes] = await Promise.all([
                sdb.prepare(studentsQuery).bind(...params).all(),
                db.prepare(subjectsQuery).bind(...subParams).all(),
                db.prepare("SELECT * FROM scores").all()
            ]);

            // Map STUDENTS_DB (lhb-students) schema to Frontend Student format 
            const students = (stdRes.results as any[]).map(s => ({
                id: s.id,
                code: s.studentId || '',
                name: `${s.prefix || ''}${s.firstName || ''} ${s.lastName || ''}`.trim(),
                class: s.grade || '',
                room: s.room || '',
                number: s.number || '',
                year: Number(s.academicYear) || 2568,
                status: s.status || 'ปกติ'
            }));

            // Robust Sorting in JavaScript instead of SQL to avoid missing column issues
            students.sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year; // Year DESC
                const gradeA = a.class || '';
                const gradeB = b.class || '';
                if (gradeA !== gradeB) return gradeA.localeCompare(gradeB); // Grade ASC
                const numA = parseInt(a.number) || 999;
                const numB = parseInt(b.number) || 999;
                return numA - numB; // Number ASC
            });

            const d1Scores = scoRes.results as any[];
            const scoreMap: Record<string, any> = {};
            d1Scores.forEach(s => {
                const key = `${s.student_internal_id}-${s.subject_internal_id}-${s.academic_year}`;
                if (!scoreMap[key]) {
                    scoreMap[key] = {
                        studentId: s.student_internal_id,
                        subjectId: s.subject_internal_id,
                        score1: 0,
                        score2: 0,
                        year: s.academic_year
                    };
                }
                if (s.semester === 1) scoreMap[key].score1 = s.score;
                if (s.semester === 2) scoreMap[key].score2 = s.score;
            });

            return Response.json({
                students,
                subjects: subRes.results,
                scores: Object.values(scoreMap)
            });
        } catch (error: any) {
            return Response.json({ error: error.message }, { status: 500 });
        }
    }

    if (request.method === "POST") {
        try {
            const { students = [], subjects = [], scores = [] } = await request.json() as any;
            const gradeQueries: any[] = [];
            const studentQueries: any[] = [];

            // 1. Students -> lhb-students-db (STUDENTS_DB)
            // Note: We use INSERT OR REPLACE instead of DELETE to avoid wiping other apps' data
            students.forEach((s: any) => {
                const fullName = (s.name || '').trim();
                const parts = fullName.split(' ');
                const firstName = parts[0] || '';
                const lastName = parts.slice(1).join(' ') || '';

                studentQueries.push(sdb.prepare(`
                    INSERT OR REPLACE INTO students 
                    (id, studentId, firstName, lastName, grade, room, number, academicYear, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(s.id, s.code, firstName, lastName, s.class, s.room || null, s.number || null, s.year.toString(), s.status || 'ปกติ'));
            });

            // 2. Subjects -> lhb-grades-db (DB)
            // ใช้ INSERT OR REPLACE แทน DELETE ทั้งหมด เพื่อป้องกันวิชา Template หายจากฐานข้อมูล
            subjects.forEach((s: any) => {
                gradeQueries.push(db.prepare("INSERT OR REPLACE INTO subjects (id, code, name, maxScore, semester, type, credit, class_level, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
                    .bind(s.id, s.code, s.name, s.maxScore, s.semester, s.type || 'พื้นฐาน', s.credit || 1, s.class_level, s.year));
            });

            // 3. Scores -> lhb-grades-db (DB)
            gradeQueries.push(db.prepare("DELETE FROM scores"));
            scores.forEach((s: any) => {
                if (s.score1 !== undefined) {
                    gradeQueries.push(db.prepare("INSERT INTO scores (student_internal_id, subject_internal_id, score, academic_year, semester) VALUES (?, ?, ?, ?, ?)")
                        .bind(s.studentId, s.subjectId, s.score1, Number(s.year), 1));
                }
                if (s.score2 !== undefined) {
                    gradeQueries.push(db.prepare("INSERT INTO scores (student_internal_id, subject_internal_id, score, academic_year, semester) VALUES (?, ?, ?, ?, ?)")
                        .bind(s.studentId, s.subjectId, s.score2, Number(s.year), 2));
                }
            });

            // Execute in separate batches for separate databases
            await Promise.all([
                sdb.batch(studentQueries),
                db.batch(gradeQueries)
            ]);

            return Response.json({ success: true });
        } catch (error: any) {
            console.error("D1 Batch Error:", error);
            return Response.json({ error: error.message }, { status: 500 });
        }
    }

    return Response.json({ error: "Method Not Allowed" }, { status: 405 });
};
