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

  // Modals
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStudentForView, setSelectedStudentForView] = useState<any>(null);

  const [reportsMode, setReportsMode] = useState<'pp6' | 'pp1'>('pp6');
  const [pp6Mode, setPp6Mode] = useState<'mode1' | 'mode2'>('mode1');

  // Subject Locking & Admin
  const [unlockedSubjects, setUnlockedSubjects] = useState<string[]>([]);
  const [isSubjectAdminModalOpen, setIsSubjectAdminModalOpen] = useState(false);
  const [subjectAdminData, setSubjectAdminData] = useState<any>(null);
  const [adminAuthInput, setAdminAuthInput] = useState('');
  const [moveTargetCode, setMoveTargetCode] = useState('');

  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderStudents, setReorderStudents] = useState<any[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // New states for User Request
  const [scoringStyle, setScoringStyle] = useState<'simple' | 'detailed'>('detailed'); // ค่าเริ่มต้น: เก็บ+สอบ
  const [isMoveAuthorized, setIsMoveAuthorized] = useState(false);

  // Helper: คืนค่า ratio เก็บ:สอบ ตามวิชา
  const getSubjectRatio = (subj: any) => {
    if (!subj) return { midMax: 40, finMax: 10 };
    const name = (subj.subject_name || '').toLowerCase();
    const code = (subj.subject_code || '').toLowerCase();
    // ไทย คณิต วิทย์ อังกฤษ = 30:20
    if (code.startsWith('ท') || name.includes('ภาษาไทย')) return { midMax: 30, finMax: 20 };
    if (code.startsWith('ค') || name.includes('คณิต')) return { midMax: 30, finMax: 20 };
    if ((code.startsWith('ว') && !name.includes('ประวัติ')) || name.includes('วิทย')) return { midMax: 30, finMax: 20 };
    if (name.includes('อังกฤษ') || name.includes('ภาษาต่างประเทศ')) return { midMax: 30, finMax: 20 };
    // วิชาอื่น = 40:10
    return { midMax: 40, finMax: 10 };
  };

  // Derived: ratio ของวิชาที่เลือกอยู่ตอนนี้
  const currentRatio = getSubjectRatio(selectedSubject);

  // Student Status State
  const [selectedStudentStatus, setSelectedStudentStatus] = useState<any>(null);
  const longPressTimer = useRef<any>(null);

  // Config bindings
  const [appTitle, setAppTitle] = useState(defaultConfig.app_title);
  const [schoolName, setSchoolName] = useState(defaultConfig.school_name);

  // ============ EFFECTS ============
  useEffect(() => {
    // Load persisted settings
    const savedStyle = localStorage.getItem('scoringStyle');
    if (savedStyle === 'simple' || savedStyle === 'detailed') {
      setScoringStyle(savedStyle);
    }
    const savedPp6Mode = localStorage.getItem('pp6Mode');
    if (savedPp6Mode === 'mode1' || savedPp6Mode === 'mode2') {
      setPp6Mode(savedPp6Mode);
    }

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

  // Persist settings when they change
  useEffect(() => {
    localStorage.setItem('scoringStyle', scoringStyle);
  }, [scoringStyle]);

  useEffect(() => {
    localStorage.setItem('pp6Mode', pp6Mode);
  }, [pp6Mode]);

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
      d.type === 'student' && d.class_level === selectedRoom.class_level && d.year === Number(selectedYear) &&
      d.status !== 'ย้ายออก' // กรองย้ายออก
    ).sort((a, b) => {
      // เรียงตามเลขที่ (order_index)
      const orderA = (a.order_index !== undefined && a.order_index !== null && a.order_index !== 0) ? a.order_index : 9999;
      const orderB = (b.order_index !== undefined && b.order_index !== null && b.order_index !== 0) ? b.order_index : 9999;

      if (orderA !== orderB) return orderA - orderB;

      // ถ้าไม่มีเลขที่ หรือเลขที่เท่ากัน ให้เรียงตามรหัสประจำตัว (student_code)
      return (a.student_code || '').localeCompare(b.student_code || '', 'en');
    });
  }, [allData, selectedRoom, selectedYear]);

  // Admin Data
  const adminRoomsList = useMemo(() => {
    return Array.from(new Set(allData.filter(d => d.type === 'student' && d.year === Number(selectedYear)).map(d => d.class_level))).sort();
  }, [allData, selectedYear]);

  const adminStudents = useMemo(() => {
    return allData.filter(d => d.type === 'student' && d.class_level === adminSelectedRoom && d.year === Number(selectedYear))
      .sort((a, b) => {
        const orderA = (a.order_index !== undefined && a.order_index !== null && a.order_index !== 0) ? a.order_index : 9999;
        const orderB = (b.order_index !== undefined && b.order_index !== null && b.order_index !== 0) ? b.order_index : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.student_code || '').localeCompare(b.student_code || '', 'en');
      });
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

  const trashStudents = useMemo(() => {
    return allData.filter(d => d.type === 'student' && d.status === 'ย้ายออก' && (adminSelectedRoom ? d.class_level === adminSelectedRoom : true) && d.year === Number(selectedYear));
  }, [allData, adminSelectedRoom, selectedYear]);

  // ============ ACTIONS ============
  const handleSelectRoom = async (room: any) => {
    setSelectedRoom(room);

    // อัตโนมัติ: ตรวจสอบและสร้างวิชามาตรฐานหากยังไม่มี
    const roomSubjects = allData.filter(d =>
      d.type === 'subject' &&
      d.class_level === room.class_level &&
      (d.year === Number(selectedYear) || !d.year)
    );

    let currentSubjects = roomSubjects;
    if (roomSubjects.length === 0) {
      const updatedData = await generateStandardSubjectsSilent(room.class_level);
      currentSubjects = updatedData.filter(d =>
        d.type === 'subject' &&
        d.class_level === room.class_level &&
        (d.year === Number(selectedYear) || !d.year)
      );
    }

    if (currentSubjects.length > 0) {
      setSelectedSubject(currentSubjects[0]);
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

  const updateScoreRealtime = async (studentCode: string, semester: number, value: string, subType: 'total' | 'mid' | 'fin' = 'total') => {
    let newData = [...allData];
    const existingIndex = newData.findIndex(d =>
      d.type === 'score' && d.student_code === studentCode &&
      d.subject_code === selectedSubject.subject_code &&
      d.class_level === selectedRoom.class_level &&
      Number(d.year) === Number(selectedYear) &&
      Number(d.semester) === Number(semester)
    );

    let currentScoreObj = existingIndex >= 0 ? { ...newData[existingIndex] } : {
      type: 'score', student_code: studentCode, subject_code: selectedSubject.subject_code,
      subject_name: selectedSubject.subject_name, class_level: selectedRoom.class_level,
      score: 0, mid_score: null, fin_score: null, max_score: selectedSubject.max_score, semester, year: Number(selectedYear),
      created_at: new Date().toISOString()
    };

    // Normalize: record เก่าอาจไม่มี mid_score/fin_score (undefined) ต้องแปลงเป็น null
    if (currentScoreObj.mid_score === undefined) currentScoreObj.mid_score = null;
    if (currentScoreObj.fin_score === undefined) currentScoreObj.fin_score = null;

    const numValue = value === '' ? null : Number(value);

    if (subType === 'mid') {
      const { midMax: mMax } = getSubjectRatio(selectedSubject);
      if (numValue !== null && numValue > mMax) return showToast(`⚠️ คะแนนเก็บเต็ม ${mMax}`);
      if (numValue !== null && numValue < 0) return;
      currentScoreObj.mid_score = numValue;
    } else if (subType === 'fin') {
      const { finMax: fMax } = getSubjectRatio(selectedSubject);
      if (numValue !== null && numValue > fMax) return showToast(`⚠️ คะแนนสอบเต็ม ${fMax}`);
      if (numValue !== null && numValue < 0) return;
      currentScoreObj.fin_score = numValue;
    } else {
      if (numValue !== null && numValue > 50) return showToast('⚠️ คะแนนเต็ม 50');
      if (numValue !== null && numValue < 0) return;
      currentScoreObj.score = numValue ?? 0;
      currentScoreObj.mid_score = null;
      currentScoreObj.fin_score = null;
    }

    // Recalculate total if sub-scores exist (ตรวจ null เท่านั้น เพราะ normalize แล้ว)
    if (currentScoreObj.mid_score !== null || currentScoreObj.fin_score !== null) {
      currentScoreObj.score = (currentScoreObj.mid_score ?? 0) + (currentScoreObj.fin_score ?? 0);
    }

    // เช็คว่าควรลบ record หรือไม่ (ถ้าเป็น null ทุกช่อง)
    const isAllNull = (currentScoreObj.mid_score === null && currentScoreObj.fin_score === null && (subType === 'total' ? numValue === null : currentScoreObj.score === 0));

    if (isAllNull) {
      if (existingIndex >= 0) {
        newData.splice(existingIndex, 1);
        setAllData(newData);
        if (window.dataSdk) window.dataSdk.delete(currentScoreObj.id || currentScoreObj._id || `${studentCode}_${selectedSubject.subject_code}_${semester}_${selectedYear}`);
      }
      return;
    }

    if (existingIndex >= 0) {
      newData[existingIndex] = currentScoreObj;
      if (window.dataSdk) window.dataSdk.update(currentScoreObj);
    } else {
      newData.push(currentScoreObj);
      if (window.dataSdk) window.dataSdk.create(currentScoreObj);
    }
    setAllData(newData);
  };

  const updateStudentOrder = (studentCode: string, newOrder: string) => {
    let newData = [...allData];
    const idx = newData.findIndex(d => d.type === 'student' && d.student_code === studentCode && d.year === Number(selectedYear));
    if (idx >= 0) {
      newData[idx] = { ...newData[idx], order_index: Number(newOrder) || 0 };
      setAllData(newData);
      if (window.dataSdk) window.dataSdk.update(newData[idx]);
    }
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

    const match = adminSelectedRoom.match(/ป\.(\d+)/) || selectedRoom?.class_level?.match(/ป\.(\d+)/);
    const currentGrade = match ? parseInt(match[1]) : 6;
    const baseYear = Number(selectedYear) - currentGrade + 1;

    const yearHeaders = [
      { year: baseYear, level: '1', subjects: ['ท11101 ภาษาไทย 1', 'ค11101 คณิตศาสตร์พื้นฐาน 1', 'ว11101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 1', 'ส11101 สังคมศึกษา ศาสนาและวัฒนธรรม 1', 'ส11102 ประวัติศาสตร์ 1', 'พ11101 สุขศึกษาและพลศึกษา 1', 'ศ11101 ศิลปะ 1', 'ง11101 การงานอาชีพ 1', 'อ11101 ภาษาอังกฤษพื้นฐาน 1', '', 'ส11201 หน้าที่พลเมือง 1', 'ส11202 การป้องกันการทุจริต 1'] },
      { year: baseYear + 1, level: '2', subjects: ['ท12101 ภาษาไทย 2', 'ค12101 คณิตศาสตร์พื้นฐาน 2', 'ว12101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 2', 'ส12101 สังคมศึกษา ศาสนาและวัฒนธรรม 2', 'ส12102 ประวัติศาสตร์ 2', 'พ12101 สุขศึกษาและพลศึกษา 2', 'ศ12101 ศิลปะ 2', 'ง12101 การงานอาชีพ 2', 'อ12101 ภาษาอังกฤษพื้นฐาน 2', '', 'ส12201 หน้าที่พลเมือง 2', 'ส12202 การป้องกันการทุจริต 2'] },
      { year: baseYear + 2, level: '3', subjects: ['ท13101 ภาษาไทย 3', 'ค13101 คณิตศาสตร์พื้นฐาน 3', 'ว13101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 3', 'ส13101 สังคมศึกษา ศาสนาและวัฒนธรรม  3', 'ส13102 ประวัติศาสตร์ 3', 'พ13101 สุขศึกษาและพลศึกษา 3', 'ศ13101 ศิลปะ 3', 'ง13101 การงานอาชีพ 3', 'อ13101 ภาษาอังกฤษพื้นฐาน 3', '', 'ส13201 หน้าที่พลเมือง 3', 'ส13202 การป้องกันการทุจริต 3'] },
      { year: baseYear + 3, level: '4', subjects: ['ท14101 ภาษาไทย 4', 'ค14101 คณิตศาสตร์พื้นฐาน 4', 'ว14101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 4', 'ส14101 สังคมศึกษา ศาสนาและวัฒนธรรม 4', 'ส14102 ประวัติศาสตร์ 4', 'พ14101 สุขศึกษาและพลศึกษา 4', 'ศ14101 ศิลปะ 4', 'ง14101 การงานอาชีพ 4', 'อ14101 ภาษาอังกฤษพื้นฐาน 4', '', 'ส14201 หน้าที่พลเมือง 4', 'ส14202 การป้องกันการทุจริต 4'] },
      { year: baseYear + 4, level: '5', subjects: ['ท15101 ภาษาไทย 5', 'ค15101 คณิตศาสตร์พื้นฐาน 5', 'ว15101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 5', 'ส15101 สังคมศึกษา ศาสนาและวัฒนธรรม 5', 'ส15102 ประวัติศาสตร์ 5', 'พ15101 สุขศึกษาและพลศึกษา 5', 'ศ15101 ศิลปะ 5', 'ง15101 การงานอาชีพ 5', 'อ15101 ภาษาอังกฤษพื้นฐาน 5', '', 'ส15201 หน้าที่พลเมือง 5', 'ส15202 การป้องกันการทุจริต 5'] },
      { year: baseYear + 5, level: '6', subjects: ['ท16101 ภาษาไทย 6', 'ค16101 คณิตศาสตร์พื้นฐาน 6', 'ว16101 พื้นฐานวิทยาศาสตร์และเทคโนโลยี 6', 'ส16101 สังคมศึกษา ศาสนาและวัฒนธรรม 6', 'ส16102 ประวัติศาสตร์ 6', 'พ16101 สุขศึกษาและพลศึกษา 6', 'ศ16101 ศิลปะ 6', 'ง16101 การงานอาชีพ 6', 'อ16101 ภาษาอังกฤษพื้นฐาน 6', '', 'ส16201 หน้าที่พลเมือง 6', 'ส16202 การป้องกันการทุจริต 6'] }
    ];

    yearHeaders.forEach(y => {
      headerRow.push(`${y.year} ชั้นประถมศึกษาปีที่ ${y.level}`);
      headerRow.push('');
      y.subjects.forEach(s => headerRow.push(s));
    });

    // กิจกรรมพัฒนาผู้เรียน
    const activities = [
      { year: baseYear, subs: ['ก11901 แนะแนว 1', 'ก11902 ลูกเสือ-เนตรนารี 1', 'ก11903 กิจกรรมชุมนุม 1', 'ก11904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] },
      { year: baseYear + 1, subs: ['ก12901 แนะแนว 2', 'ก12902 ลูกเสือ-เนตรนารี 2', 'ก12903 กิจกรรมชุมนุม 2', 'ก12904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] },
      { year: baseYear + 2, subs: ['ก13901 แนะแนว 3', 'ก13902 ลูกเสือ-เนตรนารี 3', 'ก13903 กิจกรรมชุมนุม 3', 'ก13904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] },
      { year: baseYear + 3, subs: ['ก14901 แนะแนว 4', 'ก14902 ลูกเสือ-เนตรนารี 4', 'ก14903 กิจกรรมชุมนุม 4', 'ก14904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] },
      { year: baseYear + 4, subs: ['ก15901 แนะแนว 5', 'ก15902 ลูกเสือ-เนตรนารี 5', 'ก15903 กิจกรรมชุมนุม 5', 'ก15904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] },
      { year: baseYear + 5, subs: ['ก16901 แนะแนว 6', 'ก16902 ลูกเสือ-เนตรนารี 6', 'ก16903 กิจกรรมชุมนุม 6', 'ก16904 กิจกรรมเพื่อสังคมและสาธารณประโยชน์'] }
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

  const getStudentScore = (studentCode: string, subjCode: string, semester: number, year: number | string | null = null, subType: 'total' | 'mid' | 'fin' = 'total') => {
    const targetYear = Number(year || selectedYear);
    const scoreItem = allData.find(d =>
      d.type === 'score' &&
      d.student_code === studentCode &&
      d.subject_code === subjCode &&
      Number(d.year) === targetYear &&
      Number(d.semester) === Number(semester)
    );
    if (!scoreItem) return null;

    if (subType === 'mid') {
      // Heal: If mid_score is missing but score exists, use score
      return (scoreItem.mid_score !== null && scoreItem.mid_score !== undefined) ? scoreItem.mid_score : (scoreItem.fin_score ? null : (scoreItem.score || null));
    }
    if (subType === 'fin') return scoreItem.fin_score !== undefined ? scoreItem.fin_score : null;
    return scoreItem.score;
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

  const clearAllScoresForSubject = async () => {
    if (adminAuthInput !== '31020177') return showToast('⚠️ รหัสผ่านไม่ถูกต้อง');
    if (!subjectAdminData) return;

    if (!confirm(`⚠️ ยืนยันการลบคะแนน "ทั้งหมด" ของวิชา ${subjectAdminData.subject_code} ในปีการศึกษาที่เลือก?\nข้อมูลจะหายไปถาวร ไม่สามารถกู้คืนได้!`)) return;

    let newData = [...allData];
    const deletedScores = newData.filter(d =>
      d.type === 'score' &&
      d.subject_code === subjectAdminData.subject_code &&
      (d.class_level === selectedRoom?.class_level || d.class_level === adminSelectedRoom) &&
      d.year === Number(selectedYear)
    );

    if (deletedScores.length === 0) return showToast('ไม่มีคะแนนให้ลบ');

    newData = newData.filter(d => !(
      d.type === 'score' &&
      d.subject_code === subjectAdminData.subject_code &&
      (d.class_level === selectedRoom?.class_level || d.class_level === adminSelectedRoom) &&
      d.year === Number(selectedYear)
    ));

    setAllData(newData);

    if (window.dataSdk) {
      showToast('กำลังลบข้อมูลจากฐานข้อมูล...');
      for (const s of deletedScores) {
        try { await window.dataSdk.delete(s.id || s._id); } catch (e) { }
      }
      showToast('✅ ลบคะแนนทั้งหมดเรียบร้อยแล้ว');
    }

    setIsSubjectAdminModalOpen(false);
    setAdminAuthInput('');
  };

  const clearAllScoresGlobally = async () => {
    let mode = prompt('ต้องการลบคะแนนแบบไหน?\nพิมพ์ 1 = ลบทุกวิชา "เฉพาะชั้นที่เลือก" (' + adminSelectedRoom + ')\nพิมพ์ 2 = ลบทุกวิชา "ทุกชั้น ทั้งโรงเรียน"');
    if (mode !== '1' && mode !== '2') return;

    let pwd = prompt('กรุณากรอกรหัสผ่าน Admin เพื่อยืนยัน:');
    if (pwd !== '31020177') return showToast('⚠️ รหัสผ่านไม่ถูกต้อง');

    if (!confirm(`⚠️ คำเตือนสุดท้าย! คุณกำลังจะลบคะแนนทั้งหมด${mode === '1' ? 'ของ ' + adminSelectedRoom : 'ทั้งโรงเรียน'} ในปี ${selectedYear} ข้อมูลจะไม่สามารถกู้คืนได้ ยืนยันหรือไม่?`)) return;

    let newData = [...allData];
    const deletedScores = newData.filter(d =>
      d.type === 'score' &&
      d.year === Number(selectedYear) &&
      (mode === '2' || d.class_level === adminSelectedRoom)
    );

    if (deletedScores.length === 0) return showToast('ไม่มีคะแนนให้ลบ');

    newData = newData.filter(d => !(
      d.type === 'score' &&
      d.year === Number(selectedYear) &&
      (mode === '2' || d.class_level === adminSelectedRoom)
    ));

    setAllData(newData);

    if (window.dataSdk) {
      showToast('กำลังลบข้อมูลจากฐานข้อมูล... ' + deletedScores.length + ' รายการ');
      try {
        await window.dataSdk.syncAll(newData);
      } catch (e) { }
      showToast('✅ ล้างคะแนนทั้งหมดเรียบร้อยแล้ว');
    }
  };

  // ฟังก์ชันสร้างวิชามาตรฐานแบบอัตโนมัติ (Silent)
  const generateStandardSubjectsSilent = async (targetClassName: string) => {
    const standardSpecs = [
      { name: 'ภาษาไทย', codePfx: 'ท1', c13: 5, c46: 4 },
      { name: 'คณิตศาสตร์พื้นฐาน', codePfx: 'ค1', c13: 4, c46: 4 },
      { name: 'พื้นฐานวิทยาศาสตร์และเทคโนโลยี', codePfx: 'ว1', c13: 2, c46: 3 },
      { name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', codePfx: 'ส1', codeSfx: '101', c13: 1, c46: 1 },
      { name: 'ประวัติศาสตร์', codePfx: 'ส1', codeSfx: '102', c13: 1, c46: 1 },
      { name: 'สุขศึกษาและพลศึกษา', codePfx: 'พ1', c13: 1, c46: 1 },
      { name: 'ศิลปะ', codePfx: 'ศ1', c13: 1, c46: 1 },
      { name: 'การงานอาชีพ', codePfx: 'ง1', c13: 1, c46: 2 },
      { name: 'ภาษาอังกฤษพื้นฐาน', codePfx: 'อ1', c13: 5, c46: 4 },
      { name: 'หน้าที่พลเมือง', codePfx: 'ส1', codeSfx: '201', c13: 1, c46: 1, stype: 'เพิ่มเติม' },
      { name: 'การป้องกันการทุจริต', codePfx: 'ส1', codeSfx: '202', c13: 1, c46: 1, stype: 'เพิ่มเติม' }
    ];

    let newData = [...allData];
    const match = targetClassName.match(/ป\.(\d+)/);
    if (!match) return newData;
    const grade = parseInt(match[1]);

    for (const spec of standardSpecs) {
      const sfx = spec.codeSfx || '101';
      const code = spec.codePfx + grade + sfx;
      const sname = spec.name + ' ' + grade;
      const credit = grade <= 3 ? spec.c13 : spec.c46;
      const stype = spec.stype || 'พื้นฐาน';

      const existingIdx = newData.findIndex(d => d.type === 'subject' && d.subject_code === code && d.class_level === targetClassName);
      const subjObj = { type: 'subject', subject_code: code, subject_name: sname, class_level: targetClassName, max_score: 100, subject_type: stype, credit: credit, year: 0, created_at: new Date().toISOString() };

      if (existingIdx >= 0) {
        newData[existingIdx] = { ...newData[existingIdx], ...subjObj };
      } else {
        newData.push(subjObj);
      }
    }

    setAllData(newData);
    if (window.dataSdk) {
      await window.dataSdk.syncAll(newData);
    }
    return newData;
  };

  // ============ EXPORT ============

  // --- รายงาน ปพ.6 (รายปี) --- รูปแบบใหม่ทั้งหมด 
  const exportPP6PDF = async (targetStudent: any = null, returnBlob = false, currentMode = 'mode1') => {
    const studentList = targetStudent ? [targetStudent] : students;
    if (!selectedRoom || subjects.length === 0 || studentList.length === 0) return showToast('ไม่มีข้อมูลให้ส่งออก');

    if (!returnBlob) showToast('กำลังเตรียมไฟล์ PDF ปพ.6 ใหม่อีกครั้ง...');

    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      const [fontBytes, fontBoldBytes] = await Promise.all([
        fetch('https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNew.ttf').then(res => res.arrayBuffer()),
        fetch('https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNewBold.ttf').then(res => res.arrayBuffer())
      ]);
      const thaiFont = await pdfDoc.embedFont(fontBytes);
      const thaiFontBold = await pdfDoc.embedFont(fontBoldBytes);

      const drawCenteredText = (page: any, text: string, x: number, y: number, w: number, font: any, size: number, color = rgb(0, 0, 0)) => {
        const tWidth = font.widthOfTextAtSize(String(text), size);
        page.drawText(String(text), { x: x + (w - tWidth) / 2, y, size, font, color });
      };

      const drawLeftText = (page: any, text: string, x: number, y: number, font: any, size: number, pad = 6) => {
        page.drawText(String(text), { x: x + pad, y, size, font });
      };

      for (const student of studentList) {
        const page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();

        // ===== ส่วน Header =====
        const headerY = height - 45;
        drawCenteredText(page, 'แบบรายงานผลพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6)', 0, headerY, width, thaiFontBold, 24);
        drawCenteredText(page, `โรงเรียน${schoolName}`, 0, headerY - 25, width, thaiFontBold, 20);

        // ===== ข้อมูลนักเรียน =====
        const infoY = headerY - 60;
        const leftX = 45;
        const rightInfoX = 340;

        const infoFontSize = 18;

        page.drawText('ชื่อ-นามสกุล', { x: leftX, y: infoY, size: infoFontSize, font: thaiFontBold });
        page.drawText(student.student_name, { x: leftX + 85, y: infoY, size: infoFontSize, font: thaiFont });

        page.drawText('เลขประจำตัว', { x: rightInfoX, y: infoY, size: infoFontSize, font: thaiFontBold });
        page.drawText(student.student_code, { x: rightInfoX + 80, y: infoY, size: infoFontSize, font: thaiFont });

        const infoY2 = infoY - 25;
        page.drawText('ชั้น', { x: leftX, y: infoY2, size: infoFontSize, font: thaiFontBold });
        page.drawText(selectedRoom.class_level, { x: leftX + 30, y: infoY2, size: infoFontSize, font: thaiFont });

        page.drawText('ปีการศึกษา', { x: leftX + 110, y: infoY2, size: infoFontSize, font: thaiFontBold });
        page.drawText(String(selectedYear), { x: leftX + 185, y: infoY2, size: infoFontSize, font: thaiFont });

        // ===== ตาราง (คัดลอกรูปแบบ ปพ.1 เป๊ะ) =====
        const tableStartY = infoY2 - 25;
        const tableLeft = 50;
        const colWidthSum = 500; // ขยายความกว้างรวมให้เต็มกระดาษมากขึ้น

        page.drawRectangle({ x: tableLeft, y: tableStartY - 35, width: colWidthSum, height: 35, borderColor: rgb(0, 0, 0), borderWidth: 0.8 });

        if (currentMode === 'mode1') {
          // แนวตารางใหม่: ชื่อวิชา(200) | ชม.(30) | เก็บ1(40) | สอบ1(40) | เก็บ2(40) | สอบ2(40) | รวม(55) | เกรด(55)
          const colX = [0, 200, 230, 270, 310, 350, 390, 445, 500].map(x => tableLeft + x);

          // Vertical lines
          for (let i = 1; i < colX.length - 1; i++) {
            page.drawLine({ start: { x: colX[i], y: tableStartY }, end: { x: colX[i], y: tableStartY - 35 }, thickness: 0.5, color: rgb(0, 0, 0) });
          }

          // Horizontal divider for sem headers
          page.drawLine({ start: { x: colX[2], y: tableStartY - 17 }, end: { x: colX[6], y: tableStartY - 17 }, thickness: 0.5, color: rgb(0, 0, 0) });
          // Vertical dividers for mid/fin
          page.drawLine({ start: { x: colX[3], y: tableStartY - 17 }, end: { x: colX[3], y: tableStartY - 35 }, thickness: 0.5, color: rgb(0, 0, 0) });
          page.drawLine({ start: { x: colX[5], y: tableStartY - 17 }, end: { x: colX[5], y: tableStartY - 35 }, thickness: 0.5, color: rgb(0, 0, 0) });

          drawCenteredText(page, 'รหัส/รายวิชา', colX[0], tableStartY - 22, 200, thaiFontBold, 14);
          drawCenteredText(page, 'ชม.', colX[1], tableStartY - 22, 30, thaiFontBold, 12);

          drawCenteredText(page, 'เทอม 1', colX[2], tableStartY - 13, 80, thaiFontBold, 12);
          drawCenteredText(page, 'เทอม 2', colX[4], tableStartY - 13, 80, thaiFontBold, 12);

          drawCenteredText(page, 'เก็บ', colX[2], tableStartY - 30, 40, thaiFontBold, 10);
          drawCenteredText(page, 'สอบ', colX[3], tableStartY - 30, 40, thaiFontBold, 10);
          drawCenteredText(page, 'เก็บ', colX[4], tableStartY - 30, 40, thaiFontBold, 10);
          drawCenteredText(page, 'สอบ', colX[5], tableStartY - 30, 40, thaiFontBold, 10);

          drawCenteredText(page, 'รวม', colX[6], tableStartY - 22, 55, thaiFontBold, 13);
          drawCenteredText(page, 'ผลเรียน', colX[7], tableStartY - 22, 55, thaiFontBold, 13);
        } else {
          // โหมด 2 (เวลาเรียน): ชื่อวิชา(240) | ชม.(50) | ส1(55) | ส2(55) | รวม(50) | ผล(50)
          const colX = [0, 240, 290, 345, 400, 450, 500].map(x => tableLeft + x);
          for (let i = 1; i < colX.length - 1; i++) {
            page.drawLine({ start: { x: colX[i], y: tableStartY }, end: { x: colX[i], y: tableStartY - 35 }, thickness: 0.5, color: rgb(0, 0, 0) });
          }

          drawCenteredText(page, 'รหัส/รายวิชา', colX[0], tableStartY - 22, 240, thaiFontBold, 14);
          drawCenteredText(page, 'ชม.', colX[1], tableStartY - 22, 50, thaiFontBold, 14);
          drawCenteredText(page, 'เทอม 1', colX[2], tableStartY - 22, 55, thaiFontBold, 12);
          drawCenteredText(page, 'เทอม 2', colX[3], tableStartY - 22, 55, thaiFontBold, 12);
          drawCenteredText(page, 'รวม', colX[4], tableStartY - 22, 50, thaiFontBold, 13);
          drawCenteredText(page, 'ผลเรียน', colX[5], tableStartY - 22, 50, thaiFontBold, 13);
        }

        let y = tableStartY - 35;

        const baseSubjects = subjects.filter(s => (s.subject_type || 'พื้นฐาน') === 'พื้นฐาน' && !(s.subject_name?.includes('หน้าที่พลเมือง') || s.subject_name?.includes('ทุจริต')));
        const addSubjects = subjects.filter(s => s.subject_type === 'เพิ่มเติม' || s.subject_name?.includes('หน้าที่พลเมือง') || s.subject_name?.includes('ทุจริต'));
        const actSubjects = subjects.filter(s => s.subject_type === 'กิจกรรม');

        const drawRow = (subjMapData: any, isHeader = false) => {
          const rowH = 26; // เพิ่มความสูงแถว
          const subFontSize = 16;
          page.drawRectangle({ x: tableLeft, y: y - rowH, width: colWidthSum, height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });

          if (currentMode === 'mode1') {
            const colX = [0, 200, 230, 270, 310, 350, 390, 445, 500].map(x => tableLeft + x);
            for (let i = 1; i < colX.length - 1; i++) {
              page.drawLine({ start: { x: colX[i], y }, end: { x: colX[i], y: y - rowH }, thickness: 0.5, color: rgb(0, 0, 0) });
            }

            if (isHeader) {
              drawLeftText(page, subjMapData, colX[0], y - 19, thaiFontBold, subFontSize, 6);
            } else {
              drawLeftText(page, `${subjMapData.code} ${subjMapData.name}`, colX[0], y - 19, thaiFont, subFontSize, 6);
              drawCenteredText(page, String(subjMapData.hours), colX[1], y - 19, 30, thaiFont, subFontSize);
              drawCenteredText(page, String(subjMapData.m1), colX[2], y - 19, 40, thaiFont, subFontSize);
              drawCenteredText(page, String(subjMapData.f1), colX[3], y - 19, 40, thaiFont, subFontSize);
              drawCenteredText(page, String(subjMapData.m2), colX[4], y - 19, 40, thaiFont, subFontSize);
              drawCenteredText(page, String(subjMapData.f2), colX[5], y - 19, 40, thaiFont, subFontSize);
              drawCenteredText(page, String(subjMapData.total), colX[6], y - 19, 55, thaiFontBold, subFontSize);
              drawCenteredText(page, String(subjMapData.grade), colX[7], y - 19, 55, thaiFontBold, subFontSize);
            }
          } else {
            const colX = [0, 240, 290, 345, 400, 450, 500].map(x => tableLeft + x);
            for (let i = 1; i < colX.length - 1; i++) {
              page.drawLine({ start: { x: colX[i], y }, end: { x: colX[i], y: y - rowH }, thickness: 0.5, color: rgb(0, 0, 0) });
            }

            if (isHeader) {
              drawLeftText(page, subjMapData, colX[0], y - 19, thaiFontBold, subFontSize, 6);
            } else {
              drawLeftText(page, `${subjMapData.code} ${subjMapData.name}`, colX[0], y - 19, thaiFont, subFontSize, 6);
              drawCenteredText(page, String(subjMapData.hours), colX[1], y - 19, 50, thaiFont, subFontSize);
              drawCenteredText(page, String(subjMapData.s1), colX[2], y - 19, 55, thaiFont, subFontSize);
              drawCenteredText(page, String(subjMapData.s2), colX[3], y - 19, 55, thaiFont, subFontSize);
              drawCenteredText(page, String(subjMapData.total), colX[4], y - 19, 50, thaiFontBold, subFontSize);
              drawCenteredText(page, String(subjMapData.grade), colX[5], y - 19, 50, thaiFontBold, subFontSize);
            }
          }
          y -= rowH;
        };

        if (baseSubjects.length > 0) {
          drawRow('รายวิชาพื้นฐาน', true);
          baseSubjects.forEach(sub => {
            const s1 = getStudentScore(student.student_code, sub.subject_code, 1);
            const m1 = getStudentScore(student.student_code, sub.subject_code, 1, null, 'mid') ?? '-';
            const f1 = getStudentScore(student.student_code, sub.subject_code, 1, null, 'fin') ?? '-';
            const s2 = getStudentScore(student.student_code, sub.subject_code, 2);
            const m2 = getStudentScore(student.student_code, sub.subject_code, 2, null, 'mid') ?? '-';
            const f2 = getStudentScore(student.student_code, sub.subject_code, 2, null, 'fin') ?? '-';
            const total = s1 !== null && s2 !== null ? Number(s1) + Number(s2) : null;
            const hours = (sub.credit || 1) * 40;
            drawRow({
              code: sub.subject_code, name: sub.subject_name, hours,
              s1: s1 ?? '-', s2: s2 ?? '-',
              m1, f1, m2, f2,
              total: total !== null ? total : '-',
              grade: total !== null ? calculateGrade(total) : '-'
            });
          });
        }
        if (addSubjects.length > 0) {
          drawRow('รายวิชาเพิ่มเติม', true);
          addSubjects.forEach(sub => {
            const s1 = getStudentScore(student.student_code, sub.subject_code, 1);
            const m1 = getStudentScore(student.student_code, sub.subject_code, 1, null, 'mid') ?? '-';
            const f1 = getStudentScore(student.student_code, sub.subject_code, 1, null, 'fin') ?? '-';
            const s2 = getStudentScore(student.student_code, sub.subject_code, 2);
            const m2 = getStudentScore(student.student_code, sub.subject_code, 2, null, 'mid') ?? '-';
            const f2 = getStudentScore(student.student_code, sub.subject_code, 2, null, 'fin') ?? '-';
            const total = s1 !== null && s2 !== null ? Number(s1) + Number(s2) : null;
            const hours = (sub.credit || 1) * 40;
            drawRow({
              code: sub.subject_code, name: sub.subject_name, hours,
              s1: s1 ?? '-', s2: s2 ?? '-',
              m1, f1, m2, f2,
              total: total !== null ? total : '-',
              grade: total !== null ? calculateGrade(total) : '-'
            });
          });
        }
        if (actSubjects.length > 0) {
          drawRow('กิจกรรมพัฒนาผู้เรียน', true);
          actSubjects.forEach(sub => {
            const s1 = getStudentScore(student.student_code, sub.subject_code, 1);
            const s2 = getStudentScore(student.student_code, sub.subject_code, 2);
            const pass = (s1 === 'ผ' || s2 === 'ผ' || Number(s1) > 0 || Number(s2) > 0) ? 'ผ' : (s1 || s2 ? 'มผ' : '-');
            const pass1 = s1 === 'ผ' || Number(s1) > 0 ? 'ผ' : (s1 ? 'มผ' : '-');
            const pass2 = s2 === 'ผ' || Number(s2) > 0 ? 'ผ' : (s2 ? 'มผ' : '-');
            const hours = (sub.credit || 1) * 40;
            drawRow({
              code: sub.subject_code, name: sub.subject_name, hours,
              s1: pass1, s2: pass2,
              m1: '-', f1: '-', m2: '-', f2: '-',
              total: '-', grade: pass
            });
          });
        }

        // ===== สรุปผลการเรียนท้ายกระดาษ =====
        y -= 30;

        const allScores = subjects.map(subj => {
          const s1 = getStudentScore(student.student_code, subj.subject_code, 1);
          const s2 = getStudentScore(student.student_code, subj.subject_code, 2);
          return s1 !== null && s2 !== null ? Number(s1) + Number(s2) : null;
        }).filter(s => s !== null) as number[];

        const avgScore = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2) : '-';
        const gpaScores = allScores.map(s => Number(calculateGrade(s))).filter(g => !isNaN(g));
        const gpa = gpaScores.length > 0 ? (gpaScores.reduce((a, b) => a + b, 0) / gpaScores.length).toFixed(2) : '-';

        page.drawRectangle({ x: tableLeft, y: y - 28, width: colWidthSum, height: 28, color: rgb(0.96, 0.96, 0.96), borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
        drawLeftText(page, `สรุปผลการเรียน:  คะแนนเฉลี่ยรวม ${avgScore} คะแนน    เกรดเฉลี่ย (GPA) ${gpa}    จำนวนวิชาที่ประเมิน ${allScores.length}/${subjects.length} วิชา`, tableLeft, y - 19, thaiFontBold, 10, 8);
        y -= 28;

        // ===== ลายเซ็น =====
        const sigY = Math.min(y - 40, 120);

        // ลายเซ็น 3 ช่อง
        const sig1X = 50;
        const sig2X = width / 2 - 60;
        const sig3X = width - 200;

        [
          { x: sig1X, label: 'ครูประจำชั้น' },
          { x: sig2X, label: 'หัวหน้าวิชาการ' },
          { x: sig3X, label: 'ผู้อำนวยการโรงเรียน' },
        ].forEach(sig => {
          page.drawText('( ................................................ )', { x: sig.x, y: sigY, size: 11, font: thaiFont });
          drawCenteredText(page, sig.label, sig.x, sigY - 16, 140, thaiFontBold, 11);
        });

        // วันที่ส่งออก (ด้านล่างสุด)
        const dateStr = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        page.drawText(`พิมพ์เมื่อ ${dateStr}`, { x: width - 160, y: 30, size: 8, font: thaiFont, color: rgb(0.5, 0.5, 0.5) });
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
        const pp1LabelSize = 16;
        page1.drawText('โรงเรียน', { x: 30, y, size: pp1LabelSize, font: thaiFontBold });
        page1.drawText(schoolName, { x: 105, y, size: pp1LabelSize, font: thaiFont });
        y -= 22;
        page1.drawText('สังกัด', { x: 30, y, size: pp1LabelSize, font: thaiFontBold });
        page1.drawText('สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน', { x: 105, y, size: pp1LabelSize, font: thaiFont });
        y -= 22;
        page1.drawText('ตำบล/แขวง', { x: 30, y, size: pp1LabelSize, font: thaiFontBold });
        page1.drawText('ปราสาท', { x: 105, y, size: pp1LabelSize, font: thaiFont });
        y -= 22;
        page1.drawText('เขต/อำเภอ', { x: 30, y, size: pp1LabelSize, font: thaiFontBold });
        page1.drawText('บ้านกรวด', { x: 105, y, size: pp1LabelSize, font: thaiFont });
        y -= 22;
        page1.drawText('จังหวัด', { x: 30, y, size: pp1LabelSize, font: thaiFontBold });
        page1.drawText('บุรีรัมย์', { x: 105, y, size: pp1LabelSize, font: thaiFont });
        y -= 22;
        page1.drawText('สำนักงานเขตพื้นที่การศึกษา', { x: 30, y, size: pp1LabelSize, font: thaiFontBold });
        page1.drawText('ประถมศึกษาบุรีรัมย์ เขต 2', { x: 175, y, size: pp1LabelSize, font: thaiFont });
        y -= 22;
        page1.drawText('วันเข้าเรียน', { x: 30, y, size: pp1LabelSize, font: thaiFontBold });
        page1.drawText('-', { x: 105, y, size: pp1LabelSize, font: thaiFont });
        y -= 24;
        page1.drawText('โรงเรียนเดิม', { x: 30, y, size: pp1LabelSize, font: thaiFontBold });
        page1.drawText('-', { x: 105, y, size: pp1LabelSize, font: thaiFont });
        y -= 24;
        page1.drawText('จังหวัด', { x: 30, y, size: pp1LabelSize, font: thaiFontBold });
        page1.drawText('-', { x: 105, y, size: pp1LabelSize, font: thaiFont });
        y -= 24;
        page1.drawText('ชั้นเรียนสุดท้าย', { x: 30, y, size: pp1LabelSize, font: thaiFontBold });
        page1.drawText('-', { x: 115, y, size: pp1LabelSize, font: thaiFont });

        // --- Header Right ---
        y = height - 70;
        const rawName = student.student_name.split(' ');
        const fName = rawName[0] || '';
        const lName = rawName[1] || '';
        const pp1InfoSize = 16;

        page1.drawText('ชื่อ', { x: 280, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText(fName, { x: 350, y, size: pp1InfoSize, font: thaiFont });
        y -= 22;
        page1.drawText('ชื่อสกุล', { x: 280, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText(lName, { x: 350, y, size: pp1InfoSize, font: thaiFont });
        y -= 22;
        page1.drawText('เลขประจำตัวนักเรียน', { x: 280, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText(student.student_code, { x: 400, y, size: pp1InfoSize, font: thaiFont });
        y -= 22;
        page1.drawText('เลขประประชาชน', { x: 280, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText('-', { x: 400, y, size: pp1InfoSize, font: thaiFont });
        y -= 22;
        page1.drawText('เกิดวันที่', { x: 280, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText('-', { x: 340, y, size: pp1InfoSize, font: thaiFont });
        page1.drawText('เดือน', { x: 375, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText('-', { x: 415, y, size: pp1InfoSize, font: thaiFont });
        page1.drawText('พ.ศ.', { x: 455, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText('-', { x: 485, y, size: pp1InfoSize, font: thaiFont });
        y -= 22;
        page1.drawText('เพศ', { x: 280, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText('-', { x: 315, y, size: pp1InfoSize, font: thaiFont });
        page1.drawText('สัญชาติ', { x: 355, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText('ไทย', { x: 405, y, size: pp1InfoSize, font: thaiFont });
        page1.drawText('ศาสนา', { x: 445, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText('พุทธ', { x: 485, y, size: pp1InfoSize, font: thaiFont });
        y -= 22;
        page1.drawText('ชื่อ-ชื่อสกุลบิดา', { x: 280, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText('-', { x: 380, y, size: pp1InfoSize, font: thaiFont });
        y -= 22;
        page1.drawText('ชื่อ-ชื่อสกุลมารดา', { x: 280, y, size: pp1InfoSize, font: thaiFontBold });
        page1.drawText('-', { x: 380, y, size: pp1InfoSize, font: thaiFont });

        // Photo Box
        page1.drawRectangle({ x: 500, y: height - 150, width: 70, height: 90, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });

        // --- Table 1 Title ---
        y = height - 240;
        page1.drawText('ผลการเรียนรายวิชา', { x: width / 2 - 45, y, size: 16, font: thaiFontBold });

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
          page1.drawText('รหัส/รายวิชา', { x: cx + 40, y: tableYStart - 25, size: 12, font: thaiFontBold });

          // Rotated texts
          page1.drawText('เวลา(ชั่วโมง)', { x: cx + subCol1W + 14, y: tableYStart - 35, size: 11, font: thaiFontBold, rotate: degrees(90) });
          page1.drawText('ผลการเรียน', { x: cx + subCol1W + subCol2W + 14, y: tableYStart - 35, size: 11, font: thaiFontBold, rotate: degrees(90) });
        }

        // --- Table 1 Data ---
        for (let c = 0; c < 3; c++) {
          let curY = tableYStart - headerHeight - 14;
          const cx = colStartX + (c * colWidth);
          const years = yearsGroups[c];

          years.forEach(yr => {
            const gradeLevel = yr - 2560;
            page1.drawText(`ปีการศึกษา ${yr} ชั้น ป.${gradeLevel}`, { x: cx + 2, y: curY, size: 11, font: thaiFontBold });
            curY -= 14;

            // พื้นฐาน
            page1.drawText(`รายวิชาพื้นฐาน`, { x: cx + 2, y: curY, size: 11, font: thaiFontBold });
            curY -= 14;

            const baseSubjects = allData.filter(d => d.type === 'subject' && d.class_level.includes(gradeLevel.toString()) && (d.subject_type === 'พื้นฐาน' || (!d.subject_type && !d.subject_name.includes('เพิ่มเติม') && !d.subject_name.includes('กิจกรรม') && !d.subject_name.includes('หน้าที่พลเมือง') && !d.subject_name.includes('ทุจริต'))));
            baseSubjects.forEach(sub => {
              const s1 = getStudentScore(student.student_code, sub.subject_code, 1, yr);
              const s2 = getStudentScore(student.student_code, sub.subject_code, 2, yr);
              const total = (s1 !== null && s2 !== null) ? Number(s1) + Number(s2) : null;
              const grade = total !== null ? calculateGrade(total) : '';
              const hours = (sub.credit || 1) * 40;

              page1.drawText(`${sub.subject_code} ${sub.subject_name.slice(0, 22)}`, { x: cx + 2, y: curY, size: 11, font: thaiFont });
              page1.drawText(String(hours), { x: cx + subCol1W + 4, y: curY, size: 11, font: thaiFont });
              page1.drawText(String(grade), { x: cx + subCol1W + subCol2W + 4, y: curY, size: 11, font: thaiFont });
              curY -= 14;
            });

            // เพิ่มเติม
            page1.drawText(`รายวิชาเพิ่มเติม`, { x: cx + 2, y: curY, size: 11, font: thaiFontBold });
            curY -= 14;

            const addSubjects = allData.filter(d => d.type === 'subject' && d.class_level.includes(gradeLevel.toString()) && (d.subject_type === 'เพิ่มเติม' || d.subject_name.includes('หน้าที่พลเมือง') || d.subject_name.includes('ทุจริต')));
            addSubjects.forEach(sub => {
              const s1 = getStudentScore(student.student_code, sub.subject_code, 1, yr);
              const s2 = getStudentScore(student.student_code, sub.subject_code, 2, yr);
              const total = (s1 !== null && s2 !== null) ? Number(s1) + Number(s2) : null;
              const grade = total !== null ? calculateGrade(total) : '';
              const hours = (sub.credit || 1) * 40;

              page1.drawText(`${sub.subject_code} ${sub.subject_name.slice(0, 22)}`, { x: cx + 2, y: curY, size: 11, font: thaiFont });
              page1.drawText(String(hours), { x: cx + subCol1W + 4, y: curY, size: 11, font: thaiFont });
              page1.drawText(String(grade), { x: cx + subCol1W + subCol2W + 4, y: curY, size: 11, font: thaiFont });
              curY -= 14;
            });
            curY -= 6;
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

                    <div className="w-full lg:flex-1 flex flex-col sm:flex-row gap-3 lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                        <span className="text-[10px] font-bold text-slate-400">เทอม</span>
                        <button
                          onClick={() => setScoringStyle(scoringStyle === 'simple' ? 'detailed' : 'simple')}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${scoringStyle === 'detailed' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${scoringStyle === 'detailed' ? 'translate-x-5' : ''}`} />
                        </button>
                        <span className="text-[10px] font-bold text-emerald-700">คะแนนเก็บ</span>
                        {scoringStyle === 'detailed' && selectedSubject && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {currentRatio.midMax}:{currentRatio.finMax}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 max-w-md mx-2 flex gap-2">
                        <select
                          value={selectedSubject?.subject_code || ''}
                          onChange={(e) => handleSelectSubject(e.target.value)}
                          className="flex-1 px-4 py-2 text-sm border-2 border-emerald-200 hover:border-emerald-400 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold bg-white text-emerald-800 cursor-pointer transition-colors shadow-sm"
                        >
                          {subjects.length === 0 ? <option value="">ไม่มีวิชา</option> : subjects.map(subj => (
                            <option key={subj.subject_code} value={subj.subject_code}>
                              {subj.subject_code} - {subj.subject_name} {isSubjectComplete(subj.subject_code) ? '✓ (กรอกครบ)' : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const pwd = prompt('กรุณากรอกรหัสผ่าน Admin เพื่อจัดการวิชานี้:');
                            if (pwd === '31020177') {
                              setSubjectAdminData(selectedSubject);
                              setIsSubjectAdminModalOpen(true);
                            } else if (pwd !== null) {
                              showToast('⚠️ รหัสผ่านไม่ถูกต้อง');
                            }
                          }}
                          className="p-2 bg-white border-2 border-emerald-200 text-emerald-600 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all shadow-sm flex items-center justify-center"
                          title="จัดการ/ปลดล็อค วิชานี้"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => exportPP6PDF(null, false, 'mode1')} className="px-5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap active:scale-95">
                          📄 ปพ.6
                        </button>
                        <button onClick={() => exportPP1PDF()} className="px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap active:scale-95">
                          📜 ปพ.1
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full px-4 sm:px-0">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-y-2 border-emerald-100 bg-emerald-50/50">
                            <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-emerald-800">เลขที่</th>
                            <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-emerald-800">ชื่อ-นามสกุล</th>
                            {scoringStyle === 'simple' ? (
                              <>
                                <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-emerald-800">เทอม 1 (50)</th>
                                <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-emerald-800">เทอม 2 (50)</th>
                              </>
                            ) : (
                              <>
                                <th className="px-1 sm:px-2 py-3 text-center text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50/30">{`เทอม 1 (${currentRatio.midMax})`}</th>
                                <th className="px-1 sm:px-2 py-3 text-center text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50/30 border-r border-emerald-100">{`สอบ 1 (${currentRatio.finMax})`}</th>
                                <th className="px-1 sm:px-2 py-3 text-center text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50/30">{`เทอม 2 (${currentRatio.midMax})`}</th>
                                <th className="px-1 sm:px-2 py-3 text-center text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50/30">{`สอบ 2 (${currentRatio.finMax})`}</th>
                              </>
                            )}
                            <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-emerald-900 bg-emerald-100/50">รวม / เกรด</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-50">
                          {(!selectedSubject || students.length === 0) ? (
                            <tr><td colSpan={scoringStyle === 'simple' ? 6 : 8} className="text-center py-16 text-emerald-500 bg-emerald-50/20 font-medium">เลือกวิชาจากด้านบนเพื่อเริ่มกรอกคะแนน</td></tr>
                          ) : students.map((student, index) => {
                            const score1 = getStudentScore(student.student_code, selectedSubject.subject_code, 1);
                            const score2 = getStudentScore(student.student_code, selectedSubject.subject_code, 2);

                            const mid1 = getStudentScore(student.student_code, selectedSubject.subject_code, 1, null, 'mid');
                            const fin1 = getStudentScore(student.student_code, selectedSubject.subject_code, 1, null, 'fin');
                            const mid2 = getStudentScore(student.student_code, selectedSubject.subject_code, 2, null, 'mid');
                            const fin2 = getStudentScore(student.student_code, selectedSubject.subject_code, 2, null, 'fin');

                            const totalScore = score1 !== null && score2 !== null ? Number(score1) + Number(score2) : null;
                            const grade = totalScore !== null ? calculateGrade(totalScore, 100) : null;

                            const isLocked = isSubjectComplete(selectedSubject.subject_code) && !unlockedSubjects.includes(selectedSubject.subject_code);

                            return (
                              <tr key={student.student_code}
                                className={`hover:bg-emerald-50/40 transition-colors ${isLocked ? 'bg-slate-50/50' : ''}`}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  const pwd = prompt('กรุณากรอกรหัสผ่าน Admin เพื่อแจ้งย้ายออกนักเรียน:');
                                  if (pwd === '31020177') {
                                    if (confirm(`ยืนยันการระบุสถานะ "ย้ายออก" ให้คุณ ${student.student_name}?\nชื่อจะหายไปจากหน้านี้และไปอยู่ในถังขยะ Admin`)) {
                                      // เรียกใช้ฟังก์ชันที่มีอยู่แล้วแต่ปรับให้บันทึกถาวร
                                      setSelectedStudentStatus(student);
                                      setTimeout(() => updateStudentStatus('ย้ายออก'), 100);
                                    }
                                  } else if (pwd !== null) {
                                    showToast('⚠️ รหัสผ่านไม่ถูกต้อง');
                                  }
                                }}
                              >
                                <td className="px-2 sm:px-4 py-3">
                                  <input
                                    type="number"
                                    value={student.order_index || ''}
                                    placeholder={String(index + 1)}
                                    onDoubleClick={() => updateStudentOrder(student.student_code, '')}
                                    onChange={(e) => updateStudentOrder(student.student_code, e.target.value)}
                                    className="w-10 sm:w-12 text-center text-xs sm:text-sm font-bold text-emerald-600 bg-transparent border-b border-transparent hover:border-emerald-300 focus:border-emerald-500 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    title="ดับเบิลคลิกเพื่อล้างเลขที่"
                                  />
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

                                {scoringStyle === 'simple' ? (
                                  <>
                                    <td className="px-2 sm:px-4 py-3 text-center">
                                      <input type="number" value={score1 ?? ''} min="0" max="50" placeholder="-"
                                        disabled={isLocked}
                                        onKeyDown={(e) => handleKeyDown(e, index, 1)}
                                        onChange={(e) => updateScoreRealtime(student.student_code, 1, e.target.value)}
                                        className={`w-14 sm:w-16 px-1 py-1.5 text-xs sm:text-sm font-semibold border-2 border-slate-200 rounded-md text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow ${isLocked ? 'bg-slate-100 cursor-not-allowed border-dashed' : 'bg-white hover:border-emerald-300'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                                    </td>
                                    <td className="px-2 sm:px-4 py-3 text-center">
                                      <input type="number" value={score2 ?? ''} min="0" max="50" placeholder="-"
                                        disabled={isLocked}
                                        onKeyDown={(e) => handleKeyDown(e, index, 2)}
                                        onChange={(e) => updateScoreRealtime(student.student_code, 2, e.target.value)}
                                        className={`w-14 sm:w-16 px-1 py-1.5 text-xs sm:text-sm font-semibold border-2 border-slate-200 rounded-md text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow ${isLocked ? 'bg-slate-100 cursor-not-allowed border-dashed' : 'bg-white hover:border-emerald-300'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-1 py-3 text-center bg-emerald-50/20">
                                      <input type="number" value={mid1 ?? ''} min="0" max={currentRatio.midMax} placeholder="-"
                                        data-index={index} data-semester={1} data-field="mid"
                                        onKeyDown={(e) => handleKeyDown(e, index, 1)}
                                        onChange={(e) => updateScoreRealtime(student.student_code, 1, e.target.value, 'mid')}
                                        className="w-10 sm:w-12 px-0.5 py-1 text-xs border border-slate-200 rounded text-center focus:border-emerald-500 outline-none" />
                                    </td>
                                    <td className="px-1 py-3 text-center bg-emerald-50/20 border-r border-emerald-50">
                                      <input type="number" value={fin1 ?? ''} min="0" max={currentRatio.finMax} placeholder="-"
                                        data-index={index} data-semester={1} data-field="fin"
                                        onKeyDown={(e) => handleKeyDown(e, index, 1)}
                                        onChange={(e) => updateScoreRealtime(student.student_code, 1, e.target.value, 'fin')}
                                        className="w-10 sm:w-12 px-0.5 py-1 text-xs border border-slate-200 rounded text-center focus:border-emerald-500 outline-none" />
                                    </td>
                                    <td className="px-1 py-3 text-center bg-emerald-50/20">
                                      <input type="number" value={mid2 ?? ''} min="0" max={currentRatio.midMax} placeholder="-"
                                        data-index={index} data-semester={2} data-field="mid"
                                        onKeyDown={(e) => handleKeyDown(e, index, 2)}
                                        onChange={(e) => updateScoreRealtime(student.student_code, 2, e.target.value, 'mid')}
                                        className="w-10 sm:w-12 px-0.5 py-1 text-xs border border-slate-200 rounded text-center focus:border-emerald-500 outline-none" />
                                    </td>
                                    <td className="px-1 py-3 text-center bg-emerald-50/20">
                                      <input type="number" value={fin2 ?? ''} min="0" max={currentRatio.finMax} placeholder="-"
                                        data-index={index} data-semester={2} data-field="fin"
                                        onKeyDown={(e) => handleKeyDown(e, index, 2)}
                                        onChange={(e) => updateScoreRealtime(student.student_code, 2, e.target.value, 'fin')}
                                        className="w-10 sm:w-12 px-0.5 py-1 text-xs border border-slate-200 rounded text-center focus:border-emerald-500 outline-none" />
                                    </td>
                                  </>
                                )}

                                <td className="px-2 sm:px-4 py-3 text-center bg-emerald-50/30">
                                  <div className="text-sm sm:text-base font-bold flex items-center justify-center gap-1">
                                    <span className={totalScore !== null ? 'text-emerald-800' : 'text-emerald-300'}>{totalScore !== null ? totalScore : '-'}</span>
                                    <span className="text-emerald-300 text-xs sm:text-sm font-normal">/</span>
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
                  onChange={(e) => { setAdminSelectedRoom(e.target.value); }}
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
                    <button onClick={clearAllScoresGlobally} className="text-xs font-bold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1">
                      🗑️ ล้างคะแนนทั้งหมด
                    </button>
                    <label className="cursor-pointer text-xs font-bold bg-white border border-emerald-200 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1">
                      📂 กู้คืน(JSON)
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

                  {/* กล่องรายวิชา (แก้แบบ Modal) */}
                  <div className="border border-emerald-100 rounded-xl overflow-hidden shadow-sm flex flex-col">
                    <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex justify-between items-center flex-wrap gap-2">
                      <h3 className="font-bold text-emerald-800">วิชาที่สอน</h3>
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md border border-emerald-200">วิชามาตรฐานอัตโนมัติ</span>
                    </div>

                    <div className="flex-1 bg-white p-2 flex flex-col min-h-[400px] max-h-[400px]">
                      <ul className="divide-y divide-emerald-50 overflow-y-auto flex-1">
                        {adminSubjects.length > 0 ? adminSubjects.map((sb) => (
                          <li key={sb.subject_code}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setSubjectAdminData(sb);
                              setIsSubjectAdminModalOpen(true);
                            }}
                            className="p-2 hover:bg-emerald-50/50 rounded-lg flex flex-col group relative cursor-context-menu"
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-sm font-semibold text-slate-700">{sb.subject_name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${sb.subject_type === 'เพิ่มเติม' ? 'bg-blue-100 text-blue-700' : (sb.subject_type === 'กิจกรรม' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}`}>
                                {sb.subject_type || 'พื้นฐาน'}
                              </span>
                            </div>
                            <span className="text-xs text-emerald-600 mt-1">
                              รหัส: {sb.subject_code} | {sb.credit || 1} ชม./นก. | คะแนนเต็ม: {sb.max_score || 100}
                            </span>
                          </li>
                        )) : <li className="p-4 text-center text-sm text-emerald-400 font-medium mt-10">ไม่มีข้อมูลวิชา</li>}
                      </ul>
                    </div>
                  </div>

                  {/* กล่องถังขยะนักเรียน (Trash) */}
                  <div className="border border-rose-100 rounded-xl overflow-hidden shadow-sm flex flex-col md:col-span-2">
                    <div className="bg-rose-50 px-4 py-3 border-b border-rose-100 flex justify-between items-center">
                      <h3 className="font-bold text-rose-800 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        นักเรียนที่ย้ายออก (ถังขยะ)
                      </h3>
                      <span className="text-xs font-bold bg-white border border-rose-200 text-rose-600 px-2 py-1 rounded-md">{trashStudents.length} คน</span>
                    </div>
                    <div className="bg-white p-2 min-h-[150px] max-h-[300px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left">รหัส/ชื่อ-นามสกุล</th>
                            <th className="px-4 py-2 text-left">ชั้นเรียน</th>
                            <th className="px-4 py-2 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {trashStudents.length > 0 ? trashStudents.map(st => (
                            <tr key={st.student_code} className="hover:bg-rose-50/30 transition-colors">
                              <td className="px-4 py-2">
                                <div className="font-semibold text-slate-700">{st.student_name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{st.student_code}</div>
                              </td>
                              <td className="px-4 py-2 text-xs font-medium text-slate-500">{st.class_level}</td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => { setSelectedStudentStatus(st); updateStudentStatus('ปกติ'); }}
                                    className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition-all"
                                  >
                                    กู้คืน
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (confirm(`⚠️ ยืนยันการลบ ${st.student_name} ออกจากระบบถาวร?\nข้อมูลคะแนนทั้งหมดจะถูกลบไปด้วย!`)) {
                                        let newData = allData.filter(d => !(d.student_code === st.student_code && d.year === Number(selectedYear)));
                                        setAllData(newData);
                                        if (window.dataSdk) {
                                          await window.dataSdk.delete(st.id || st._id);
                                          showToast('ลบข้อมูลถาวรเรียบร้อย');
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[10px] font-bold hover:bg-rose-500 hover:text-white transition-all"
                                  >
                                    ลบถาวร
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">ไม่มีข้อมูลในถังขยะ</td></tr>
                          )}
                        </tbody>
                      </table>
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
              <button onClick={() => exportPP6PDF(null, false, pp6Mode)} className="w-full px-4 py-3 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-2 border-indigo-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                📄 ส่งออก ปพ.6 (รายงานรายปี)
              </button>
              <button onClick={() => exportPP1PDF()} className="w-full px-4 py-3 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border-2 border-blue-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
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

                <button
                  onClick={clearAllScoresForSubject}
                  className="w-full py-2.5 bg-red-50 text-red-600 border-2 border-red-100 hover:bg-red-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                >
                  🗑️ ลบคะแนนทั้งหมดของวิชานี้
                </button>

                <h4 className="text-xs font-bold text-slate-400 mt-6 px-1 uppercase tracking-wider">ย้ายคะแนน (กรณีครูกรอกผิดวิชา)</h4>
                {!isMoveAuthorized ? (
                  <button
                    onClick={() => {
                      if (adminAuthInput === '31020177') setIsMoveAuthorized(true);
                      else showToast('⚠️ รหัสผ่านไม่ถูกต้อง');
                    }}
                    className="w-full py-2.5 bg-rose-50 text-rose-700 border-2 border-rose-100 hover:border-rose-300 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    🔐 กดเพื่อแสดงส่วนการย้ายคะแนน
                  </button>
                ) : (
                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 space-y-2">
                    <p className="text-[10px] text-rose-600 leading-tight">* ฟังก์ชันนี้จะย้ายคะแนน "ทั้งหมด" ของปีนี้ จากวิชานี้ไปยังรายวิชาอื่นในชั้นเดียวกัน</p>
                    <div className="flex flex-col gap-2">
                      <select
                        value={moveTargetCode}
                        onChange={(e) => setMoveTargetCode(e.target.value)}
                        className="w-full px-3 py-2 text-sm border-2 border-rose-200 rounded-lg outline-none bg-white focus:border-rose-500"
                      >
                        <option value="">-- เลือกวิชาปลายทาง --</option>
                        {subjects.filter(s => s.subject_code !== subjectAdminData?.subject_code).map(s => (
                          <option key={s.subject_code} value={s.subject_code}>
                            {s.subject_code} - {s.subject_name}
                          </option>
                        ))}
                      </select>
                      <button onClick={moveScoresToSubject} className="w-full py-2 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700 transition-all shadow-sm">
                        🚀 ย้ายคะแนนทั้งหมดทันที
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
              <p className="text-[10px] text-slate-400">ระบบรักษาความปลอดภัย ข้อมูลถูก Sync ไปยังระบบ D1 ทันที</p>
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
      {
        selectedStudentStatus && (
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
      {toast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}
    </div >
  );
}
