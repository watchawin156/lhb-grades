const fs = require('fs');
const path = require('path');

const catalogPath = 'C:\\Users\\pc wind\\.gemini\\antigravity\\brain\\b00a7cd7-7856-4f6e-a3af-12fa70fa05be\\subject_catalog.md';
const content = fs.readFileSync(catalogPath, 'utf8');

const subjects = [];
let currentClass = '';

const lines = content.split('\n');
lines.forEach(line => {
    // หาชั้นเรียน
    const classMatch = line.match(/^## ระดับชั้นประถมศึกษาปีที่ (\d+)/);
    if (classMatch) {
        currentClass = `ป.${classMatch[1]}`;
    }

    // หาวิชาในตาราง
    const subjectMatch = line.match(/^\| ([ก-ฮA-Z\d]+) \| ([^|]+) \| ([^|]+) \| (\d+) \|/);
    if (subjectMatch && currentClass) {
        subjects.push({
            code: subjectMatch[1].trim(),
            name: subjectMatch[2].trim(),
            type: subjectMatch[3].trim(),
            hours: parseInt(subjectMatch[4].trim()),
            class_level: currentClass
        });
    }
});

let sql = 'DELETE FROM subjects;\n';
subjects.forEach(s => {
    const escapedName = s.name.replace(/'/g, "''");
    const id = `${s.code}-${s.class_level}`;
    // year = NULL เพื่อใช้เป็น Template สากล
    sql += `INSERT INTO subjects (id, code, name, type, maxScore, semester, class_level, year) VALUES ('${id}', '${s.code}', '${escapedName}', '${s.type}', 100, 1, '${s.class_level}', NULL);\n`;
});

fs.writeFileSync('import_catalog_final.sql', sql);
console.log(`Successfully prepared ${subjects.length} subjects from catalog for D1 import.`);
