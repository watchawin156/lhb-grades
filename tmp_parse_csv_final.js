const fs = require('fs');
const path = require('path');

const csvPath = 'c:\\Users\\pc wind\\Documents\\ระบบจัดการคะแนนนักเรียน\\public\\บันทึกคะแนน_ปพ.1_ชั้น_ป.6_ห้อง_1.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split('\n');
const header = lines[0].split(',');

const subjects = [];

// กฎการแมปจากรหัสวิชา (ตัวเลขหลักที่ 2) ตามที่ผู้ใช้ระบุ
const getGradeFromCode = (code) => {
    const match = code.match(/[A-Zก-ฮ](\d{5,6})/);
    if (match) {
        const numPart = match[1];
        const gradeDigit = numPart[1]; // หลักที่ 2
        return `ป.${gradeDigit}`;
    }
    return null;
};

for (let i = 0; i < header.length; i++) {
    const col = header[i].trim();
    if (!col || col === '#') continue;

    // ค้นหารหัสวิชาและชื่อ (เช่น "ท11101 ภาษาไทย 1")
    const subjectMatch = col.match(/^([ก-ฮA-Z\d]{5,6})\s+(.+)$/);
    if (subjectMatch) {
        const code = subjectMatch[1];
        const name = subjectMatch[2];
        const classLevel = getGradeFromCode(code);

        if (classLevel) {
            subjects.push({
                code: code,
                name: name,
                class_level: classLevel
            });
        }
    }
}

// ล้างวิชาที่ซ้ำ (กรณีมีวิชาเดียวกันปรากฏในหลายปี/หลายที่)
const uniqueSubjects = [];
const seenKey = new Set();
subjects.forEach(s => {
    const key = `${s.code}-${s.class_level}`;
    if (!seenKey.has(key)) {
        seenKey.add(key);
        uniqueSubjects.push(s);
    }
});

let sql = 'DELETE FROM subjects;\n'; 
uniqueSubjects.forEach(s => {
    const escapedName = s.name.replace(/'/g, "''");
    // year = NULL หมายถึงวิชามาตรฐาน (Template)
    sql += `INSERT OR IGNORE INTO subjects (id, code, name, type, credit, maxScore, semester, class_level, year) VALUES ('${s.code}-${s.class_level}', '${s.code}', '${escapedName}', 'พื้นฐาน', 1, 100, 1, '${s.class_level}', NULL);\n`;
});

fs.writeFileSync('import_subjects_final.sql', sql);
console.log(`Successfully generated ${uniqueSubjects.length} subjects mapping by codes.`);
