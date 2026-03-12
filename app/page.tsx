"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';

// ============ CONFIG & TEMPLATES ============
const defaultConfig = {
  app_title: 'ระบบบันทึกคะแนน',
  school_name: 'โรงเรียนบ้านละหอกตะแบง',
  primary_color: '#10b981',
};

// ============ HELPERS ============
const getCurrentAcademicYear = () => {
  const today = new Date();
  const year = today.getFullYear() + 543;
  const month = today.getMonth() + 1; // 1-12
  const day = today.getDate();

  // 16/5 ถึง 15/5 ปีถัดไป
  if (month < 5 || (month === 5 && day < 16)) {
    return year - 1;
  }
  return year;
};

const calculateGrade = (score, maxScore = 100) => {
  if (score === null || score === undefined) return '';
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return '4';
  if (percentage >= 75) return '3.5';
  if (percentage >= 70) return '3';
  if (percentage >= 65) return '2.5';
  if (percentage >= 60) return '2';
  if (percentage >= 55) return '1.5';
  if (percentage >= 50) return '1';
  return '0';
};

// เพิ่ม Type สำหรับ window
declare global {
  interface Window {
    dataSdk: any;
    elementSdk: any;
  }
}

export default function App() {
  // ============ STATE ============
  const [allData, setAllData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('grading'); // 'grading' | 'admin'
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedYear, setSelectedYear] = useState<number | string>(getCurrentAcademicYear());
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [toast, setToast] = useState({ show: false, message: '' });
  
  // Admin Auth State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');

  // Admin Data State
  const [adminSelectedRoom, setAdminSelectedRoom] = useState('');
  const [isBulkEditSubjects, setIsBulkEditSubjects] = useState(false);
  const [bulkSubjectText, setBulkSubjectText] = useState('');

  // Modals
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderStudents, setReorderStudents] = useState<any[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  
  // Student Status State
  const [selectedStudentStatus, setSelectedStudentStatus] = useState<any>(null);
  const longPressTimer = useRef<any>(null);

  // Config bindings
  const [appTitle, setAppTitle] = useState(defaultConfig.app_title);
  const [schoolName, setSchoolName] = useState(defaultConfig.school_name);

  // ============ EFFECTS ============
  useEffect(() => {
    if (typeof window !== 'undefined' && window.dataSdk) {
      window.dataSdk.init({ onDataChanged: (data: any[]) => setAllData([...data]) });
    }
    
    if (typeof window !== 'undefined' && window.elementSdk) {
      window.elementSdk.init({
        defaultConfig,
        onConfigChange: (config: any) => {
          setAppTitle(config.app_title || defaultConfig.app_title);
          setSchoolName(config.school_name || defaultConfig.school_name);
        }
      });
    }
  }, []);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  };

  // ============ DERIVED DATA ============
  const rooms = useMemo(() => {
    const classesMap = new Map();
    const studentsByYear = allData.filter(d => d.type === 'student' && d.year === Number(selectedYear));
    
    studentsByYear.forEach(student => {
      if (!classesMap.has(student.class_level)) {
        classesMap.set(student.class_level, { class_level: student.class_level, count: 0, studentCodes: [] });
      }
      classesMap.get(student.class_level).count++;
      classesMap.get(student.class_level).studentCodes.push(student.student_code);
    });

    const roomList = Array.from(classesMap.values());

    // Check completion for each room
    return roomList.map(room => {
      let isComplete = false;
      if (room.studentCodes.length > 0) {
        // วิชาของห้องนี้ คือวิชาที่มี year ตรงกับปีที่เลือก หรือเป็นวิชามาตรฐาน (year is null/0)
        const roomSubjects = allData.filter(d => 
          d.type === 'subject' && 
          d.class_level === room.class_level && 
          (d.year === Number(selectedYear) || !d.year)
        );

        if (roomSubjects.length > 0) {
          isComplete = roomSubjects.every(subj => {
            return room.studentCodes.every((stCode: string) => {
              const hasSem1 = allData.some(d => d.type === 'score' && d.student_code === stCode && d.subject_code === subj.subject_code && d.semester === 1 && d.year === Number(selectedYear));
              const hasSem2 = allData.some(d => d.type === 'score' && d.student_code === stCode && d.subject_code === subj.subject_code && d.semester === 2 && d.year === Number(selectedYear));
              return hasSem1 && hasSem2;
            });
          });
        }
      }

      return { ...room, isComplete };
    });
  }, [allData, selectedYear]);

  const subjects = useMemo(() => {
    if (!selectedRoom) return [];
    const subjectsMap = new Map();
    allData.filter(d => 
      d.type === 'subject' && 
      d.class_level === selectedRoom.class_level && 
      (d.year === Number(selectedYear) || !d.year)
    ).forEach(subject => {
      if (!subjectsMap.has(subject.subject_code)) {
        subjectsMap.set(subject.subject_code, subject);
      }
    });
    return Array.from(subjectsMap.values());
  }, [allData, selectedRoom, selectedYear]);

  const students = useMemo(() => {
    if (!selectedRoom) return [];
    return allData.filter(d => 
      d.type === 'student' && d.class_level === selectedRoom.class_level && d.year === Number(selectedYear)
    ).sort((a, b) => {
      const orderA = a.order_index !== undefined ? a.order_index : 9999;
      const orderB = b.order_index !== undefined ? b.order_index : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return a.student_name.localeCompare(b.student_name, 'th');
    });
  }, [allData, selectedRoom, selectedYear]);

  // Admin Data
  const adminRoomsList = useMemo(() => {
    return Array.from(new Set(allData.filter(d => d.type === 'student' && d.year === Number(selectedYear)).map(d => d.class_level))).sort();
  }, [allData, selectedYear]);

  const adminStudents = useMemo(() => {
    return allData.filter(d => d.type === 'student' && d.class_level === adminSelectedRoom && d.year === Number(selectedYear))
      .sort((a, b) => a.student_name.localeCompare(b.student_name, 'th'));
  }, [allData, adminSelectedRoom, selectedYear]);

  const adminSubjects = useMemo(() => {
    const subjectsMap = new Map();
    allData.filter(d => 
      d.type === 'subject' && 
      d.class_level === adminSelectedRoom && 
      (d.year === Number(selectedYear) || !d.year)
    ).forEach(subject => subjectsMap.set(subject.subject_code, subject));
    return Array.from(subjectsMap.values());
  }, [allData, adminSelectedRoom, selectedYear]);

  // ============ ACTIONS ============
  const handleSelectRoom = (room: any) => {
    setSelectedRoom(room);
    const roomSubjects = allData.filter(d => 
      d.type === 'subject' && 
      d.class_level === room.class_level && 
      (d.year === Number(selectedYear) || !d.year)
    );
    if (roomSubjects.length > 0) {
      setSelectedSubject(roomSubjects[0]);
    } else {
      setSelectedSubject(null);
    }
    setCurrentStep(2);
  };

  const handleSelectSubject = (subjectCode: string) => {
    const subject = subjects.find(s => s.subject_code === subjectCode);
    setSelectedSubject(subject);
  };

  const handleYearChange = (val: string) => {
    // ปรับให้สามารถลบจนว่างได้เพื่อพิมพ์ใหม่ได้สะดวก
    setSelectedYear(val === '' ? '' : parseInt(val));
    if (currentStep > 1) setCurrentStep(1);
    setAdminSelectedRoom('');
  };

  // Keyboard Navigation (Enter เลื่อนลง)
  const handleKeyDown = (e: React.KeyboardEvent, index: number, semester: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.querySelector(`input[data-index="${index + 1}"][data-semester="${semester}"]`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const updateScoreRealtime = async (studentCode: string, semester: number, value: string) => {
    let newData = [...allData];
    const existingIndex = newData.findIndex(d => 
      d.type === 'score' && d.student_code === studentCode &&
      d.subject_code === selectedSubject.subject_code &&
      d.class_level === selectedRoom.class_level &&
      d.year === Number(selectedYear) && d.semester === semester
    );

    if (value === '' || value === null) {
      if (existingIndex >= 0) {
        newData.splice(existingIndex, 1);
        setAllData(newData);
      }
      return;
    }

    const numValue = Number(value);
    if (numValue > 50) return showToast('⚠️ คะแนนเต็มเทอมละ 50 เท่านั้น');
    if (numValue < 0) return;

    if (existingIndex >= 0) {
      newData[existingIndex] = { ...newData[existingIndex], score: numValue };
      if (window.dataSdk) window.dataSdk.update(newData[existingIndex]);
    } else {
      const newScore = {
        type: 'score', student_code: studentCode, subject_code: selectedSubject.subject_code,
        subject_name: selectedSubject.subject_name, class_level: selectedRoom.class_level,
        score: numValue, max_score: selectedSubject.max_score, semester, year: Number(selectedYear),
        created_at: new Date().toISOString()
      };
      newData.push(newScore);
      if (window.dataSdk) window.dataSdk.create(newScore);
    }
    setAllData(newData);
  };

  const getStudentScore = (studentCode: string, subjCode: string, semester: number) => {
// ... (lines 225-231 unchanged) ...
// ... (lines 232 unchanged) ...
  };

  // ============ LONG PRESS STATUS ACTIONS ============
  const handleLongPressStart = (student: any) => {
    longPressTimer.current = setTimeout(() => {
      setSelectedStudentStatus(student);
      const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-20.mp3');
      audio.volume = 0.2;
      audio.play().catch(() => {}); // Play subtle feedback if allowed
    }, 700); // 700ms for long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const updateStudentStatus = async (status: string) => {
    if (!selectedStudentStatus) return;
    
    let newData = [...allData];
    const idx = newData.findIndex(d => d.type === 'student' && d.student_code === selectedStudentStatus.student_code && d.year === Number(selectedYear));
    
    if (idx >= 0) {
      newData[idx] = { ...newData[idx], status };
      setAllData(newData);
      if (window.dataSdk) window.dataSdk.update(newData[idx]);
      showToast(`อัปเดตสถานะ ${selectedStudentStatus.student_name} เป็น ${status}`);
    }
    setSelectedStudentStatus(null);
  };

  const isSubjectComplete = (subjCode: string) => {
    if (students.length === 0) return false;
    return students.every(st => {
      const hasSem1 = allData.some(d => d.type === 'score' && d.student_code === st.student_code && d.subject_code === subjCode && d.semester === 1);
      const hasSem2 = allData.some(d => d.type === 'score' && d.student_code === st.student_code && d.subject_code === subjCode && d.semester === 2);
      return hasSem1 && hasSem2;
    });
  };

  // ============ REORDER STUDENTS ============
  const openReorderModal = () => {
    setReorderStudents([...students]);
    setIsReorderModalOpen(true);
  };

  const saveReorder = () => {
    let newData = [...allData];
    reorderStudents.forEach((st, idx) => {
      const existingIndex = newData.findIndex(d => d.type === 'student' && d.student_code === st.student_code && d.year === Number(selectedYear));
      if (existingIndex >= 0) {
        newData[existingIndex] = { ...newData[existingIndex], order_index: idx + 1 };
        if (window.dataSdk) window.dataSdk.update(newData[existingIndex]);
      }
    });
    setAllData(newData);
    setIsReorderModalOpen(false);
    showToast('อัปเดตเลขที่เรียบร้อย');
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const items = [...reorderStudents];
    const draggedItem = items[draggedIdx];
    items.splice(draggedIdx, 1);
    items.splice(index, 0, draggedItem);
    setDraggedIdx(index);
    setReorderStudents(items);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedIdx(null);
  };

  // ============ ADMIN AUTH & BULK EDIT ============
  const verifyAdmin = () => {
    if (adminPwd === '31020177') {
      setIsAdminAuthenticated(true);
      setShowAdminAuth(false);
      setActiveTab('admin');
      setAdminPwd('');
    } else {
      showToast('⚠️ รหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleAdminTabClick = () => {
    if (isAdminAuthenticated) {
      setActiveTab('admin');
    } else {
      setShowAdminAuth(true);
    }
  };

  const startBulkEditSubjects = () => {
    // Format: รหัสวิชา (Tab) ชื่อวิชา (Tab) คะแนนเต็ม
    const text = adminSubjects.map(s => `${s.subject_code}\t${s.subject_name}\t${s.max_score}`).join('\n');
    setBulkSubjectText(text);
    setIsBulkEditSubjects(true);
  };

  const loadTemplateFromD1 = () => {
    if (!adminSelectedRoom) return;
    
    // กรองเอาเฉพาะวิชาที่เป็น Template (year เป็น 0 หรือ null) ของชั้นที่เลือก
    const templates = allData.filter(d => 
      d.type === 'subject' && 
      d.class_level === adminSelectedRoom && 
      (!d.year || d.year === 0)
    );

    if (templates.length === 0) {
      showToast('❌ ไม่พบเทมเพลตวิชาสากลในฐานข้อมูล');
      return;
    }

    const text = templates.map(s => `${s.subject_code}\t${s.subject_name}\t${s.max_score || 100}`).join('\n');
    setBulkSubjectText(text);
    showToast(`📥 โหลดเทมเพลต ${templates.length} วิชาเรียบร้อย`);
  };

  const saveBulkSubjects = () => {
    if (!adminSelectedRoom) return;
    const lines = bulkSubjectText.split('\n').map(l => l.trim()).filter(l => l);
    
    let newData = [...allData];
    // Remove old subjects for this room (both specific year and template)
    newData = newData.filter(d => !(d.type === 'subject' && d.class_level === adminSelectedRoom));
    
    lines.forEach(line => {
      const [code, name, maxScore] = line.split('\t');
      if (code && name) {
        const newSubj = {
          type: 'subject',
          subject_code: code.trim(),
          subject_name: name.trim(),
          class_level: adminSelectedRoom,
          max_score: Number(maxScore) || 100,
          year: 0, // 0 represents a universal template for this class level
          created_at: new Date().toISOString()
        };
        newData.push(newSubj);
      }
    });

    // บันทึกสถานะทั้งหมดไปยังฐานข้อมูลพร้อมกัน
    if (window.dataSdk) window.dataSdk.syncAll(newData);
    
    setAllData(newData);
    setIsBulkEditSubjects(false);
    showToast('บันทึกวิชาเรียบร้อยแล้ว');
  };

  // ============ EXPORT ============
  
  const exportPDFBlob = () => {
    if (!selectedRoom || subjects.length === 0 || students.length === 0) return showToast('ไม่มีข้อมูลให้ส่งออก');
    let html = `<html><head><meta charset="UTF-8"><title>ปพ.6 - ${selectedRoom.class_level}</title><style>@font-face {font-family: 'THSarabunNew';src: url('https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNew.ttf') format('truetype');font-weight: normal;font-style: normal;}@font-face {font-family: 'THSarabunNew';src: url('https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNewBold.ttf') format('truetype');font-weight: bold;font-style: normal;}body { font-family: 'THSarabunNew', sans-serif; margin: 0; padding: 0; color: #000; font-size: 16pt; }.page { width: 210mm; min-height: 297mm; padding: 20mm; margin: 0 auto; box-sizing: border-box; page-break-after: always; background: white; }@media print { body { background: white; }.page { margin: 0; border: initial; border-radius: initial; width: initial; min-height: initial; box-shadow: initial; background: initial; page-break-after: always; } }h2 { text-align: center; font-size: 20pt; font-weight: bold; margin-bottom: 20px; }.student-info { display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold; font-size: 16pt; }table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 16pt; }th, td { border: 1px solid #000; padding: 6px 4px; text-align: center; vertical-align: middle; }th { font-weight: bold; background-color: #f8f8f8; }td.text-left { text-align: left; padding-left: 10px; }.summary-table { width: 100%; margin-top: 10px; }.summary-table td { text-align: left; padding-left: 15px; }</style></head><body>`;

    students.forEach((student) => {
      html += `<div class="page"><h2>รายงานผลพัฒนาคุณภาพผู้เรียนรายบุคคล ( ปพ.6 )</h2><div class="student-info"><span>ชื่อ-สกุล: ${student.student_name}</span><span>รหัสประจำตัว: ${student.student_code}</span><span>ชั้น: ${selectedRoom.class_level}</span><span>ปีการศึกษา: ${selectedYear}</span></div><table><thead><tr><th style="width: 5%;">ลำดับที่</th><th style="width: 12%;">รหัสวิชา</th><th style="width: 25%;">รายวิชา</th><th style="width: 10%;">ประเภท</th><th style="width: 10%;">เวลาเรียน<br>(ชั่วโมง)</th><th style="width: 10%;">ภาคเรียนที่ 1</th><th style="width: 10%;">ภาคเรียนที่ 2</th><th style="width: 10%;">รวมคะแนน</th><th style="width: 8%;">ระดับผล<br>การเรียน</th></tr></thead><tbody>`;
      let sumBasicHours = 0; let sumAddHours = 0; let sumGrades = 0; let validSubjectCount = 0;

      subjects.forEach((subj, index) => {
        const s1 = getStudentScore(student.student_code, subj.subject_code, 1);
        const s2 = getStudentScore(student.student_code, subj.subject_code, 2);
        const total = s1 !== null && s2 !== null ? Number(s1) + Number(s2) : (s1 !== null ? Number(s1) * 2 : (s2 !== null ? Number(s2) * 2 : null));
        const grade = total !== null ? calculateGrade(total, 100) : '';
        
        let type = "พื้นฐาน"; let hours = 80;
        if(subj.subject_name.includes("เพิ่มเติม") || subj.subject_name.includes("ทุจริต") || subj.subject_name.includes("หน้าที่")) { type = "เพิ่มเติม"; hours = 40; }
        if(subj.subject_name.includes("แนะแนว") || subj.subject_name.includes("ลูกเสือ") || subj.subject_name.includes("ชุมนุม")) { type = "กิจกรรม"; hours = 40; }

        if (type === "พื้นฐาน") sumBasicHours += hours;
        if (type === "เพิ่มเติม") sumAddHours += hours;
        if (grade !== '' && type !== 'กิจกรรม') { sumGrades += parseFloat(grade); validSubjectCount++; }

        html += `<tr><td>${index + 1}</td><td>${subj.subject_code}</td><td class="text-left">${subj.subject_name}</td><td>${type}</td><td>${hours}</td><td>${s1 !== null ? s1 : ''}</td><td>${s2 !== null ? s2 : ''}</td><td>${total !== null ? total : ''}</td><td><strong>${grade}</strong></td></tr>`;
      });
      const avgGrade = validSubjectCount > 0 ? (sumGrades / validSubjectCount).toFixed(2) : '-';
      html += `</tbody></table><table class="summary-table"><tr><th colspan="2" style="text-align: left; padding-left: 10px; background: #eee;">สรุปผลการประเมิน</th></tr><tr><td style="width: 70%;">เวลาเรียนรายวิชาพื้นฐาน</td><td style="text-align: center;">${sumBasicHours} ชม.</td></tr><tr><td>เวลาเรียนรายวิชาเพิ่มเติม</td><td style="text-align: center;">${sumAddHours} ชม.</td></tr><tr><td>เวลาเรียนรวม</td><td style="text-align: center;">${sumBasicHours + sumAddHours} ชม.</td></tr><tr><td><strong>ระดับผลการเรียนเฉลี่ย</strong></td><td style="text-align: center;"><strong>${avgGrade}</strong></td></tr></table></div>`;
    });
    html += `</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    showToast('เปิดเอกสาร ปพ.6 ในแท็บใหม่แล้ว');
    setIsExportModalOpen(false);
  };

  // ส่งออกแบบ Excel ทุกวิชาในไฟล์เดียว
  const exportExcelAllSubjects = () => {
    if (!selectedRoom || subjects.length === 0 || students.length === 0) return showToast('ไม่มีข้อมูลให้ส่งออก');
    
    // ใช้ SpreadsheetML Format หรือ HTML Table ง่ายๆ ให้ Excel เปิดได้
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>`;
    
    html += `<h1>รายงานคะแนนรวมทุกวิชา ชั้น ${selectedRoom.class_level} ปีการศึกษา ${selectedYear}</h1>`;

    subjects.forEach(subj => {
      html += `<br/><h2>วิชา: ${subj.subject_code} ${subj.subject_name}</h2>`;
      html += `<table border="1"><thead><tr><th style="background-color:#10b981;color:white;">ที่</th><th style="background-color:#10b981;color:white;">เลขประจำตัว</th><th style="background-color:#10b981;color:white;">ชื่อ-นามสกุล</th><th style="background-color:#10b981;color:white;">เทอม 1</th><th style="background-color:#10b981;color:white;">เทอม 2</th><th style="background-color:#10b981;color:white;">รวม</th><th style="background-color:#10b981;color:white;">เกรด</th></tr></thead><tbody>`;
      
      students.forEach((student, index) => {
        const s1 = getStudentScore(student.student_code, subj.subject_code, 1);
        const s2 = getStudentScore(student.student_code, subj.subject_code, 2);
        const total = s1 !== null && s2 !== null ? Number(s1) + Number(s2) : (s1 !== null ? Number(s1) * 2 : (s2 !== null ? Number(s2) * 2 : null));
        const grade = total !== null ? calculateGrade(total, 100) : '-';
        
        html += `<tr><td>${index + 1}</td><td style="mso-number-format:'\@'">${student.student_code}</td><td>${student.student_name}</td><td>${s1 ?? ''}</td><td>${s2 ?? ''}</td><td>${total ?? ''}</td><td>${grade}</td></tr>`;
      });
      html += `</tbody></table>`;
    });

    html += `</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `คะแนนทุกวิชา_${selectedRoom.class_level}_${selectedYear}.xls`;
    link.click();
    showToast('ดาวน์โหลด Excel เรียบร้อย');
    setIsExportModalOpen(false);
  };

  // ============ RENDER ============
  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 font-sans selection:bg-emerald-100">
      
      {/* Header & Topbar */}
      <header className="bg-white border-b border-emerald-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1 flex items-center gap-4">
              <div>
                <h1 className="text-base sm:text-2xl font-bold text-emerald-800 truncate">{appTitle}</h1>
                <p className="text-emerald-600 text-xs sm:text-sm mt-0.5 truncate font-medium">{schoolName}</p>
              </div>
              <div className="hidden sm:block w-px h-8 bg-emerald-200"></div>
              <nav className="flex gap-2">
                <button 
                  onClick={() => setActiveTab('grading')}
                  className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeTab === 'grading' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                >
                  บันทึกคะแนน
                </button>
                <button 
                  onClick={handleAdminTabClick}
                  className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeTab === 'admin' ? 'bg-emerald-800 text-white' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                >
                  Admin
                </button>
              </nav>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 whitespace-nowrap">
              <label className="text-xs sm:text-sm font-bold text-emerald-700">ปีการศึกษา:</label>
              <input 
                type="number"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-24 px-3 py-2 text-sm border-2 border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold bg-white text-emerald-800 text-center transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="animate-in fade-in duration-300">
          
          {/* =========== TAB: GRADING =========== */}
          {activeTab === 'grading' && (
            <>
              {/* STEP 1: ROOMS */}
              {currentStep === 1 && (
                <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6">
                    <h2 className="text-lg sm:text-xl font-bold text-emerald-800">เลือกระดับชั้น</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {rooms.length === 0 ? (
                      <div className="text-center py-12 col-span-full text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-emerald-100">
                        <p className="font-medium text-slate-500">ยังไม่มีข้อมูลนักเรียนในปีการศึกษานี้</p>
                        <p className="text-sm mt-1">ให้ส่วนจัดการส่วนกลาง หรือ Admin นำเข้าข้อมูล</p>
                      </div>
                    ) : (
                      rooms.map(cls => (
                        <button 
                          key={cls.class_level} 
                          onClick={() => handleSelectRoom(cls)} 
                          className={`bg-white border-2 hover:shadow-md rounded-2xl p-6 text-center transition-all group flex flex-col items-center justify-center ${cls.isComplete ? 'grayscale opacity-60 border-slate-200' : 'border-emerald-50 hover:border-emerald-400'}`}
                        >
                          <div className={`text-3xl font-bold transition-colors ${cls.isComplete ? 'text-slate-500' : 'text-emerald-700 group-hover:text-emerald-500'}`}>{cls.class_level}</div>
                          <div className={`text-sm mt-3 font-medium px-3 py-1.5 rounded-full transition-colors ${cls.isComplete ? 'text-slate-500 bg-slate-100' : 'text-emerald-600 bg-emerald-50'}`}>
                            {cls.isComplete ? '✓ บันทึกครบถ้วน' : `นักเรียน ${cls.count} คน`}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: SCORES & SUBJECT DROPDOWN */}
              {currentStep === 2 && (
                <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 sm:p-6 animate-in slide-in-from-right-4">
                  
                  {/* PC Row เดียวเลย */}
                  <div className="bg-emerald-50/50 p-3 sm:p-4 rounded-xl border border-emerald-100 flex flex-col lg:flex-row gap-4 items-start lg:items-center mb-6 shadow-sm">
                    
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                      <button onClick={() => setCurrentStep(1)} className="text-emerald-600 hover:text-emerald-900 text-sm font-bold flex items-center gap-1.5 transition-colors bg-white border border-emerald-200 hover:border-emerald-400 px-3.5 py-2 rounded-lg whitespace-nowrap shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg> กลับ
                      </button>
                      <div className="w-px h-8 bg-emerald-200 hidden lg:block"></div>
                      <div className="flex flex-col whitespace-nowrap">
                        <span className="text-base font-bold text-emerald-800">{selectedRoom?.class_level}</span>
                        <span className="text-xs font-semibold text-emerald-600">ปีการศึกษา {selectedYear}</span>
                      </div>
                    </div>
                    
                    <div className="w-full h-px lg:hidden bg-emerald-200"></div>
                    
                    <div className="w-full lg:flex-1 flex flex-col sm:flex-row gap-3 lg:items-center lg:justify-end">
                      <div className="flex-1 max-w-md">
                        <select 
                          value={selectedSubject?.subject_code || ''} 
                          onChange={(e) => handleSelectSubject(e.target.value)}
                          className="w-full px-4 py-2 text-sm border-2 border-emerald-200 hover:border-emerald-400 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold bg-white text-emerald-800 cursor-pointer transition-colors shadow-sm"
                        >
                          {subjects.length === 0 ? <option value="">ไม่มีวิชา</option> : subjects.map(subj => (
                            <option key={subj.subject_code} value={subj.subject_code}>
                              {subj.subject_code} - {subj.subject_name} {isSubjectComplete(subj.subject_code) ? '✓ (กรอกครบ)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => setIsExportModalOpen(true)} className="px-5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap active:scale-95">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> 
                        ส่งออก
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full px-4 sm:px-0">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-y-2 border-emerald-100 bg-emerald-50/50">
                            <th className="px-2 sm:px-4 py-3 text-left text-xs text-sm font-bold text-emerald-800">ที่</th>
                            <th className="px-2 sm:px-4 py-3 text-left text-xs text-sm font-bold text-emerald-800">ชื่อ-นามสกุล</th>
                            <th className="px-2 sm:px-4 py-3 text-center text-xs text-sm font-bold text-emerald-800">เทอม 1 (50)</th>
                            <th className="px-2 sm:px-4 py-3 text-center text-xs text-sm font-bold text-emerald-800">เทอม 2 (50)</th>
                            <th className="px-2 sm:px-4 py-3 text-center text-xs text-sm font-bold text-emerald-900 bg-emerald-100/50">รวม / เกรด</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-50">
                          {(!selectedSubject || students.length === 0) ? (
                            <tr><td colSpan={5} className="text-center py-16 text-emerald-500 bg-emerald-50/20 font-medium">เลือกวิชาจากด้านบนเพื่อเริ่มกรอกคะแนน</td></tr>
                          ) : students.map((student, index) => {
                            const score1 = getStudentScore(student.student_code, selectedSubject.subject_code, 1);
                            const score2 = getStudentScore(student.student_code, selectedSubject.subject_code, 2);
                            const totalScore = score1 !== null && score2 !== null ? Number(score1) + Number(score2) : null;
                            const grade = totalScore !== null ? calculateGrade(totalScore, 100) : null;
                            
                            return (
                              <tr key={student.student_code} className="hover:bg-emerald-50/40 transition-colors">
                                <td 
                                  onDoubleClick={openReorderModal}
                                  title="ดับเบิลคลิกเพื่อจัดเรียงเลขที่"
                                  className="px-2 sm:px-4 py-3 text-xs sm:text-sm text-emerald-600 font-bold cursor-pointer hover:bg-emerald-100 transition-colors rounded-lg"
                                >
                                  {index + 1}
                                </td>
                                <td className={`px-2 sm:px-4 py-3 text-xs sm:text-sm transition-all select-none cursor-help ${student.status === 'ย้ายออก' ? 'opacity-40 grayscale italic' : ''}`}
                                  onMouseDown={() => handleLongPressStart(student)}
                                  onMouseUp={handleLongPressEnd}
                                  onMouseLeave={handleLongPressEnd}
                                  onTouchStart={() => handleLongPressStart(student)}
                                  onTouchEnd={handleLongPressEnd}
                                >
                                  <div className={`font-bold transition-colors ${student.status === 'ย้ายออก' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                    {student.student_name}
                                    {student.status === 'ซ้ำชั้น' && <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded border border-amber-200 uppercase font-black">ซ้ำชั้น</span>}
                                    {student.status === 'ย้ายออก' && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded border border-slate-200 uppercase font-black">ย้ายแล้ว</span>}
                                  </div>
                                  <div className="text-xs text-slate-400 font-mono mt-0.5">{student.student_code}</div>
                                </td>
                                <td className="px-2 sm:px-4 py-3 text-center">
                                  <input type="number" value={score1 ?? ''} min="0" max="50" placeholder="-"
                                    data-index={index} data-semester="1"
                                    onKeyDown={(e) => handleKeyDown(e, index, 1)}
                                    onChange={(e) => updateScoreRealtime(student.student_code, 1, e.target.value)}
                                    className="w-16 px-2 py-1.5 text-sm font-semibold border-2 border-slate-200 rounded-md text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow bg-white hover:border-emerald-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                </td>
                                <td className="px-2 sm:px-4 py-3 text-center">
                                  <input type="number" value={score2 ?? ''} min="0" max="50" placeholder="-"
                                    data-index={index} data-semester="2"
                                    onKeyDown={(e) => handleKeyDown(e, index, 2)}
                                    onChange={(e) => updateScoreRealtime(student.student_code, 2, e.target.value)}
                                    className="w-16 px-2 py-1.5 text-sm font-semibold border-2 border-slate-200 rounded-md text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow bg-white hover:border-emerald-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                </td>
                                <td className="px-2 sm:px-4 py-3 text-center bg-emerald-50/30">
                                  <div className="text-base font-bold flex items-center justify-center gap-1.5">
                                    <span className={totalScore !== null ? 'text-emerald-800' : 'text-emerald-300'}>{totalScore !== null ? totalScore : '-'}</span>
                                    <span className="text-emerald-300 text-sm font-normal">/</span>
                                    <span className={grade !== null ? (Number(grade) >= 2 ? 'text-emerald-600' : 'text-red-500') : 'text-emerald-300'}>{grade !== null ? grade : '-'}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* =========== TAB: ADMIN =========== */}
          {activeTab === 'admin' && (
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 animate-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold text-emerald-800 mb-6">ผู้ดูแลระบบ (Admin)</h2>
              
              <div className="mb-6 bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center gap-4">
                <label className="text-sm font-bold text-emerald-700">เลือกดูข้อมูลห้องเรียน:</label>
                <select 
                  value={adminSelectedRoom} 
                  onChange={(e) => {setAdminSelectedRoom(e.target.value); setIsBulkEditSubjects(false);}}
                  className="w-48 px-4 py-2 text-sm border-2 border-emerald-200 hover:border-emerald-400 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold bg-white text-emerald-800 cursor-pointer transition-colors shadow-sm"
                >
                  <option value="">-- เลือกห้องเรียน --</option>
                  {adminRoomsList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {adminSelectedRoom ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* กล่องรายชื่อนักเรียน */}
                  <div className="border border-emerald-100 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex justify-between items-center">
                      <h3 className="font-bold text-emerald-800">รายชื่อนักเรียน</h3>
                      <span className="text-xs font-bold bg-white border border-emerald-200 text-emerald-600 px-2 py-1 rounded-md">{adminStudents.length} คน</span>
                    </div>
                    <ul className="divide-y divide-emerald-50 max-h-[400px] overflow-y-auto bg-white p-2">
                      {adminStudents.length > 0 ? adminStudents.map((st, idx) => (
                        <li key={st.student_code} className="p-2 hover:bg-emerald-50/50 rounded-lg flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">{idx + 1}. {st.student_name}</span>
                          <span className="text-xs text-slate-400 font-mono">{st.student_code}</span>
                        </li>
                      )) : <li className="p-4 text-center text-sm text-emerald-400 font-medium">ไม่มีข้อมูลนักเรียน</li>}
                    </ul>
                  </div>

                  {/* กล่องรายวิชา (แก้แบบ Bulk) */}
                  <div className="border border-emerald-100 rounded-xl overflow-hidden shadow-sm flex flex-col">
                    <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex justify-between items-center">
                      <h3 className="font-bold text-emerald-800">วิชาที่สอน</h3>
                      {!isBulkEditSubjects ? (
                        <button onClick={startBulkEditSubjects} className="text-xs font-bold bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-100 px-3 py-1 rounded-md transition-colors">
                          ✏️ แก้ไขแบบกลุ่ม (นำเข้า/แก้)
                        </button>
                      ) : (
                        <button onClick={saveBulkSubjects} className="text-xs font-bold bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 px-3 py-1 rounded-md transition-colors">
                          💾 บันทึกวิชา
                        </button>
                      )}
                    </div>
                    
                    <div className="flex-1 bg-white p-2 flex flex-col min-h-[400px] max-h-[400px]">
                      {isBulkEditSubjects ? (
                        <>
                          <div className="flex justify-between items-center mb-2 px-2">
                             <p className="text-[10px] text-emerald-600 font-medium">รูปแบบ: รหัสวิชา (Tab) ชื่อวิชา (Tab) คะแนน</p>
                             <button 
                               onClick={loadTemplateFromD1}
                               className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-1 rounded hover:bg-sky-100 transition-colors font-bold flex items-center gap-1"
                             >
                               📥 โหลดเทมเพลตจาก D1
                             </button>
                          </div>
                          <textarea 
                            value={bulkSubjectText}
                            onChange={(e) => setBulkSubjectText(e.target.value)}
                            className="w-full flex-1 p-3 text-sm border-2 border-emerald-100 rounded-lg focus:border-emerald-400 outline-none font-mono whitespace-pre resize-none bg-slate-50"
                            placeholder={"ท11101\tภาษาไทย\t100\nค11101\tคณิตศาสตร์\t100"}
                          />
                        </>
                      ) : (
                        <ul className="divide-y divide-emerald-50 overflow-y-auto flex-1">
                          {adminSubjects.length > 0 ? adminSubjects.map((sb) => (
                            <li key={sb.subject_code} className="p-2 hover:bg-emerald-50/50 rounded-lg flex flex-col">
                              <span className="text-sm font-semibold text-slate-700">{sb.subject_name}</span>
                              <span className="text-xs text-emerald-600 mt-1">รหัส: {sb.subject_code} | คะแนนเต็ม: {sb.max_score}</span>
                            </li>
                          )) : <li className="p-4 text-center text-sm text-emerald-400 font-medium mt-10">ไม่มีข้อมูลวิชา</li>}
                        </ul>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-12 text-emerald-500 border-2 border-dashed border-emerald-100 rounded-xl bg-emerald-50/30">
                  <p className="font-medium">กรุณาเลือกห้องเรียนด้านบนเพื่อดูหรือแก้ไขข้อมูล</p>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Admin Auth Modal */}
      {showAdminAuth && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-emerald-900">รหัสผ่านผู้ดูแลระบบ</h3>
            </div>
            
            <input 
              type="password" 
              value={adminPwd} 
              onChange={e => setAdminPwd(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && verifyAdmin()}
              placeholder="กรอกรหัสผ่าน" 
              className="w-full px-4 py-3 text-center text-lg tracking-widest border-2 border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold bg-slate-50 mb-4" 
              autoFocus
            />
            
            <div className="flex gap-3">
              <button onClick={() => {setShowAdminAuth(false); setAdminPwd('');}} className="flex-1 py-2.5 text-sm border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button onClick={verifyAdmin} className="flex-1 py-2.5 text-sm bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
            <h3 className="text-xl font-bold text-emerald-900 mb-1">เลือกการส่งออก</h3>
            <p className="text-sm font-medium text-emerald-600 mb-6">ข้อมูลของชั้น {selectedRoom?.class_level}</p>
            
            <div className="space-y-3">
              <button onClick={exportPDFBlob} className="w-full px-4 py-3 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-2 border-indigo-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                ส่งออก ปพ.6 (PDF รายบุคคล)
              </button>
              <button onClick={exportExcelAllSubjects} className="w-full px-4 py-3 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                ส่งออกทุกวิชา (Excel)
              </button>
            </div>
            <button onClick={() => setIsExportModalOpen(false)} className="w-full mt-5 py-2 text-slate-400 hover:text-slate-600 text-sm font-bold transition-colors underline underline-offset-4">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Reorder Modal */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col max-h-[80vh]">
            <h3 className="text-xl font-bold text-emerald-900 mb-1">จัดเรียงเลขที่นักเรียน</h3>
            <p className="text-sm font-medium text-emerald-600 mb-4">ลากรายชื่อเพื่อสลับตำแหน่ง (ลากขึ้น-ลง)</p>
            
            <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-2">
              {reorderStudents.map((st, idx) => (
                <li 
                  key={st.student_code}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={handleDrop}
                  onDragEnd={() => setDraggedIdx(null)}
                  className={`p-3 flex items-center gap-3 bg-white hover:bg-slate-50 cursor-grab active:cursor-grabbing border border-transparent rounded-lg transition-all ${draggedIdx === idx ? 'opacity-50 border-emerald-300 shadow-sm' : ''}`}
                >
                  <span className="w-8 h-8 flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold rounded-lg shrink-0">{idx + 1}</span>
                  <div className="flex-1">
                    <div className="font-bold text-slate-700 text-sm">{st.student_name}</div>
                    <div className="text-xs text-slate-400 font-mono">{st.student_code}</div>
                  </div>
                  <div className="text-slate-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
                  </div>
                </li>
              ))}
            </ul>
            
            <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
              <button onClick={() => setIsReorderModalOpen(false)} className="flex-1 py-2 text-sm border-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors">
                ยกเลิก
              </button>
              <button onClick={saveReorder} className="flex-1 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold transition-colors">
                บันทึกเลขที่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Status Modal */}
      {selectedStudentStatus && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
            <h3 className="text-xl font-bold text-emerald-900 mb-1">จัดการสถานะนักเรียน</h3>
            <p className="text-sm font-medium text-emerald-600 mb-6">{selectedStudentStatus.student_name}</p>
            
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => updateStudentStatus('ปกติ')}
                className={`w-full px-4 py-3 text-sm rounded-xl font-bold transition-all flex items-center justify-between border-2 ${selectedStudentStatus.status === 'ปกติ' || !selectedStudentStatus.status ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-600 hover:border-emerald-200'}`}
              >
                <span>สถานะปกติ</span>
                {(!selectedStudentStatus.status || selectedStudentStatus.status === 'ปกติ') && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
              </button>
              
              <button 
                onClick={() => updateStudentStatus('ย้ายออก')}
                className={`w-full px-4 py-3 text-sm rounded-xl font-bold transition-all flex items-center justify-between border-2 ${selectedStudentStatus.status === 'ย้ายออก' ? 'bg-slate-50 border-slate-500 text-slate-700' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'}`}
              >
                <span>ย้ายออก</span>
                {selectedStudentStatus.status === 'ย้ายออก' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
              </button>
              
              <button 
                onClick={() => updateStudentStatus('ซ้ำชั้น')}
                className={`w-full px-4 py-3 text-sm rounded-xl font-bold transition-all flex items-center justify-between border-2 ${selectedStudentStatus.status === 'ซ้ำชั้น' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-slate-100 text-slate-600 hover:border-amber-200'}`}
              >
                <span>เรียนซ้ำชั้น</span>
                {selectedStudentStatus.status === 'ซ้ำชั้น' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
              </button>
            </div>
            
            <button 
              onClick={() => setSelectedStudentStatus(null)}
              className="w-full mt-6 py-2 text-slate-400 hover:text-slate-600 text-sm font-bold transition-colors underline underline-offset-4"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className={`fixed bottom-4 right-4 bg-emerald-800 text-white px-5 py-3 rounded-xl shadow-lg transform transition-all duration-300 z-[60] font-bold ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
