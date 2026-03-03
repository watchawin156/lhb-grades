import { getCloudflareContext } from "@cloudflare/next-on-pages";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export async function GET() {
    try {
        const { env } = await getCloudflareContext();
        const db = (env as any).DB;
        if (!db) {
            return Response.json({ error: "DB binding not found" }, { status: 500 });
        }

        const [students, subjects, scores] = await Promise.all([
            db.prepare("SELECT * FROM students").all(),
            db.prepare("SELECT * FROM subjects").all(),
            db.prepare("SELECT * FROM scores").all()
        ]);

        return Response.json({
            students: students.results,
            subjects: subjects.results,
            scores: scores.results
        });
    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();
        const db = (env as any).DB;
        if (!db) {
            return Response.json({ error: "DB binding not found" }, { status: 500 });
        }

        const { students = [], subjects = [], scores = [] } = await request.json();

        // Use Batch for performance
        const queries: any[] = [];

        // Simple strategy: Clear and Replace (Since user said "upload all to D1")
        // Note: In real app, we'd do UPSERTs, but for migration/sync from local, this is easier.

        // 1. Students
        queries.push(db.prepare("DELETE FROM students"));
        students.forEach((s: any) => {
            queries.push(db.prepare("INSERT INTO students (id, studentId, name, room, number) VALUES (?, ?, ?, ?, ?)")
                .bind(s.id, s.studentId, s.name, s.room, s.number || null));
        });

        // 2. Subjects
        queries.push(db.prepare("DELETE FROM subjects"));
        subjects.forEach((s: any) => {
            queries.push(db.prepare("INSERT INTO subjects (id, code, name, maxScore, semester, type, credit) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(s.id, s.code, s.name, s.maxScore, s.semester, s.type || 'พื้นฐาน', s.credit || 1));
        });

        // 3. Scores
        queries.push(db.prepare("DELETE FROM scores"));
        scores.forEach((s: any) => {
            queries.push(db.prepare("INSERT INTO scores (student_internal_id, subject_internal_id, score, academic_year, semester) VALUES (?, ?, ?, ?, ?)")
                .bind(s.studentId, s.subjectId, s.score, s.year, s.semester || 1));
        });

        await db.batch(queries);

        return Response.json({ success: true });
    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
