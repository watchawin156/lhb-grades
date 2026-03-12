const fs = require('fs');
const path = require('path');

const csvPath = 'c:\\Users\\pc wind\\Documents\\ระบบจัดการคะแนนนักเรียน\\public\\บันทึกคะแนน_ปพ.1_ชั้น_ป.6_ห้อง_1.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split('\n');
const header = lines[0].split(',');

const subjects = [];

let currentYear = '';
let currentClass = '';

for (let i = 0; i < header.length; i++) {
    const col = header[i].trim();
    if (!col || col === '#') continue;

    const yearMatch = col.match(/^(\d{4})\s+(ชั้นประถมศึกษาปีที่\s+\d+)$/);
    if (yearMatch) {
        currentYear = yearMatch[1];
        currentClass = yearMatch[2];
        const classNum = currentClass.match(/\d+/)[0];
        currentClass = `ป.${classNum}`;
        continue;
    }

    const subjectMatch = col.match(/^([ก-ฮA-Z\d]{5,6})\s+(.+)$/);
    if (subjectMatch && currentYear) {
        subjects.push({
            code: subjectMatch[1],
            name: subjectMatch[2],
            year: currentYear,
            class_level: currentClass
        });
    }
}

let sql = 'DELETE FROM subjects;\n'; 
subjects.forEach(s => {
    const escapedName = s.name.replace(/'/g, "''");
    sql += `INSERT OR IGNORE INTO subjects (id, code, name, type, credit, maxScore, semester, class_level, year) VALUES ('${s.code}-${s.year}', '${s.code}', '${escapedName}', 'พื้นฐาน', 1, 100, 1, '${s.class_level}', ${s.year});\n`;
});

fs.writeFileSync('import_subjects.sql', sql);
console.log('SQL generated with class_level and year, and saved to import_subjects.sql');
