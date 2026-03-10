import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { calculateGrade } from '@/lib/grading-utils';
import { Student, Subject, ScoreRecord } from './types';

export async function generatePDF(
  students: Student[],
  subjects: Subject[],
  scores: ScoreRecord[],
  academicYear: number,
  gradingGrade: string,
  reportSelectedStudent: string,
  cachedFonts: { regular: ArrayBuffer; bold: ArrayBuffer } | null,
  getScore: (studentId: string, subjectId: string) => number,
  studentToPrint?: Student,
) {
  try {
    // --- Fonts ---
    let fontBytes = cachedFonts?.regular;
    let fontBoldBytes = cachedFonts?.bold;
    if (!fontBytes || !fontBoldBytes) {
      [fontBytes, fontBoldBytes] = await Promise.all([
        fetch('https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNew.ttf').then(r => r.arrayBuffer()),
        fetch('https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNewBold.ttf').then(r => r.arrayBuffer()),
      ]);
    }

    // --- Determine students to print ---
    const studentsInYear = students.filter(s => s.year === academicYear || !s.year);
    const targets: Student[] = studentToPrint
      ? [studentToPrint]
      : (reportSelectedStudent === 'all' ? studentsInYear : studentsInYear.filter(s => s.id === reportSelectedStudent));


    // --- Create PDF Doc ---
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const fReg = await pdfDoc.embedFont(fontBytes!);
    const fBold = await pdfDoc.embedFont(fontBoldBytes!);

    const W = 595.28, H = 841.89;
    const black = rgb(0, 0, 0);
    const orange = rgb(0.99, 0.83, 0.70);
    const grayBg = rgb(0.9, 0.9, 0.9);

    // Helper: draw text
    const txt = (pg: any, text: string, x: number, y: number, sz: number, bold = false, clr = black) => {
      pg.drawText(String(text ?? ''), { x, y, size: sz, font: bold ? fBold : fReg, color: clr });
    };

    // New Helper: Draw wrapped text
    const drawWrappedText = (pg: any, text: string, x: number, y: number, sz: number, maxWidth: number, bold = false, clr = black) => {
      const font = bold ? fBold : fReg;
      let words = text.split(''); // For Thai, splitting by character is safer than by space
      let lines: string[] = [];
      let currentLine = '';

      for (let i = 0; i < words.length; i++) {
        let testLine = currentLine + words[i];
        let testWidth = font.widthOfTextAtSize(testLine, sz);
        if (testWidth > maxWidth && i > 0) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);

      let curRowY = y;
      lines.forEach((ln, i) => {
        if (i > 1) return; // Max 2 lines to prevent overlapping
        pg.drawText(ln, { x, y: curRowY, size: sz, font, color: clr });
        curRowY -= sz * 0.9;
      });
      return lines.length;
    };

    const drawTextCenter = (pg: any, text: string, x1: number, x2: number, y: number, sz: number, bold = false, clr = black) => {
      const str = String(text ?? '');
      const w = (bold ? fBold : fReg).widthOfTextAtSize(str, sz);
      txt(pg, str, x1 + (x2 - x1 - w) / 2, y, sz, bold, clr);
    };
    const drawTextMultilineCenter = (pg: any, text: string, x1: number, x2: number, centerY: number, sz: number, bold = false, clr = black) => {
      const lines = String(text ?? '').split('\n');
      const totalH = lines.length * sz;
      let startY = centerY + totalH / 2 - sz * 0.8;
      lines.forEach(ln => {
        drawTextCenter(pg, ln, x1, x2, startY, sz, bold, clr);
        startY -= sz;
      });
    };
    const hline = (pg: any, x1: number, y1: number, x2: number, y2: number, thick = 0.5, clr = black) =>
      pg.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: thick, color: clr });
    const fillRect = (pg: any, x: number, y: number, w: number, h: number, clr: any) =>
      pg.drawRectangle({ x, y, width: w, height: h, color: clr, borderWidth: 0 });

    // ------ Column widths ------
    const mL = 25, mR = W - 25;
    const tableW = mR - mL;
    // [ลำดับ, รายวิชา, ประเภท, ชั่วโมง, ภ1ได้, ภ2ได้, รวมได้, ระดับผล, หมายเหตุ]
    const cols = [25, 175, 45, 45, 40, 40, 43, 40, 57.28];
    const colX: number[] = [mL];
    cols.forEach((c, i) => colX.push(colX[i] + c));

    const ROW_H = 15;
    const HDR_ROW1_H = 18;
    const HDR_ROW2_H = 18;
    const HDR_H = HDR_ROW1_H + HDR_ROW2_H;

    // Sort subjects
    const sortedSubjs = [...subjects].sort((a, b) => {
      const typeOrder: Record<string, number> = { 'พื้นฐาน': 1, 'เพิ่มเติม': 2, 'กิจกรรม': 3 };
      return (typeOrder[a.type || 'พื้นฐาน'] || 99) - (typeOrder[b.type || 'พื้นฐาน'] || 99) || (a.code || '').localeCompare(b.code || '');
    });

    // Process each student
    for (let si = 0; si < targets.length; si++) {
      const student = targets[si];
      const pg = pdfDoc.addPage([W, H]);
      let curY = H - 25;

      // ── Title Rows ──
      txt(pg, 'ป.6', mR - 20, curY, 12, true, black);
      const title = 'แบบรายงานผลพัฒนาคุณภาพผู้เรียนรายบุคคล ( ปพ.6 )';
      const titleW = fBold.widthOfTextAtSize(title, 16);
      txt(pg, title, (W - titleW) / 2, curY, 16, true, black);
      curY -= 25;

      // ── Student info row ──
      txt(pg, `ชื่อ-สกุล  ${student.name}`, mL + 5, curY, 12, false);
      txt(pg, `รหัสประจำตัว  ${student.code}`, mL + 205, curY, 12, false);
      txt(pg, `ชั้น  ${(student.class || '').split('/')[0]}`, mL + 365, curY, 12, false);
      txt(pg, `ปีการศึกษา  ${academicYear}`, mL + 435, curY, 12, false);
      curY -= 12;

      // ── Table Header ──
      const yTop = curY;
      const yMid = yTop - HDR_ROW1_H;
      const yBot = yTop - HDR_H;

      fillRect(pg, colX[0], yBot, tableW, HDR_H, orange);

      hline(pg, colX[0], yTop, colX[9], yTop, 0.8);
      hline(pg, colX[0], yBot, colX[9], yBot, 0.8);
      hline(pg, colX[4], yMid, colX[7], yMid, 0.5);

      const fullVCols = [0, 1, 2, 3, 4, 7, 8, 9];
      fullVCols.forEach(c => hline(pg, colX[c], yTop, colX[c], yBot, c === 0 || c === 9 ? 0.8 : 0.5));
      const partVCols = [5, 6];
      partVCols.forEach(c => hline(pg, colX[c], yMid, colX[c], yBot, 0.5));

      drawTextMultilineCenter(pg, "ลำดับ\nที่", colX[0], colX[1], yTop - HDR_H / 2, 12, true);
      drawTextMultilineCenter(pg, "รายวิชา", colX[1], colX[2], yTop - HDR_H / 2, 16, true);
      drawTextMultilineCenter(pg, "ประเภท", colX[2], colX[3], yTop - HDR_H / 2, 14, true);
      drawTextMultilineCenter(pg, "เวลาเรียน\n(ชั่วโมง)", colX[3], colX[4], yTop - HDR_H / 2, 12, true);

      drawTextCenter(pg, "ภาคเรียนที่ 1 (50)", colX[4], colX[5], yMid + 4, 14, true);
      drawTextCenter(pg, "ภาคเรียนที่ 2 (50)", colX[5], colX[6], yMid + 4, 14, true);
      drawTextCenter(pg, "รวมทั้งปี (100)", colX[6], colX[7], yMid + 4, 13, true);

      drawTextMultilineCenter(pg, "ระดับผล\nการเรียน", colX[7], colX[8], yTop - HDR_H / 2, 12, true);
      drawTextMultilineCenter(pg, "หมายเหตุ", colX[8], colX[9], yTop - HDR_H / 2, 14, true);

      curY = yBot;
      const dataTopY = curY;

      // ── Data Rows ──
      let rowNum = 0;
      let totalRowsDrawn = 0;

      sortedSubjs.forEach((sub) => {
        if (curY < 60) return; // Prevent overflow

        const s1 = getScore(student.id, sub.id);
        const matchedSub = subjects.find(s => (s.code || s.name) === (sub.code || sub.name) && s.semester !== sub.semester);
        const s2 = matchedSub ? getScore(student.id, matchedSub.id) : 0;

        const sem1Score = sub.semester === 1 ? s1 : (matchedSub ? s2 : 0);
        const sem2Score = sub.semester === 2 ? s1 : (matchedSub ? s2 : 0);
        const sem1Max = sub.semester === 1 ? sub.maxScore : (matchedSub?.semester === 1 ? matchedSub.maxScore : 0);
        const sem2Max = sub.semester === 2 ? sub.maxScore : (matchedSub?.semester === 2 ? matchedSub.maxScore : 0);

        const totalGot = sem1Score + sem2Score;
        const totalMax = sem1Max + sem2Max;
        const yearPct = totalMax > 0 ? Math.round((totalGot / totalMax) * 100) : 0;

        let grade = '-';
        if (sub.type === 'กิจกรรม') {
          grade = sub.maxScore > 0 ? (s1 >= sub.maxScore * 0.5 ? 'ผ' : 'มผ') : '-';
        } else if (totalMax > 0) {
          grade = calculateGrade(yearPct);
        }

        rowNum++;
        totalRowsDrawn++;
        const isAct = sub.type === 'กิจกรรม';

        if (isAct) {
          fillRect(pg, colX[5], curY - ROW_H, colX[11] - colX[5], ROW_H, grayBg);
        }

        drawTextCenter(pg, String(rowNum), colX[0], colX[1], curY - ROW_H + 4, 13);
        drawWrappedText(pg, sub.name, colX[1] + 4, curY - ROW_H + 8, 14, cols[1] - 8);

        drawTextCenter(pg, sub.type || 'พื้นฐาน', colX[2], colX[3], curY - ROW_H + 4, 13);
        const displayHrs = (sub.credit || 1) * 40;
        drawTextCenter(pg, String(displayHrs), colX[3], colX[4], curY - ROW_H + 4, 14);

        if (isAct) {
          drawTextCenter(pg, grade, colX[7], colX[8], curY - ROW_H + 4, 14);
        } else {
          drawTextCenter(pg, sem1Score > 0 ? String(sem1Score) : '-', colX[4], colX[5], curY - ROW_H + 4, 14);
          drawTextCenter(pg, sem2Score > 0 ? String(sem2Score) : '-', colX[5], colX[6], curY - ROW_H + 4, 14);
          drawTextCenter(pg, totalMax > 0 ? String(totalGot) : '-', colX[6], colX[7], curY - ROW_H + 4, 14);
          drawTextCenter(pg, grade, colX[7], colX[8], curY - ROW_H + 4, 14);
        }

        curY -= ROW_H;
      });

      // Fill empty rows until at least 20 rows are drawn
      const emptyRows = Math.max(0, 20 - totalRowsDrawn);
      for (let i = 0; i < emptyRows; i++) {
        if (curY < 60) break;
        curY -= ROW_H;
      }

      // ── Draw Data Grid Lines ──
      let ry = dataTopY;
      while (ry >= curY) {
        hline(pg, colX[0], ry, colX[9], ry, 0.5);
        ry -= ROW_H;
      }
      for (let c = 0; c <= 9; c++) {
        hline(pg, colX[c], dataTopY, colX[c], curY, c === 0 || c === 9 ? 0.8 : 0.5);
      }
      // Bottom border (thicker)
      hline(pg, colX[0], curY, colX[9], curY, 0.8);

      // ── GPA Row ──
      curY -= 14;
      let totalGPts = 0, gCount = 0;
      const subjectGroups2: Record<string, any> = {};
      subjects.forEach(sub => {
        const key = sub.code || sub.name;
        if (!subjectGroups2[key]) subjectGroups2[key] = { sem1: null, sem2: null, type: sub.type };
        if (sub.semester === 1) subjectGroups2[key].sem1 = sub;
        else subjectGroups2[key].sem2 = sub;
      });
      Object.values(subjectGroups2).forEach((sg: any) => {
        if (sg.type === 'กิจกรรม') return;
        const s1 = sg.sem1 ? getScore(student.id, sg.sem1.id) : 0;
        const s2 = sg.sem2 ? getScore(student.id, sg.sem2.id) : 0;
        const m1 = sg.sem1?.maxScore || 0; const m2 = sg.sem2?.maxScore || 0;
        const tot = s1 + s2; const max = m1 + m2;
        if (max > 0) { const g = parseFloat(calculateGrade(Math.round((tot / max) * 100))); if (!isNaN(g)) { totalGPts += g; gCount++; } }
      });
      const gpa = gCount > 0 ? (totalGPts / gCount).toFixed(2) : '-';
      txt(pg, `ผลการเรียนเฉลี่ย (GPA) : ${gpa}`, mL, curY, 11, true, black);
      curY -= 30;

      // ── Signatures ──
      txt(pg, 'ลงชื่อ ................................................................', mL + 40, curY, 11, false);
      txt(pg, 'ลงชื่อ ................................................................', mL + 320, curY, 11, false);
      curY -= 15;
      txt(pg, '(ครูประจำชั้น)', mL + 90, curY, 11, false);
      txt(pg, '(ผู้อำนวยการโรงเรียน)', mL + 360, curY, 11, false);
    }

    // --- Open PDF in New Tab ---
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (e) {
    console.error('PDF Error:', e);
    alert('เกิดข้อผิดพลาดในการสร้าง PDF ครับ');
  } finally {
  }
};
