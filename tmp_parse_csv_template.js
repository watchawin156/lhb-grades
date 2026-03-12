const fs = require('fs');
const path = require('path');

const csvPath = 'c:\\Users\\pc wind\\Documents\\ระบบจัดการคะแนนนักเรียน\\public\\บันทึกคะแนน_ปพ.1_ชั้น_ป.6_ห้อง_1.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split('\n');
const header = lines[0].split(',');

const subjects = [];

// เราจะเก็บเฉพาะวิชามาตรฐานแยกตามระดับชั้น โดยไม่สนใจปีที่ระบุใน CSV
for (let i = 0; i < header.length; i++) {
    const col = header[i].trim();
    if (!col || col === '#') continue;

    // หา class จาก header (เช่น "ชั้นประถมศึกษาปีที่ 1")
    const classMatch = col.match(/ชั้นประถมศึกษาปีที่\s+(\d+)/);
    let currentClassNum = '';
    if (classMatch) {
        currentClassNum = classMatch[1];
        // วนหาเมนูวิชาที่ตามมาภายใต้ชั้นนี้
        for (let j = i + 1; j < header.length; j++) {
            const subCol = header[j].trim();
            // ถ้าเจอชั้นใหม่ให้หยุด
            if (subCol.match(/ชั้นประถมศึกษาปีที่/)) break;
            
            const subMatch = subCol.match(/^([ก-ฮA-Z\d]{5,6})\s+(.+)$/);
            if (subMatch) {
                subjects.push({
                    code: subMatch[1],
                    name: subMatch[2],
                    class_level: `ป.${currentClassNum}`
                });
            }
        }
    }
}

// ล้างข้อมูลวิชาที่ซ้ำกัน (กรณีชุดวิชาเดียวกันปรากฏหลายปีใน CSV)
const uniqueSubjects = [];
const seen = new Set();
subjects.forEach(s => {
    const key = `${s.code}-${s.class_level}`;
    if (!seen.has(key)) {
        seen.add(key);
        uniqueSubjects.push(s);
    }
});

let sql = 'DELETE FROM subjects;\n'; 
uniqueSubjects.forEach(s => {
    const escapedName = s.name.replace(/'/g, "''");
    // กำหนดให้ year เป็น NULL เพื่อเป็น Template
    sql += `INSERT OR IGNORE INTO subjects (id, code, name, type, credit, maxScore, semester, class_level, year) VALUES ('${s.code}-${s.class_level}', '${s.code}', '${escapedName}', 'พื้นฐาน', 1, 100, 1, '${s.class_level}', NULL);\n`;
});

fs.writeFileSync('import_subjects_template.sql', sql);
console.log(`Generated ${uniqueSubjects.length} unique subject templates.`);
