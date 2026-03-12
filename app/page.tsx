"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

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

const calculateGrade = (score: number | null | undefined, maxScore = 100) => {
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
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStudentForView, setSelectedStudentForView] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [reportType, setReportType] = useState<'pp1' | 'pp6'>('pp6');

  // Subject Locking & Admin
  const [unlockedSubjects, setUnlockedSubjects] = useState<string[]>([]);
  const [isSubjectAdminModalOpen, setIsSubjectAdminModalOpen] = useState(false);
  const [subjectAdminData, setSubjectAdminData] = useState<any>(null);
  const [adminAuthInput, setAdminAuthInput] = useState('');
  const [moveTargetCode, setMoveTargetCode] = useState('');

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

  // ============ AUTO BACKUP ============
  useEffect(() => {
    const backupInterval = setInterval(async () => {
      if (allData.length > 0) {
        try {
          const studentsData = allData.filter(d => d.type === 'student');
          const subjectsData = allData.filter(d => d.type === 'subject');
          const scoresData = allData.filter(d => d.type === 'score');

          await fetch('/api/telegram-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              students: studentsData,
              subjects: subjectsData,
              scores: scoresData,
              academicYear: selectedYear
            })
          });
          console.log('✅ Auto-backup to Telegram success');
        } catch (e) {
          console.error('❌ Auto-backup failed:', e);
        }
      }
    }, 120000); // 2 minutes

    return () => clearInterval(backupInterval);
  }, [allData, selectedYear]);

  const restoreFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const dataToImport = json.data || json; // รองรับทั้งรูปแบบ backup และ raw json

        let processedData: any[] = [];
        if (Array.isArray(dataToImport)) {
          processedData = dataToImport;
        } else if (dataToImport.students || dataToImport.subjects || dataToImport.scores) {
          // ถ้ามาเป็น object แยกหมวด
          if (dataToImport.students) processedData.push(...dataToImport.students.map((s: any) => ({ ...s, type: 'student' })));
          if (dataToImport.subjects) processedData.push(...dataToImport.subjects.map((s: any) => ({ ...s, type: 'subject' })));
          if (dataToImport.scores) processedData.push(...dataToImport.scores.map((s: any) => ({ ...s, type: 'score' })));
        }

        if (processedData.length > 0) {
          if (confirm(`พบข้อมูล ${processedData.length} รายการ ต้องการกู้คืนใช่หรือไม่? (ข้อมูลเดิมจะถูกเขียนทับด้วย ID ที่ตรงกัน)`)) {
            setAllData(processedData);
            if (window.dataSdk) window.dataSdk.syncAll(processedData);
            showToast('กู้คืนข้อมูลสำเร็จ');
          }
        } else {
          showToast('❌ ไม่พบข้อมูลที่ถูกต้องในไฟล์');
        }
      } catch (err) {
        showToast('❌ รูปแบบไฟล์ไม่ถูกต้อง');
      }
    };
    reader.readAsText(file);
  };

  const exportFullCSV = () => {
    if (!adminSelectedRoom || adminStudents.length === 0) return showToast('กรุณาเลือกห้องเรียน');

    // โครงสร้าง Header แบบเป๊ะ 100% ตามต้นฉบับ ปพ.1 ชั้น ป.6
    let headerRow = ['#', 'รหัสนักเรียน', 'ชื่อ-สกุล'];

    // รายวิชาพื้นฐาน/เพิ่มเติม 6 ปี
    const yearHeaders = [
      { year: 2562, level: '1', subjects: ['ท11101 ภาษาไทย 1', 'ค11101 คณิตศาสตร์พื้นฐาน 1', 'ว11101 พื้นฐานวิทยาศาสตร์ 1', 'ส11101 สังคมศึกษา ศาสนาและวัฒนธรรม 1', 'ส11102 ประวัติศาสตร์ 1', 'พ11101 สุขศึกษาและพลศึกษา 1', 'ศ11101 ศิลปะ 1', 'ง11101 การงานอาชีพและเทคโนโลยี 1', 'อ11101 ภาษาอังกฤษพื้นฐาน 1', '', 'ส11201 หน้าที่พลเมือง 1', 'ส11202 การป้องกันการทุจริต 1'] },
      { year: 2563, level: '2', subjects: ['ท12101 ภาษาไทย 2', 'ค12101 คณิตศาสตร์พื้นฐาน 2', 'ว12101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 2', 'ส12101 สังคมศึกษา ศาสนาและวัฒนธรรม 2', 'ส12102 ประวัติศาสตร์ 2', 'พ12101 สุขศึกษาและพลศึกษา 2', 'ศ12101 ศิลปะ 2', 'ง12101 การงานพื้นฐานอาชีพ 2', 'อ12101 ภาษาอังกฤษพื้นฐาน 2', '', 'ส12201 หน้าที่พลเมือง 2', 'ส12202 การป้องกันการทุจริต 2'] },
      { year: 2564, level: '3', subjects: ['ท13101 ภาษาไทย 3', 'ค13101 คณิตศาสตร์พื้นฐาน 3', 'ว13101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 3', 'ส13101 สังคมศึกษา ศาสนาและวัฒนธรรม  3', 'ส13102 ประวัติศาสตร์ 3', 'พ13101 สุขศึกษาและพลศึกษา 3', 'ศ13101 ศิลปะ 3', 'ง13101 การงานพื้นฐานอาชีพ 3', 'อ13101 ภาษาอังกฤษพื้นฐาน 3', '', 'ส13201 หน้าที่พลเมือง 3', 'ส13202 การป้องกันการทุจริต 3'] },
      { year: 2565, level: '4', subjects: ['ท14101 ภาษาไทย 4', 'ค14101 คณิตศาสตร์พื้นฐาน 4', 'ว14101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 4', 'ส14101 สังคมศึกษา ศาสนาและวัฒนธรรม 4', 'ส14102 ประวัติศาสตร์ 4', 'พ14101 สุขศึกษาและพลศึกษา 4', 'ศ14101 ศิลปะ 4', 'ง14101 การงานพื้นฐานอาชีพ 4', 'อ14101 ภาษาอังกฤษพื้นฐาน 4', '', 'ส14201 หน้าที่พลเมือง 4', 'ส14202 การป้องกันการทุจริต 4'] },
      { year: 2566, level: '5', subjects: ['ท15101 ภาษาไทย 5', 'ค15101 คณิตศาสตร์พื้นฐาน 5', 'ว15101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 5', 'ส15101 สังคมศึกษา ศาสนาและวัฒนธรรม 5', 'ส15102 ประวัติศาสตร์ 5', 'พ15101 สุขศึกษาและพลศึกษา 5', 'ศ15101 ศิลปะ 5', 'ง15101 การงานพื้นฐานอาชีพ 5', 'อ15101 ภาษาอังกฤษพื้นฐาน 5', '', 'ส15201 หน้าที่พลเมือง 5', 'ส15202 การป้องกันการทุจริต 5'] },
      { year: 2567, level: '6', subjects: ['ท16101 ภาษาไทย 6', 'ค16101 คณิตศาสตร์พื้นฐาน 6', 'ว16101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 6', 'ส16101 สังคมศึกษา ศาสนาและวัฒนธรรม 6', 'ส16102 ประวัติศาสตร์ 6', 'พ16101 สุขศึกษาและพลศึกษา 6', 'ศ16101 ศิลปะ 6', 'ง16101 การงานพื้นฐานอาชีพ 6', 'อ16101 ภาษาอังกฤษพื้นฐาน 6', '', 'ส16201 หน้าที่พลเมือง 6', 'ส16202 การป้องกันการทุจริต 6'] }
    ];

    yearHeaders.forEach(y => {
      headerRow.push(`${y.year} ชั้นประถมศึกษาปีที่ ${y.level}`);
      headerRow.push('');
      y.subjects.forEach(s => headerRow.push(s));
    });

    // กิจกรรมพัฒนาผู้เรียน
    const activities = [
      { year: 2562, subs: ['ก11901 แนะแนว 1', 'ก11902 ลูกเสือ-เนตรนารี 1', 'ก11903 สนุกกับศิลปะ', 'ก11904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] },
      { year: 2563, subs: ['ก12901 แนะแนว 2', 'ก12902 ลูกเสือ-เนตรนารี 2', 'ก12903 การละเล่นพื้นบ้าน', 'ก12904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] },
      { year: 2564, subs: ['ก13901 แนะแนว 3', 'ก13902 ลูกเสือ-เนตรนารี 3', 'ก13903 ชุมนุมศิลปะการพับกระดาษ', 'ก13904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] },
      { year: 2565, subs: ['ก14901 แนะแนว 4', 'ก14902 ลูกเสือ-เนตรนารี 4', 'ก14903 ชุมนุมกีฬา1', 'ก14904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] },
      { year: 2566, subs: ['ก15901 แนะแนว 5', 'ก15902 ลูกเสือ-เนตรนารี 5', 'ก15903 ชุมนุมกีฬา2', 'ก15904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] },
      { year: 2567, subs: ['ก16901 แนะแนว 6', 'ก16902 ลูกเสือ-เนตรนารี 6', 'ก16903 ชุมนุมกีฬา3', 'ก16904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] }
    ];

    activities.forEach(a => {
      headerRow.push(a.year.toString());
      a.subs.forEach(s => headerRow.push(s));
    });

    let csvContent = headerRow.join(',') + '\n';

    adminStudents.forEach((student, index) => {
      let row: any[] = [index + 1, student.student_code, student.student_name];

      // ข้อมูลคะแนน 6 ปี
      yearHeaders.forEach(y => {
        row.push(''); row.push(''); // คอลัมน์ว่างตามหัวตารางชั้นเรียน
        y.subjects.forEach(s => {
          if (s === '') {
            row.push('');
          } else {
            const code = s.split(' ')[0];
            const s1 = getStudentScore(student.student_code, code, 1, y.year);
            const s2 = getStudentScore(student.student_code, code, 2, y.year);
            if (s1 !== null && s2 !== null) {
              row.push(calculateGrade(Number(s1) + Number(s2), 100));
            } else if (s1 !== null || s2 !== null) {
              row.push(calculateGrade(Number(s1 ?? s2) * 2, 100));
            } else {
              row.push('');
            }
          }
        });
      });

      // ข้อมูลกิจกรรม
      activities.forEach(a => {
        row.push(''); // คอลัมน์ว่างตามปีการศึกษา
        a.subs.forEach(s => {
          const code = s.split(' ')[0];
          const s1 = getStudentScore(student.student_code, code, 1, a.year);
          const s2 = getStudentScore(student.student_code, code, 2, a.year);
          const pass = (s1 === 'ผ' || s2 === 'ผ' || Number(s1) > 0 || Number(s2) > 0) ? 'ผ' : (s1 || s2 ? 'มผ' : '');
          row.push(pass);
        });
      });
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `บันทึกคะแนน_ปพ1_ชั้น_${adminSelectedRoom}_${new Date().getFullYear()}.csv`;
    link.click();
    showToast('ส่งออก CSV ปพ.1 เป๊ะ 100% เรียบร้อยแล้ว');
  };

  const getStudentScore = (studentCode: string, subjCode: string, semester: number, year: number | string | null = null) => {
    const targetYear = year ? Number(year) : Number(selectedYear);
    const scoreItem = allData.find(d =>
      d.type === 'score' &&
      d.student_code === studentCode &&
      d.subject_code === subjCode &&
      d.year === targetYear &&
      d.semester === semester
    );
    return scoreItem ? scoreItem.score : null;
  };

  // ============ LONG PRESS STATUS ACTIONS ============
  const handleLongPressStart = (student: any) => {
    longPressTimer.current = setTimeout(() => {
      setSelectedStudentStatus(student);
      const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-20.mp3');
      audio.volume = 0.2;
      audio.play().catch(() => { }); // Play subtle feedback if allowed
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
    // Format: รหัสวิชา (Tab) ชื่อวิชา (Tab) คะแนนเต็ม (Tab) ประเภท (Tab) ชั่วโมง
    const text = adminSubjects.map(s => `${s.subject_code}\t${s.subject_name}\t${s.max_score || 100}\t${s.type || 'พื้นฐาน'}\t${s.credit || 1}`).join('\n');
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

    const text = templates.map(s => `${s.subject_code}\t${s.subject_name}\t${s.max_score || 100}\t${s.subject_type || 'พื้นฐาน'}\t${s.credit || 1}`).join('\n');
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
      const parts = line.split('\t');
      const code = parts[0]?.trim();
      const name = parts[1]?.trim();
      const maxScore = Number(parts[2]) || 100;
      const subType = parts[3]?.trim() || 'พื้นฐาน';
      const credit = Number(parts[4]) || 1;

      if (code && name) {
        const newSubj = {
          type: 'subject',
          subject_code: code,
          subject_name: name,
          class_level: adminSelectedRoom,
          max_score: maxScore,
          subject_type: subType, // พื้นฐาน / เพิ่มเติม / กิจกรรม
          credit: credit, // จำนวนชั่วโมง หรือ หน่วยกิต
          year: 0,
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

  const modifySubject = () => {
    if (adminAuthInput !== '31020177') return showToast('⚠️ รหัสผ่านไม่ถูกต้อง');
    if (!subjectAdminData) return;

    let newData = [...allData];
    const idx = newData.findIndex(d => d.type === 'subject' && d.subject_code === subjectAdminData.subject_code && d.class_level === (adminSelectedRoom || selectedRoom?.class_level));
    
    if (idx >= 0) {
      newData[idx] = { ...newData[idx], ...subjectAdminData };
      setAllData(newData);
      if (window.dataSdk) window.dataSdk.update(newData[idx]);
      showToast('แก้ไขข้อมูลวิชาเรียบร้อยแล้ว');
      setIsSubjectAdminModalOpen(false);
    }
  };

  const moveScoresToSubject = () => {
    if (adminAuthInput !== '31020177') return showToast('⚠️ รหัสผ่านไม่ถูกต้อง');
    if (!subjectAdminData || !moveTargetCode) return showToast('กรุณาระบุรหัสวิชาปลายทาง');

    let newData = [...allData];
    let count = 0;
    
    newData = newData.map(d => {
      if (d.type === 'score' && d.subject_code === subjectAdminData.subject_code && d.year === Number(selectedYear)) {
        count++;
        return { ...d, subject_code: moveTargetCode.trim() };
      }
      return d;
    });

    if (count > 0) {
      setAllData(newData);
      if (window.dataSdk) window.dataSdk.syncAll(newData);
      showToast(`ย้ายคะแนนสำเร็จ ${count} รายการ ไปยังวิชา ${moveTargetCode}`);
      setIsSubjectAdminModalOpen(false);
    } else {
      showToast('ไม่พบข้อมูลคะแนนในวิชานี้');
    }
  };

  const unlockSelectedSubject = () => {
    if (adminAuthInput !== '31020177') return showToast('⚠️ รหัสผ่านไม่ถูกต้อง');
    if (!subjectAdminData) return;
    
    setUnlockedSubjects(prev => [...prev, subjectAdminData.subject_code]);
    showToast(`ปลดล็อควิชา ${subjectAdminData.subject_code} เรียบร้อย (เฉพาะเซสชั่นนี้)`);
    setIsSubjectAdminModalOpen(false);
  };

  // ============ EXPORT ============

  // --- รายงาน ปพ.6 (รายปี) ---
  const exportPP6PDF = async (targetStudent: any = null, returnBlob = false) => {
    const studentList = targetStudent ? [targetStudent] : students;
    if (!selectedRoom || subjects.length === 0 || studentList.length === 0) return showToast('ไม่มีข้อมูลให้ส่งออก');

    if (!returnBlob) showToast('กำลังเตรียมไฟล์ PDF ปพ.6...');

    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      const [fontBytes, fontBoldBytes] = await Promise.all([
        fetch('https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNew.ttf').then(res => res.arrayBuffer()),
        fetch('https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNewBold.ttf').then(res => res.arrayBuffer())
      ]);
      const thaiFont = await pdfDoc.embedFont(fontBytes);
      const thaiFontBold = await pdfDoc.embedFont(fontBoldBytes);

      for (const student of studentList) {
        const page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        let y = height - 60;

        // Header ปพ.6
        page.drawText('รายงานผลพัฒนาคุณภาพผู้เรียนรายบุคคล ( ปพ.6 )', { x: width / 2 - 160, y, size: 22, font: thaiFontBold });
        y -= 35;
        page.drawText(`โรงเรียน${schoolName}`, { x: width / 2 - 80, y, size: 18, font: thaiFontBold });
        y -= 45;

        page.drawText(`ชื่อ-นามสกุล: ${student.student_name}`, { x: 50, y, size: 16, font: thaiFontBold });
        page.drawText(`เลขประจำตัว: ${student.student_code}`, { x: 330, y, size: 16, font: thaiFont });
        y -= 25;
        page.drawText(`ชั้น: ${selectedRoom.class_level}  ปีการศึกษา: ${selectedYear}`, { x: 50, y, size: 16, font: thaiFont });
        y -= 45;

        // ตารางคะแนนรายปี (ดีไซน์ใหม่ ตัวใหญ่)
        const colWidths = [40, 80, 200, 50, 50, 45, 45, 45, 40];
        const headers = ['ที่', 'รหัสวิชา', 'รายวิชา', 'ประเภท', 'นก/ชม', 'ท.1', 'ท.2', 'รวม', 'เกรด'];

        // Draw Header Row
        let curX = 25;
        const rowHeight = 30;
        page.drawRectangle({ x: 25, y: y - rowHeight, width: 545, height: rowHeight, color: rgb(0.95, 0.95, 0.95), borderColor: rgb(0, 0, 0), borderWidth: 1.5 });
        headers.forEach((h, i) => {
          page.drawText(h, { x: curX + (i === 2 ? 10 : 5), y: y - 21, size: 14, font: thaiFontBold });
          curX += colWidths[i];
        });
        y -= rowHeight;

        // Draw Data Rows
        subjects.forEach((subj, idx) => {
          const s1 = getStudentScore(student.student_code, subj.subject_code, 1);
          const s2 = getStudentScore(student.student_code, subj.subject_code, 2);
          const total = s1 !== null && s2 !== null ? Number(s1) + Number(s2) : (s1 !== null ? Number(s1) * 2 : (s2 !== null ? Number(s2) * 2 : null));
          const grade = total !== null ? calculateGrade(total) : '';

          let type = subj.subject_name.includes("เพิ่มเติม") ? "พ" : (subj.subject_name.includes("กิจกรรม") ? "ก" : "บ");

          let rX = 25;
          const rowData = [idx + 1, subj.subject_code, subj.subject_name.slice(0, 30), type, (type === 'บ' ? 80 : 40), s1 ?? '-', s2 ?? '-', total ?? '-', grade];

          page.drawRectangle({ x: 25, y: y - rowHeight, width: 545, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
          rowData.forEach((val, i) => {
            const fontSize = i === 2 ? 14 : 14;
            const align = (i === 2) ? 10 : (colWidths[i] / 2 - 8);
            page.drawText(String(val), { x: rX + align, y: y - 21, size: fontSize, font: i === 8 ? thaiFontBold : thaiFont });
            rX += colWidths[i];
          });
          y -= rowHeight;

          if (y < 150) { // New page if needed
            // จริงๆ ปพ.6 ควรจบในหน้าเดียวสำหรับประถม
          }
        });

        // Signatures (ตัวใหญ่ขึ้น)
        y = 100;
        page.drawText('( ........................................................... )', { x: 50, y, size: 14, font: thaiFont });
        page.drawText('( ........................................................... )', { x: 330, y, size: 14, font: thaiFont });
        y -= 25;
        page.drawText('ครูประจำชั้น', { x: 120, y, size: 14, font: thaiFontBold });
        page.drawText('ผู้อำนวยการโรงเรียน', { x: 380, y, size: 14, font: thaiFontBold });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });

      if (returnBlob) return blob;

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      showToast('ส่งออก ปพ.6 สำเร็จ');
      setIsExportModalOpen(false);
    } catch (err) { console.error(err); showToast('❌ เกิดข้อผิดพลาด'); }
  };

  // --- รายงาน ปพ.1 (ระเบียนสะสม ทุกปี - เป๊ะ 100% โคลนต้นฉบับ) ---
  const exportPP1PDF = async (targetStudent: any = null, returnBlob = false) => {
    const studentList = targetStudent ? [targetStudent] : students;
    if (!selectedRoom || studentList.length === 0) return showToast('ไม่มีข้อมูลนักเรียน');
    if (!returnBlob) showToast('กำลังเตรียมไฟล์ PDF ปพ.1 (รูปแบบเหมือนต้นฉบับ 100%)...');

    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      const [fontBytes, fontBoldBytes] = await Promise.all([
        fetch('https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNew.ttf').then(res => res.arrayBuffer()),
        fetch('https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNewBold.ttf').then(res => res.arrayBuffer())
      ]);
      const thaiFont = await pdfDoc.embedFont(fontBytes);
      const thaiFontBold = await pdfDoc.embedFont(fontBoldBytes);

      const yearsGroups = [
        [2561, 2562], // Col 1
        [2563, 2564], // Col 2
        [2565, 2566]  // Col 3
      ];

      for (const student of studentList) {
        // ================= PAGE 1 =================
        const page1 = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page1.getSize();

        let y = height - 40;
        const fontSize = 11;

        // --- Header Left ---
        page1.drawText('โรงเรียน', { x: 30, y, size: fontSize, font: thaiFontBold });
        page1.drawText(schoolName, { x: 90, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('สังกัด', { x: 30, y, size: fontSize, font: thaiFontBold });
        page1.drawText('สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน', { x: 90, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('ตำบล/แขวง', { x: 30, y, size: fontSize, font: thaiFontBold });
        page1.drawText('ปราสาท', { x: 90, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('เขต/อำเภอ', { x: 30, y, size: fontSize, font: thaiFontBold });
        page1.drawText('บ้านกรวด', { x: 90, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('จังหวัด', { x: 30, y, size: fontSize, font: thaiFontBold });
        page1.drawText('บุรีรัมย์', { x: 90, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('สำนักงานเขตพื้นที่การศึกษา', { x: 30, y, size: fontSize, font: thaiFontBold });
        page1.drawText('ประถมศึกษาบุรีรัมย์ เขต 2', { x: 130, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('วันเข้าเรียน', { x: 30, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 90, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('โรงเรียนเดิม', { x: 30, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 90, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('จังหวัด', { x: 30, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 90, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('ชั้นเรียนสุดท้าย', { x: 30, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 90, y, size: fontSize, font: thaiFont });

        // --- Header Right ---
        y = height - 70;
        const rawName = student.student_name.split(' ');
        const fName = rawName[0] || '';
        const lName = rawName[1] || '';

        page1.drawText('ชื่อ', { x: 280, y, size: fontSize, font: thaiFontBold });
        page1.drawText(fName, { x: 330, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('ชื่อสกุล', { x: 280, y, size: fontSize, font: thaiFontBold });
        page1.drawText(lName, { x: 330, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('เลขประจำตัวนักเรียน', { x: 280, y, size: fontSize, font: thaiFontBold });
        page1.drawText(student.student_code, { x: 360, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('เลขประจำตัวประชาชน', { x: 280, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 360, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('เกิดวันที่', { x: 280, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 320, y, size: fontSize, font: thaiFont });
        page1.drawText('เดือน', { x: 350, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 380, y, size: fontSize, font: thaiFont });
        page1.drawText('พ.ศ.', { x: 420, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 440, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('เพศ', { x: 280, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 310, y, size: fontSize, font: thaiFont });
        page1.drawText('สัญชาติ', { x: 350, y, size: fontSize, font: thaiFontBold });
        page1.drawText('ไทย', { x: 390, y, size: fontSize, font: thaiFont });
        page1.drawText('ศาสนา', { x: 430, y, size: fontSize, font: thaiFontBold });
        page1.drawText('พุทธ', { x: 460, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('ชื่อ-ชื่อสกุลบิดา', { x: 280, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 350, y, size: fontSize, font: thaiFont });
        y -= 15;
        page1.drawText('ชื่อ-ชื่อสกุลมารดา', { x: 280, y, size: fontSize, font: thaiFontBold });
        page1.drawText('-', { x: 350, y, size: fontSize, font: thaiFont });

        // Photo Box
        page1.drawRectangle({ x: 500, y: height - 150, width: 70, height: 90, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });

        // --- Table 1 Title ---
        y = height - 230;
        page1.drawText('ผลการเรียนรายวิชา', { x: width / 2 - 40, y, size: 14, font: thaiFontBold });

        // --- Table 1 Structure ---
        const tableYStart = y - 10;
        const tableHeight = 520; // extend down
        const tableYEnd = tableYStart - tableHeight;
        const colStartX = 25;
        const colWidth = 181.6;

        // Outer box
        page1.drawRectangle({ x: colStartX, y: tableYEnd, width: 545, height: tableHeight, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
        // Vertical lines for major columns
        page1.drawLine({ start: { x: colStartX + colWidth, y: tableYStart }, end: { x: colStartX + colWidth, y: tableYEnd }, thickness: 0.5, color: rgb(0, 0, 0) });
        page1.drawLine({ start: { x: colStartX + colWidth * 2, y: tableYStart }, end: { x: colStartX + colWidth * 2, y: tableYEnd }, thickness: 0.5, color: rgb(0, 0, 0) });
        // Header horizontal line
        const headerHeight = 40;
        page1.drawLine({ start: { x: colStartX, y: tableYStart - headerHeight }, end: { x: colStartX + 545, y: tableYStart - headerHeight }, thickness: 0.5, color: rgb(0, 0, 0) });

        // Draw Sub-columns vertical lines and headers
        const subCol1W = 140;
        const subCol2W = 20;

        for (let c = 0; c < 3; c++) {
          const cx = colStartX + (c * colWidth);
          // Vertical lines for sub-cols
          page1.drawLine({ start: { x: cx + subCol1W, y: tableYStart }, end: { x: cx + subCol1W, y: tableYEnd }, thickness: 0.5, color: rgb(0, 0, 0) });
          page1.drawLine({ start: { x: cx + subCol1W + subCol2W, y: tableYStart }, end: { x: cx + subCol1W + subCol2W, y: tableYEnd }, thickness: 0.5, color: rgb(0, 0, 0) });

          // Header Texts
          page1.drawText('รหัส/รายวิชา', { x: cx + 45, y: tableYStart - 25, size: 10, font: thaiFontBold });

          // Rotated texts
          page1.drawText('เวลา(ชั่วโมง)', { x: cx + subCol1W + 13, y: tableYStart - 35, size: 9, font: thaiFontBold, rotate: degrees(90) });
          page1.drawText('ผลการเรียน', { x: cx + subCol1W + subCol2W + 13, y: tableYStart - 35, size: 9, font: thaiFontBold, rotate: degrees(90) });
        }

        // --- Table 1 Data ---
        for (let c = 0; c < 3; c++) {
          let curY = tableYStart - headerHeight - 12;
          const cx = colStartX + (c * colWidth);
          const years = yearsGroups[c];

          years.forEach(yr => {
            const gradeLevel = yr - 2560;
            page1.drawText(`ปีการศึกษา ${yr} ชั้นประถมศึกษาปีที่ ${gradeLevel}`, { x: cx + 2, y: curY, size: 10, font: thaiFontBold });
            curY -= 12;

            // พื้นฐาน
            page1.drawText(`รายวิชาพื้นฐาน`, { x: cx + 2, y: curY, size: 10, font: thaiFontBold });
            curY -= 12;

            const baseSubjects = allData.filter(d => d.type === 'subject' && d.class_level.includes(gradeLevel.toString()) && (d.subject_name.includes('พื้นฐาน') || (!d.subject_name.includes('เพิ่มเติม') && !d.subject_name.includes('กิจกรรม'))));
            baseSubjects.forEach(sub => {
              const s1 = getStudentScore(student.student_code, sub.subject_code, 1, yr);
              const s2 = getStudentScore(student.student_code, sub.subject_code, 2, yr);
              const total = (s1 !== null && s2 !== null) ? Number(s1) + Number(s2) : null;
              const grade = total !== null ? calculateGrade(total) : '';

              page1.drawText(`${sub.subject_code} ${sub.subject_name.slice(0, 25)}`, { x: cx + 2, y: curY, size: 9, font: thaiFont });
              page1.drawText('80', { x: cx + subCol1W + 5, y: curY, size: 9, font: thaiFont });
              page1.drawText(String(grade), { x: cx + subCol1W + subCol2W + 5, y: curY, size: 9, font: thaiFont });
              curY -= 12;
            });

            // เพิ่มเติม
            page1.drawText(`รายวิชาเพิ่มเติม`, { x: cx + 2, y: curY, size: 10, font: thaiFontBold });
            curY -= 12;

            const addSubjects = allData.filter(d => d.type === 'subject' && d.class_level.includes(gradeLevel.toString()) && d.subject_name.includes('เพิ่มเติม'));
            addSubjects.forEach(sub => {
              const s1 = getStudentScore(student.student_code, sub.subject_code, 1, yr);
              const s2 = getStudentScore(student.student_code, sub.subject_code, 2, yr);
              const total = (s1 !== null && s2 !== null) ? Number(s1) + Number(s2) : null;
              const grade = total !== null ? calculateGrade(total) : '';

              page1.drawText(`${sub.subject_code} ${sub.subject_name.slice(0, 25)}`, { x: cx + 2, y: curY, size: 9, font: thaiFont });
              page1.drawText('40', { x: cx + subCol1W + 5, y: curY, size: 9, font: thaiFont });
              page1.drawText(String(grade), { x: cx + subCol1W + subCol2W + 5, y: curY, size: 9, font: thaiFont });
              curY -= 12;
            });
            curY -= 5;
          });
        }

        // --- Footer Page 1 (Signatures) ---
        const footerY = 70;
        page1.drawText('( ........................................................... )', { x: 380, y: footerY, size: 11, font: thaiFont });
        page1.drawText('นายทะเบียน', { x: 440, y: footerY - 15, size: 11, font: thaiFontBold });
        
        page1.drawText('( ........................................................... )', { x: 380, y: footerY - 45, size: 11, font: thaiFont });
        page1.drawText('ผู้อำนวยการโรงเรียน', { x: 430, y: footerY - 60, size: 11, font: thaiFontBold });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      
      if (returnBlob) return blob;

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      showToast('สร้าง PDF ปพ.1 สำเร็จ (แบบ 1 หน้าตามคำขอ)');
      setIsExportModalOpen(false);
    } catch (err) { console.error(err); showToast('❌ เกิดข้อผิดพลาดในการสร้าง PDF'); }
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
                      <button onClick={() => {
                        setIsViewModalOpen(true);
                        if (students.length > 0) setSelectedStudentForView(students[0]);
                      }} className="px-5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap active:scale-95">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ตรวจสอบ/ดูรายงาน PDF
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
                            
                            const isLocked = isSubjectComplete(selectedSubject.subject_code) && !unlockedSubjects.includes(selectedSubject.subject_code);

                            return (
                              <tr key={student.student_code} 
                                className={`hover:bg-emerald-50/40 transition-colors ${isLocked ? 'bg-slate-50/50' : ''}`}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setSubjectAdminData(selectedSubject);
                                  setAdminAuthInput('');
                                  setMoveTargetCode('');
                                  setIsSubjectAdminModalOpen(true);
                                }}
                              >
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
                                    disabled={isLocked}
                                    onKeyDown={(e) => handleKeyDown(e, index, 1)}
                                    onChange={(e) => updateScoreRealtime(student.student_code, 1, e.target.value)}
                                    className={`w-16 px-2 py-1.5 text-sm font-semibold border-2 border-slate-200 rounded-md text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow ${isLocked ? 'bg-slate-100 cursor-not-allowed border-dashed' : 'bg-white hover:border-emerald-300'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                                </td>
                                <td className="px-2 sm:px-4 py-3 text-center">
                                  <input type="number" value={score2 ?? ''} min="0" max="50" placeholder="-"
                                    data-index={index} data-semester="2"
                                    disabled={isLocked}
                                    onKeyDown={(e) => handleKeyDown(e, index, 2)}
                                    onChange={(e) => updateScoreRealtime(student.student_code, 2, e.target.value)}
                                    className={`w-16 px-2 py-1.5 text-sm font-semibold border-2 border-slate-200 rounded-md text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow ${isLocked ? 'bg-slate-100 cursor-not-allowed border-dashed' : 'bg-white hover:border-emerald-300'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
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
                  onChange={(e) => { setAdminSelectedRoom(e.target.value); setIsBulkEditSubjects(false); }}
                  className="w-48 px-4 py-2 text-sm border-2 border-emerald-200 hover:border-emerald-400 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold bg-white text-emerald-800 cursor-pointer transition-colors shadow-sm"
                >
                  <option value="">-- เลือกห้องเรียน --</option>
                  {adminRoomsList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                {adminSelectedRoom && (
                  <div className="flex gap-2 ml-auto">
                    <button onClick={exportFullCSV} className="text-xs font-bold bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 px-3 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1">
                      📊 ส่งออก CSV ปพ.1
                    </button>
                    <label className="cursor-pointer text-xs font-bold bg-white border border-emerald-200 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1">
                      📂 กู้คืนจากไฟล์ (JSON)
                      <input type="file" accept=".json" onChange={restoreFromFile} className="hidden" />
                    </label>
                  </div>
                )}
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
                              <div className="flex justify-between items-start">
                                <span className="text-sm font-semibold text-slate-700">{sb.subject_name}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${sb.subject_type === 'เพิ่มเติม' ? 'bg-blue-100 text-blue-700' : (sb.subject_type === 'กิจกรรม' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}`}>
                                  {sb.subject_type || 'พื้นฐาน'}
                                </span>
                              </div>
                              <span className="text-xs text-emerald-600 mt-1">
                                รหัส: {sb.subject_code} | คะแนนเต็ม: {sb.max_score} | {sb.credit || 1} ชม./นก.
                              </span>
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
              <button onClick={() => { setShowAdminAuth(false); setAdminPwd(''); }} className="flex-1 py-2.5 text-sm border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">
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
              <button onClick={exportPP6PDF} className="w-full px-4 py-3 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-2 border-indigo-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                📄 ส่งออก ปพ.6 (รายงานรายปี)
              </button>
              <button onClick={exportPP1PDF} className="w-full px-4 py-3 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border-2 border-blue-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                📜 ส่งออก ปพ.1 (ใบระเบียนสะสม)
              </button>
              <button onClick={exportExcelAllSubjects} className="w-full px-4 py-3 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-sm">
                📊 ส่งออกทุกวิชา (Excel)
              </button>
            </div>
            <button onClick={() => setIsExportModalOpen(false)} className="w-full mt-5 py-2 text-slate-400 hover:text-slate-600 text-sm font-bold transition-colors underline underline-offset-4">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Subject Admin Modal (Unlock / Edit / Move) */}
      {isSubjectAdminModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold flex items-center gap-2">
                <svg className="w-5 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                จัดการวิชา {subjectAdminData?.subject_code}
              </h3>
              <button onClick={() => setIsSubjectAdminModalOpen(false)} className="text-emerald-100 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <p className="text-xs text-amber-700 font-bold mb-1 italic">🔐 ป้องกันการแก้ไขโดยไม่ตั้งใจ</p>
                <input 
                  type="password" 
                  autoFocus
                  placeholder="กรอกรหัสผ่าน (Admin)"
                  value={adminAuthInput}
                  onChange={(e) => setAdminAuthInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border-2 border-amber-200 rounded-lg focus:border-amber-500 outline-none"
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <button onClick={unlockSelectedSubject} className="w-full py-2.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                  🔓 ปลดล็อคการแก้ไขวิชานี้
                </button>
                
                <h4 className="text-xs font-bold text-slate-400 mt-4 px-1 uppercase tracking-wider">แก้ไขข้อมูลพื้นฐาน</h4>
                <div className="grid grid-cols-2 gap-2">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 ml-1">รหัสวิชา</label>
                      <input 
                        type="text" 
                        value={subjectAdminData?.subject_code || ''}
                        onChange={(e) => setSubjectAdminData({...subjectAdminData, subject_code: e.target.value})}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-mono"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 ml-1">คะแนนเต็ม</label>
                      <input 
                        type="number" 
                        value={subjectAdminData?.max_score || 100}
                        onChange={(e) => setSubjectAdminData({...subjectAdminData, max_score: Number(e.target.value)})}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none"
                      />
                   </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 ml-1">ชื่อวิชา</label>
                    <input 
                      type="text" 
                      value={subjectAdminData?.subject_name || ''}
                      onChange={(e) => setSubjectAdminData({...subjectAdminData, subject_name: e.target.value})}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none"
                    />
                </div>
                <button onClick={modifySubject} className="w-full py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold text-xs transition-all shadow-md">
                   💾 บันทึกการเปลี่ยนแปลงข้อมูลวิชา
                </button>

                <h4 className="text-xs font-bold text-slate-400 mt-6 px-1 uppercase tracking-wider">ย้ายคะแนน (กรณีครูกรอกผิดวิชา)</h4>
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 space-y-2">
                   <p className="text-[10px] text-rose-600 leading-tight">* ฟังก์ชันนี้จะย้ายคะแนน "ทั้งหมด" ของปีนี้ จากวิชานี้ไปยังรหัสวิชาที่ระบุ</p>
                   <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="รหัสใหม่ (เช่น ค11101)"
                        value={moveTargetCode}
                        onChange={(e) => setMoveTargetCode(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border-2 border-rose-200 rounded-lg outline-none font-mono focus:border-rose-500"
                      />
                      <button onClick={moveScoresToSubject} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700 transition-all shadow-sm">
                        🚀 ย้ายทันที
                      </button>
                   </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
               <p className="text-[10px] text-slate-400">ระบบรักษาความปลอดภัย ข้อมูลถูก Sync ไปยังระบบ D1 ทันที</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal View PDF */}
      {isViewModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-emerald-800 p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold">ตรวจสอบและส่งออกรายงาน ปพ.</h3>
                  <p className="text-xs text-emerald-100/70">โปรดเลือกนักเรียนและประเภทรายงานเพื่อดูตัวอย่าง</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar: Student List */}
              <div className="w-64 border-r border-slate-100 flex flex-col bg-slate-50/50">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex gap-1 p-1 bg-slate-200/50 rounded-lg">
                    <button
                      onClick={() => setReportType('pp6')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${reportType === 'pp6' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >ปพ.6</button>
                    <button
                      onClick={() => setReportType('pp1')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${reportType === 'pp1' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >ปพ.1</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {students.map((st, i) => (
                    <button
                      key={st.student_code}
                      onClick={async () => {
                        setSelectedStudentForView(st);
                        const blob = reportType === 'pp6'
                          ? await exportPP6PDF(st, true)
                          : await exportPP1PDF(st, true);
                        if (blob instanceof Blob) {
                          setPdfUrl(URL.createObjectURL(blob));
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-xl mb-1 transition-all flex items-center gap-3 ${selectedStudentForView?.student_code === st.student_code ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600' : 'hover:bg-white text-slate-600'}`}
                    >
                      <span className="text-xs font-bold text-emerald-300 w-4">{i + 1}</span>
                      <div className="truncate">
                        <div className="text-sm font-bold truncate">{st.student_name}</div>
                        <div className="text-[10px] opacity-60 font-mono">{st.student_code}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Content: Preview */}
              <div className="flex-1 bg-slate-200/30 p-4 flex flex-col">
                {pdfUrl ? (
                  <iframe src={pdfUrl} className="w-full h-full rounded-xl shadow-lg border-0 bg-white" title="PDF Preview" />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center border border-slate-100">
                      <svg className="w-10 h-10 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <p className="font-bold text-sm">คลิกเลือกรายชื่อนักเรียนเพื่อดูตัวอย่าง</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => window.open(pdfUrl, '_blank')}
                disabled={!pdfUrl}
                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                เปิดดูแยก / พิมพ์ (PDF)
              </button>
            </div>
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
