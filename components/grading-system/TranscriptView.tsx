'use client';

import { useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Users, Save, FileText, FileBarChart } from 'lucide-react';
import { cn, calculateGrade } from '@/lib/grading-utils';
import { Student, Subject, ScoreRecord } from './types';

interface TranscriptViewProps {
  students: Student[];
  subjects: Subject[];
  scores: ScoreRecord[];
  academicYear: number;
  gradingGrade: string;
  selectedTranscriptStudentId: string | null;
  setSelectedTranscriptStudentId: (id: string | null) => void;
  selectedTranscriptRoom: string;
  setSelectedTranscriptRoom: (room: string) => void;
  cachedFonts: { regular: ArrayBuffer; bold: ArrayBuffer } | null;
  getScore: (studentId: string, subjectId: string, year?: number) => { score1: number; score2: number; year: number } | null;
}

export default function TranscriptView({
  students, subjects, scores, academicYear, gradingGrade,
  selectedTranscriptStudentId, setSelectedTranscriptStudentId,
  selectedTranscriptRoom, setSelectedTranscriptRoom,
  cachedFonts, getScore,
}: TranscriptViewProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const generateTranscriptPDF = async (student: Student) => {
    setIsGeneratingPDF(true);
    try {
      // 1. Fetch fonts (Use cache if available)
      let fontBytes = cachedFonts?.regular;
      let fontBoldBytes = cachedFonts?.bold;
      if (!fontBytes || !fontBoldBytes) {
        const fontUrl = 'https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNew.ttf';
        const fontBoldUrl = 'https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNewBold.ttf';
        [fontBytes, fontBoldBytes] = await Promise.all([
          fetch(fontUrl).then(res => res.arrayBuffer()),
          fetch(fontBoldUrl).then(res => res.arrayBuffer())
        ]);
      }
      // 2. Create PDF Document (2 pages)
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      const fReg = await pdfDoc.embedFont(fontBytes);
      const fBold = await pdfDoc.embedFont(fontBoldBytes);
      const W = 595.28;
      const H = 841.89;
      const black = rgb(0, 0, 0);
      const gray = rgb(0.5, 0.5, 0.5);
      // ── Helper functions ──────────────────────────────────────────
      const txt = (page: any, text: string, x: number, y: number, size: number, bold = false, color = black) => {
        page.drawText(String(text), { x, y, size, font: bold ? fBold : fReg, color });
      };
      const line = (page: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: black });
      };
      const rect = (page: any, x: number, y: number, w: number, h: number, thickness = 0.5) => {
        page.drawRectangle({ x, y, width: w, height: h, borderWidth: thickness, borderColor: black, color: rgb(1, 1, 1) });
      };
      // ── Process Subject Data ──────────────────────────────────────
      // --- Process Multi-Year Subject Data ---
      // Get all years student has data for
      const studentScores = scores.filter(s => s.studentId === student.id);
      const studentYears = Array.from(new Set(studentScores.map(s => s.year))).sort();

      // Helper to get grade level from class string (e.g. "ป.1" -> 1)
      const getGradeLevel = (cls: string): number => {
        const m = cls.match(/(\d+)/);
        return m ? parseInt(m[1]) : 0;
      };

      // Group data by grade level (1-6)
      const gradeGroups: Record<number, { year: number; subjects: any[] }> = {};

      for (let g = 1; g <= 6; g++) {
        // Find if student has scores for this grade
        // In this system, grade is often derived from the subject or student's class at that time
        // We'll look for scores where the student was in grade 'g'
        // For simplicity, we'll map years to grades if the student moved up each year
        // OR we just find any subject that matches the grade for that year
        const yearForGrade = studentYears.find(y => {
          const scoresInYear = studentScores.filter(s => s.year === y);
          // 1. Check if ANY score in this year explicitly matches this grade level via subject
          const hasGradeSubject = scoresInYear.some(sc => {
            const sub = subjects.find(s => s.id === sc.subjectId);
            if (!sub) return false;
            // Common pattern: ท11101 -> 1, ท14101 -> 4
            const subGrade = sub.code.match(/[ก-ฮA-Z](\d)/);
            return subGrade && parseInt(subGrade[1]) === g;
          });
          if (hasGradeSubject) return true;

          // 2. Fallback: Heuristic based on current student grade and academic year
          const currentGrade = getGradeLevel(student.class);
          return y === (academicYear - (currentGrade - g));
        }) || (studentYears.includes(academicYear) && getGradeLevel(student.class) === g ? academicYear : null);

        if (yearForGrade) {
          const subjsInYear = subjects.filter(s => {
            return scores.some(sc => sc.studentId === student.id && sc.subjectId === s.id && sc.year === yearForGrade);
          });

          if (subjsInYear.length > 0) {
            const sortedByParts = subjsInYear.sort((a, b) => {
              const typeOrder: Record<string, number> = { 'พื้นฐาน': 1, 'เพิ่มเติม': 2, 'กิจกรรม': 3 };
              return (typeOrder[a.type || 'พื้นฐาน'] || 99) - (typeOrder[b.type || 'พื้นฐาน'] || 99) || (a.code || '').localeCompare(b.code || '');
            });
            gradeGroups[g] = { year: yearForGrade, subjects: sortedByParts };
          }
        }
      }
      // ═══════════════════════════════════════════════════════════════
      // PAGE 1
      // ═══════════════════════════════════════════════════════════════
      const p1 = pdfDoc.addPage([W, H]);
      const mL = 28;  // left margin
      const mR = W - 28; // right margin
      const mT = H - 20; // top y
      // ── School Info Block ─────────────────────────────────────────
      let y = mT;
      txt(p1, 'โรงเรียน  บ้านละหอกตะแบง', mL, y - 14, 13, false);
      txt(p1, 'สังกัด  สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน', mL, y - 28, 12, false);
      txt(p1, 'ตำบล/แขวง  ปราสาท', mL, y - 42, 12, false);
      txt(p1, 'อำเภอ/เขต  บ้านกรวด', mL, y - 56, 12, false);
      txt(p1, 'จังหวัด  บุรีรัมย์', mL, y - 70, 12, false);
      txt(p1, 'สำนักงานเขตพื้นที่การศึกษา  ประถมศึกษาบุรีรัมย์ เขต 2', mL, y - 84, 12, false);
      txt(p1, `วันเข้าเรียน  -`, mL, y - 98, 12, false);
      txt(p1, `โรงเรียนเดิม  -`, mL, y - 112, 12, false);
      txt(p1, `จังหวัด  -`, mL, y - 126, 12, false);
      txt(p1, `ชั้นเรียนสุดท้าย  -`, mL, y - 140, 12, false);
      // Box: student info (right side)
      const bx = 330;
      const bw = 235;
      rect(p1, bx, y - 148, bw, 136);
      txt(p1, `ชื่อ  ${student.name}`, bx + 5, y - 24, 12, false);
      txt(p1, `ชั้น  ${(student.class || '').split('/')[0]}`, bx + 5, y - 38, 12, false);
      txt(p1, `เลขประจำตัวนักเรียน  ${student.code}`, bx + 5, y - 52, 12, false);
      txt(p1, `เลขประจำตัวประชาชน  -`, bx + 5, y - 66, 12, false);
      txt(p1, `เกิดวันที่  -  เดือน  -  พ.ศ.  -`, bx + 5, y - 80, 12, false);
      txt(p1, `เพศ  -   สัญชาติ  -   ศาสนา  -`, bx + 5, y - 94, 12, false);
      txt(p1, `ชื่อ-ชื่อสกุลบิดา  -`, bx + 5, y - 108, 12, false);
      txt(p1, `ชื่อ-ชื่อสกุลมารดา  -`, bx + 5, y - 122, 12, false);
      // ── Section Title: ผลการเรียนรายวิชา ─────────────────────────
      const secY = mT - 162;
      txt(p1, 'ผลการเรียนรายวิชา', W / 2 - 50, secY, 14, true);
      // ── 3-Column Table Header ──────────────────────────────────────
      const tY = secY - 15; // top of table header
      const tH = 16; // row height
      const tableBottom = 40;
      // Column layout: 3 panels side by side
      // Each panel: [รหัส/รายวิชา=wide] [เวลา=30] [ผล=25]
      const panelW = (mR - mL) / 3;
      const subColWide = panelW - 58; // subject name width
      const subColHr = 30;
      const subColGd = 28;
      const panels = [0, 1, 2].map(i => {
        const px = mL + i * panelW;
        return {
          x: px,
          nameX: px,
          hrX: px + subColWide,
          gdX: px + subColWide + subColHr,
          rightX: px + panelW,
        };
      });
      // Draw table outer border + column headers
      const tableTopY = tY;
      rect(p1, mL, tableBottom, mR - mL, tableTopY - tableBottom);
      // Header row
      const hRowH = 28;
      // Draw 3 vertical dividers between panels
      panels.forEach((p, i) => {
        if (i > 0) line(p1, p.x, tableBottom, p.x, tableTopY);
        // sub-column dividers
        line(p1, p.hrX, tableBottom, p.hrX, tableTopY);
        line(p1, p.gdX, tableBottom, p.gdX, tableTopY);
        // Column headers (rotated-style: just draw small)
        txt(p1, 'รหัส/รายวิชา', p.nameX + 3, tableTopY - 13, 9, true);
        txt(p1, 'หน่วยกิต', p.hrX + 2, tableTopY - 8, 8, true);
        txt(p1, '(ชม.)', p.hrX + 4, tableTopY - 16, 8, true);
        txt(p1, 'ผล', p.gdX + 5, tableTopY - 8, 8, true);
        txt(p1, 'เรียน', p.gdX + 3, tableTopY - 16, 8, true);
      });
      line(p1, mL, tableTopY - hRowH, mR, tableTopY - hRowH, 0.5);
      // ── Fill table with academic subjects ─────────────────────────
      // ── Fill table (3 Columns: P1-2, P3-4, P5-6) ──────────────────
      const rowH = 12;

      const drawColumn = (gradeLevel: number, secondGrade: number, panelIdx: number) => {
        let ry = tableTopY - hRowH - 12;
        const p = panels[panelIdx];

        [gradeLevel, secondGrade].forEach(g => {
          const group = gradeGroups[g];
          if (!group) return;

          // Header: ชั้นปี
          txt(p1, `ชั้นประถมศึกษาปีที่ ${g}`, p.nameX + 2, ry, 9.5, true);
          txt(p1, `ปีการศึกษา ${group.year}`, p.nameX + 2, ry - 10, 8.5, true);
          ry -= 24;

          group.subjects.forEach(sub => {
            if (ry < tableBottom + rowH) return;

            const sc = getScore(student.id, sub.id, group.year);
            const total = (sc?.score1 || 0) + (sc?.score2 || 0);
            const grade = sub.type === 'กิจกรรม' ? (total >= 50 ? 'ผ' : 'มผ') : calculateGrade(total);
            const credit = sub.credit || 1;
            const displayHrs = credit * 40;

            const nameStr = sub.name;
            const displayName = nameStr.length > 20 ? nameStr.substring(0, 19) + '…' : nameStr;

            txt(p1, displayName, p.nameX + 2, ry, 8.5, false);
            txt(p1, `${credit}/${displayHrs}`, p.hrX + 0, ry, 8, false);
            txt(p1, grade, p.gdX + 6, ry, 8.5, false);

            line(p1, p.nameX, ry - 2, p.rightX, ry - 2, 0.3);
            ry -= rowH;
          });

          ry -= rowH * 2; // Spacing between grades
        });
      };

      drawColumn(1, 2, 0); // Col 1: P.1 & P.2
      drawColumn(3, 4, 1); // Col 2: P.3 & P.4
      drawColumn(5, 6, 2); // Col 3: P.5 & P.6
      // ═══════════════════════════════════════════════════════════════
      // ── Save & Open in Blob URL ──
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url); // For iframe preview
      setIsGeneratingPDF(false);
    } catch (e) {
      console.error('PDF Error:', e);
      setIsGeneratingPDF(false);
    }
  };

  const uniqueStudents = students.reduce((acc, student) => {
    const existing = acc.find(s => s.code === student.code);
    if (!existing) acc.push(student);
    return acc;
  }, [] as Student[]);

  const uniqueRooms = Array.from(new Set(uniqueStudents.map(s => {
    if (!s.class) return "ไม่ระบุชั้น";
    return s.class.startsWith('ป.') ? s.class : `ป.${s.class}`;
  }))).sort();

  const filteredStudentsByRoom = selectedTranscriptRoom === 'all'
    ? uniqueStudents
    : uniqueStudents.filter(s => {
      const className = !s.class ? "ไม่ระบุชั้น" : (s.class.startsWith('ป.') ? s.class : `ป.${s.class}`);
      return className === selectedTranscriptRoom;
    });

  const selectedStudent = uniqueStudents.find(s => s.id === selectedTranscriptStudentId);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileBarChart className="text-emerald-600" />
            รายงานผลการเรียนรายบุคคล (ปพ.1 / แบบละเอียด)
          </h2>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">เลือกนักเรียนในชั้น</label>
            <select
              value={selectedTranscriptRoom}
              onChange={(e) => { setSelectedTranscriptRoom(e.target.value); setSelectedTranscriptStudentId(''); }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            >
              <option value="all">-- ทุกชั้น --</option>
              {uniqueRooms.map(room => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">ค้นหาและเลือกนักเรียน (แสดงตามเลขที่)</label>
            <select
              value={selectedTranscriptStudentId || ''}
              onChange={(e) => {
                const sid = e.target.value;
                setSelectedTranscriptStudentId(sid);
                const student = students.find(s => s.id === sid);
                if (student) generateTranscriptPDF(student);
                else setPdfPreviewUrl(null);
              }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
            >
              <option value="">-- เลือกนักเรียน --</option>
              {filteredStudentsByRoom
                .sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999) || a.name.localeCompare(b.name, 'th'))
                .map(student => (
                  <option key={student.id} value={student.id}>
                    {student.number ? `[เลขที่ ${student.number}] ` : ''}{student.code} - {student.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {selectedStudent ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                  {selectedStudent.name.substring(0, 1)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100">{selectedStudent.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">เลขประจำตัว: {selectedStudent.code} | ชั้น {selectedStudent.class || '-'}</p>
                </div>
              </div>
              <button
                onClick={() => generateTranscriptPDF(selectedStudent)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-all"
              >
                <Save size={16} className="text-emerald-500" />
                รีเฟรช PDF
              </button>
            </div>

            <div className="relative aspect-[1/1.414] w-full bg-slate-100 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner">
              {isGeneratingPDF ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10">
                  <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <p className="font-bold text-emerald-600 animate-pulse">กำลังประมวลผล PDF...</p>
                </div>
              ) : pdfPreviewUrl ? (
                <iframe src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full border-none" title="PDF Preview" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <FileText size={64} className="mb-4 opacity-20" />
                  <p>ไม่พบข้อมูลการพรีวิว</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-20 text-center flex flex-col items-center bg-slate-50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center mb-6">
              <Users size={32} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-400">กรุณาเลือกนักเรียนเพื่อดู ปพ.1</h3>
            <p className="text-sm text-slate-400 mt-2">พิมพ์ชื่อหรือเลขประจำตัวในช่องค้นหาด้านบน</p>
          </div>
        )}
      </div>
    </div>
  );
}
