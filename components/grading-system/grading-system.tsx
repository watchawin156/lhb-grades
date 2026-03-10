'use client';

import { useState, useEffect } from 'react';
import {
  Users, BookOpen, Table as TableIcon, Download, Upload, Plus, Trash2, Save,
  ChevronRight, ChevronLeft, LayoutDashboard, FileSpreadsheet, X, FileText,
  Menu, Settings, FileBarChart, Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { cn, calculateGrade, getGradeColor } from '@/lib/grading-utils';
import { Student, Subject, ScoreRecord, SidebarItem, SidebarSubItem } from './types';
import DashboardView from './DashboardView';
import GradingView from './GradingView';
import TranscriptView from './TranscriptView';
import GradingModals from './GradingModals';
import Sidebar from './Sidebar';
import { generatePDF as generatePDFUtil } from './pdfGenerator';

const STANDARD_SUBJECTS_P13: Partial<Subject>[] = [
  { code: 'ท11101', name: 'ภาษาไทย', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ค11101', name: 'คณิตศาสตร์', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ว11101', name: 'วิทยาศาสตร์และเทคโนโลยี', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ส11101', name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ส11102', name: 'ประวัติศาสตร์', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'พ11101', name: 'สุขศึกษาและพลศึกษา', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ศ11101', name: 'ศิลปะ', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ง11101', name: 'การงานอาชีพ', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'อ11101', name: 'ภาษาต่างประเทศ (อังกฤษ)', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ส11231', name: 'หน้าที่พลเมือง', type: 'เพิ่มเติม', credit: 0.5, maxScore: 100 },
  { code: 'ว11201', name: 'ต้านทุจริตศึกษา', type: 'เพิ่มเติม', credit: 0.5, maxScore: 100 },
];

const STANDARD_SUBJECTS_P46: Partial<Subject>[] = [
  { code: 'ท14101', name: 'ภาษาไทย', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ค14101', name: 'คณิตศาสตร์', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ว14101', name: 'วิทยาศาสตร์และเทคโนโลยี', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ส14101', name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ส14102', name: 'ประวัติศาสตร์', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'พ14101', name: 'สุขศึกษาและพลศึกษา', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ศ14101', name: 'ศิลปะ', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ง14101', name: 'การงานอาชีพ', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'อ14101', name: 'ภาษาต่างประเทศ (อังกฤษ)', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
  { code: 'ส14234', name: 'หน้าที่พลเมือง', type: 'เพิ่มเติม', credit: 0.5, maxScore: 100 },
  { code: 'ว14201', name: 'ต้านทุจริตศึกษา', type: 'เพิ่มเติม', credit: 0.5, maxScore: 100 },
];

export default function GradingSystem() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeSemester, setActiveSemester] = useState<number>(1);
  const [gradingGrade, setGradingGrade] = useState<string>('');
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // ย่อเป็นค่าเริ่มต้น
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all'); // เพิ่มตัวกรองชั้นเรียน
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSubjectMenuOpen, setIsSubjectMenuOpen] = useState(false);
  const [academicYear, setAcademicYear] = useState<number>(2568);
  const [defaultAcademicYear, setDefaultAcademicYear] = useState<number>(2568);
  const [lockedYear, setLockedYear] = useState<number | null>(null);
  const [isYearSettingsOpen, setIsYearSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedTranscriptStudentId, setSelectedTranscriptStudentId] = useState<string | null>(null);
  const [selectedTranscriptRoom, setSelectedTranscriptRoom] = useState<string>('all');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isTelegramBacking, setIsTelegramBacking] = useState(false);
  const [lastTelegramBackup, setLastTelegramBackup] = useState<Date | null>(null);
  const [telegramBackupStatus, setTelegramBackupStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const [newSubject, setNewSubject] = useState<Partial<Subject>>({
    code: '',
    name: '',
    maxScore: 100,
    semester: 1,
    type: 'พื้นฐาน',
    credit: 1
  });
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportSelectedStudent, setReportSelectedStudent] = useState<string>('all');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [cachedFonts, setCachedFonts] = useState<{ regular: ArrayBuffer, bold: ArrayBuffer } | null>(null);

  // New Modals State
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [clearDataCode, setClearDataCode] = useState('');
  const [isStandardSubjectModalOpen, setIsStandardSubjectModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [standardSubjectsTemplate, setStandardSubjectsTemplate] = useState<Partial<Subject>[]>([
    { name: 'ภาษาไทย', type: 'พื้นฐาน', credit: 1 },
    { name: 'คณิตศาสตร์', type: 'พื้นฐาน', credit: 1 },
    { name: 'วิทยาศาสตร์และเทคโนโลยี', type: 'พื้นฐาน', credit: 1 },
    { name: 'ภาษาอังกฤษ', type: 'พื้นฐาน', credit: 1 },
    { name: 'สังคมศึกษา ศาสนา และวัฒนธรรม', type: 'พื้นฐาน', credit: 1 },
    { name: 'หน้าที่พลเมือง', type: 'พื้นฐาน', credit: 1 },
    { name: 'ประวัติศาสตร์', type: 'พื้นฐาน', credit: 1 },
    { name: 'การงานอาชีพ', type: 'พื้นฐาน', credit: 1 },
    { name: 'สังคม เพิ่มเติม (ป้องกันทุจริต)', type: 'เพิ่มเติม', credit: 1 },
    { name: 'ศิลปะ', type: 'พื้นฐาน', credit: 1 },
    { name: 'สุขศึกษาและพลศึกษา', type: 'พื้นฐาน', credit: 1 },
    { name: 'เพิ่มเติม (หน้าที่พลเมือง)', type: 'เพิ่มเติม', credit: 1 },
  ]);
  // Pre-load fonts for fast PDF generation
  useEffect(() => {
    async function preLoadFonts() {
      try {
        const fontUrl = 'https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNew.ttf';
        const fontBoldUrl = 'https://raw.githubusercontent.com/watchawin156/font/main/THSarabunNewBold.ttf';
        const [fRegular, fBold] = await Promise.all([
          fetch(fontUrl).then(res => res.arrayBuffer()),
          fetch(fontBoldUrl).then(res => res.arrayBuffer())
        ]);
        setCachedFonts({ regular: fRegular, bold: fBold });
      } catch (e) {
        console.error('Failed to pre-load fonts:', e);
      }
    }
    preLoadFonts();
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('grading_theme');
    // Default to dark if no preference is saved
    if (savedTheme === 'dark' || !savedTheme) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      // If no theme was saved yet, save 'dark' as default preference
      if (!savedTheme) localStorage.setItem('grading_theme', 'dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, []);

  // --- Initialize Academic Year ---
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear() + 543;
    const currentMonth = now.getMonth() + 1; // 0-indexed
    const currentDay = now.getDate();

    // หากวันที่ >= 16 พฤษภาคม ให้ปรับเป็นปีการศึกษาปัจจุบัน
    // หากก่อนหน้านั้น (1 ม.ค. - 15 พ.ค.) ให้เป็นปีการศึกษาก่อนหน้า (ปีพุทธศักราช)
    let autoYear = currentYear;
    if (currentMonth < 5 || (currentMonth === 5 && currentDay < 16)) {
      autoYear = currentYear - 1;
    }

    if (defaultAcademicYear === 2568) { // Default value in state
      setDefaultAcademicYear(autoYear);
      setAcademicYear(autoYear);
    }
  }, [defaultAcademicYear]);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newTheme = !prev;
      if (newTheme) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        localStorage.setItem('grading_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        localStorage.setItem('grading_theme', 'light');
      }
      return newTheme;
    });
  };

  const forceSyncCloud = async (currentStudents: Student[], currentSubjects: Subject[], currentScores: ScoreRecord[]) => {
    setIsSaving(true);
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: currentStudents, subjects: currentSubjects, scores: currentScores }),
      });
      setLastSynced(new Date());
    } catch (e) {
      console.error("Force Cloud sync failed", e);
    }
    setIsSaving(false);
    setLastSaved(new Date());
  };

  // Load data from localStorage on mount - Updated for Safe Merge
  useEffect(() => {
    const initData = async () => {
      const loadedYearSettings = localStorage.getItem('grading_year_settings');
      if (loadedYearSettings) {
        const settings = JSON.parse(loadedYearSettings);
        setDefaultAcademicYear(settings.defaultYear);
        setLockedYear(settings.lockedYear);
        setAcademicYear(settings.defaultYear);
      }

      // 1. Get UI settings only from LocalStorage (Fallback/UI States)
      const loadedTemplate = localStorage.getItem('grading_standard_template');
      if (loadedTemplate) setStandardSubjectsTemplate(JSON.parse(loadedTemplate));

      // 2. Fetch from Cloud as Primary and Only Source
      try {
        const response = await fetch('/api/data');
        if (response.ok) {
          const cloudData = await response.json();
          setStudents(cloudData.students || []);
          setSubjects(cloudData.subjects || []);
          setScores(cloudData.scores || []);
          setLastSynced(new Date());
        }
      } catch (e) {
        console.error("Failed to load data from cloud", e);
      }
      setIsLoaded(true);
    };

    initData();
  }, []);

  const loadStudentsByFilter = async (grade: string, year: string) => {
    setIsSaving(true);
    try {
      const params = new URLSearchParams();
      if (grade) params.append('grade', grade);
      if (year) params.append('year', year);

      const response = await fetch(`/api/data?${params.toString()}`);
      if (response.ok) {
        const cloudData = await response.json();
        if (cloudData.students) {
          // Filter out Kindergarten 2 & 3
          const filteredStudents = cloudData.students.filter((s: Student) =>
            !s.class.includes('อ.2') &&
            !s.class.includes('อ.3')
          );
          setStudents(filteredStudents);
          // Optional: You might want to merge or replace scores too if they are year-specific
          // setScores(cloudData.scores || []); 
          alert(`โหลดข้อมูลนักเรียน ${filteredStudents.length} คน เรียบร้อยแล้ว`);
        }
      }
    } catch (e) {
      console.error("Failed to load filtered students", e);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }
    setIsSaving(false);
  };

  // Real-time Auto-save with Debounce
  useEffect(() => {
    if (isLoaded) {
      setIsSaving(true);

      // Save UI settings only to localStorage
      localStorage.setItem('grading_year_settings', JSON.stringify({
        defaultYear: defaultAcademicYear,
        lockedYear: lockedYear
      }));
      localStorage.setItem('grading_standard_template', JSON.stringify(standardSubjectsTemplate));

      const timer = setTimeout(async () => {
        // Debounced Cloud Sync
        try {
          const res = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students, subjects, scores }),
          });
          if (res.ok) {
            setLastSynced(new Date());
          } else {
            const err = await res.json();
            console.error("Cloud sync error:", err);
          }
        } catch (e) {
          console.error("Cloud sync network failed", e);
        }
        setIsSaving(false);
        setLastSaved(new Date());
      }, 2000); // 2 seconds debounce

      return () => clearTimeout(timer);
    }
  }, [students, subjects, scores, isLoaded, defaultAcademicYear, lockedYear]);

  // ── Telegram Auto-Backup ──
  const sendTelegramBackup = async (s: any[], sub: any[], sc: any[]) => {
    if (s.length === 0 && sub.length === 0) return; // ไม่ส่งข้อมูลเปล่า
    setIsTelegramBacking(true);
    try {
      const res = await fetch('/api/telegram-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: s, subjects: sub, scores: sc, academicYear }),
      });
      if (res.ok) {
        setLastTelegramBackup(new Date());
        setTelegramBackupStatus('ok');
      } else {
        setTelegramBackupStatus('error');
      }
    } catch {
      setTelegramBackupStatus('error');
    }
    setIsTelegramBacking(false);
  };

  // Auto-backup every 2 minutes once loaded
  useEffect(() => {
    if (!isLoaded) return;
    sendTelegramBackup(students, subjects, scores); // ส่งทันทีเมื่อเปิดแอป
    const interval = setInterval(() => {
      sendTelegramBackup(students, subjects, scores);
    }, 2 * 60 * 1000); // ทุก 2 นาที
    return () => clearInterval(interval);
  }, [isLoaded]); // เริ่มเมื่อโหลดข้อมูลแล้ว

  const restoreFromTelegram = async () => {
    if (!confirm('ต้องการโหลดข้อมูลจาก Telegram หรือไม่\n❌ คำเตือน: ข้อมูลปัจจุบันจะถูกแทนที่!')) return;
    setIsTelegramBacking(true);
    try {
      const res = await fetch('/api/telegram-backup');
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert('❌ ' + (json.error || 'ไม่สามารถโหลดข้อมูลจาก Telegram ได้'));
        setIsTelegramBacking(false);
        return;
      }
      const d = json.data;
      if (d.students) setStudents(d.students);
      if (d.subjects) setSubjects(d.subjects);
      if (d.scores) setScores(d.scores);
      if (d.academicYear) setAcademicYear(d.academicYear);
      alert('✅ โหลดข้อมูลจาก Telegram สำเร็จ!');
    } catch (e: any) {
      alert('❌ เกิดข้อผิดพลาด: ' + e.message);
    }
    setIsTelegramBacking(false);
  };
  const handleAdminLogin = () => {
    if (adminPassword === '31020177') {
      setIsAdminMode(true);
      setShowAdminLogin(false);
      setAdminPassword('');
      alert('เข้าสู่ระบบผู้ดูแลระบบสำเร็จ');
    } else {
      alert('รหัสผ่านไม่ถูกต้อง');
    }
  };

  const deleteStudent = (studentId: string) => {
    if (!isAdminMode) {
      setShowAdminLogin(true);
      return;
    }
    if (confirm('คุณต้องการลบข้อมูลนักเรียนคนนี้ใช่หรือไม่?')) {
      setStudents(prev => prev.filter(s => s.id !== studentId));
      setScores(prev => prev.filter(s => s.studentId !== studentId));
    }
  };

  const handleImportStudents = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdminMode) {
      setShowAdminLogin(true);
      // Reset the file input so it can be triggered again after login
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const results = XLSX.utils.sheet_to_json(worksheet);
        processStudentData(results);
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: (results) => processStudentData(results.data),
        error: (error) => alert(`Error: ${error.message}`)
      });
    }
  };

  const processStudentData = (data: any[]) => {
    if (data.length === 0) {
      alert('ไม่พบข้อมูลในไฟล์');
      return;
    }

    const importedOrigin = data.map((row: any, index) => {
      const normalizedRow: any = {};
      Object.keys(row).forEach(key => {
        normalizedRow[key.trim()] = row[key];
      });

      // Auto-detect fields from Thai CSV headers with more synonyms
      const code = normalizedRow['รหัสนักเรียน'] || normalizedRow['เลขประจำตัว'] || normalizedRow['code'] || '';
      const number = normalizedRow['เลขที่'] || normalizedRow['No.'] || normalizedRow['number'] || '';
      const idCard = normalizedRow['เลขประจำตัวประชาชน'] || normalizedRow['เลขบัตรประชาชน'] || normalizedRow['idCard'] || '';
      const prefix = normalizedRow['คำนำหน้าชื่อ'] || normalizedRow['คำนำหน้า'] || normalizedRow['prefix'] || '';
      const firstName = normalizedRow['ชื่อ'] || normalizedRow['ชื่อจริง'] || normalizedRow['firstName'] || normalizedRow['name'] || '';
      const lastName = normalizedRow['นามสกุล'] || normalizedRow['surname'] || normalizedRow['lastName'] || '';
      const className = normalizedRow['ชั้น'] || normalizedRow['ระดับชั้น'] || normalizedRow['grade'] || normalizedRow['class'] || '';
      const room = normalizedRow['ห้อง'] || normalizedRow['room'] || '';

      let fullName = normalizedRow['ชื่อ-นามสกุล'] || normalizedRow['ชื่อนามสกุล'] || normalizedRow['fullName'] || '';
      if (!fullName && firstName) {
        fullName = `${prefix}${firstName} ${lastName}`.trim();
      }

      return {
        id: idCard || `std-${Date.now()}-${index}`,
        code: code.toString(),
        number: number.toString(),
        name: fullName,
        class: className.toString(),
        year: academicYear
      };
    }).filter(s => s.name);


    // Filter out Kindergarten 2 & 3
    const imported = importedOrigin.filter(s =>
      !s.class.includes('อ.2') &&
      !s.class.includes('อ.3')
    );

    if (imported.length === 0) {
      alert('ไม่สามารถนำเข้าข้อมูลได้ กรุณาตรวจสอบหัวตาราง\nตัวอย่างที่รองรับ: รหัสนักเรียน, ชื่อ, นามสกุล, ชั้น');
      return;
    }

    setStudents(prev => {
      const existingIds = new Set(prev.filter(s => s.year === academicYear).map(s => s.id));
      const existingCodes = new Set(prev.filter(s => s.year === academicYear).map(s => s.code));
      const newOnes = imported.filter(s => !existingIds.has(s.id) && !existingCodes.has(s.code));
      const updatedStudents = [...prev, ...newOnes];

      // Force immediate cloud sync for important imports
      forceSyncCloud(updatedStudents, subjects, scores);

      return updatedStudents;
    });
    alert(`นำเข้าข้อมูลนักเรียนสำเร็จ ${imported.length} คน`);
  };
  const handleImportSubjects = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdminMode) {
      setShowAdminLogin(true);
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const imported: Subject[] = [];

        // If it's a grade sheet (like the one provided), subjects are in the header
        // We look for patterns like "รหัสวิชา ชื่อวิชา" or columns that look like subjects
        const headers = results.meta.fields || [];

        // Check if this is a grade sheet by looking for student-like columns
        const isGradeSheet = headers.some(h => h.includes('เลขประจำตัว') || h.includes('ชื่อนามสกุล') || h.includes('Column'));

        if (isGradeSheet) {
          // Extract subjects from headers
          headers.forEach(header => {
            // Match pattern: [Letter][Numbers] [Thai/English Name]
            // Example: ท11101 ภาษาไทย
            const match = header.match(/([ก-ฮA-Z]\d{5})\s+(.+)/);
            if (match) {
              const code = match[1];
              let name = match[2];
              // Clean up name (remove trailing semester numbers if any)
              name = name.replace(/\s+\d+$/, '').trim();

              if (!imported.find(s => s.code === code)) {
                imported.push({
                  id: `sub-${Date.now()}-${code}`,
                  code,
                  name,
                  maxScore: 100,
                  semester: activeSemester
                });
              }
            }
          });
        } else {
          // Standard subject CSV import
          results.data.forEach((row: any, index) => {
            // Normalize keys to handle whitespace
            const normalizedRow: any = {};
            Object.keys(row).forEach(key => {
              normalizedRow[key.trim()] = row[key];
            });

            const code = normalizedRow['รหัสวิชา'] || normalizedRow['code'] || '';
            const name = normalizedRow['ชื่อวิชา'] || normalizedRow['name'] || '';
            const type = normalizedRow['ประเภทวิชา'] || normalizedRow['type'] || 'พื้นฐาน';
            const credit = Number(normalizedRow['หน่วยกิต'] || normalizedRow['credit']) || 1;
            const maxScore = Number(normalizedRow['คะแนนเต็ม'] || normalizedRow['maxScore']) || 100;
            const semester = Number(normalizedRow['เทอม'] || normalizedRow['semester']) || activeSemester;

            if (code && name) {
              imported.push({
                id: normalizedRow.id || `sub-${Date.now()}-${index}`,
                code: code.toString(),
                name: name.toString(),
                maxScore,
                semester,
                type: (type.includes('เพิ่มเติม') ? 'เพิ่มเติม' : type.includes('กิจกรรม') ? 'กิจกรรม' : 'พื้นฐาน') as any,
                credit
              });
            }
          });
        }

        if (imported.length > 0) {
          setSubjects(prev => {
            const existingCodes = new Set(prev.map(s => s.code + s.semester));
            const uniqueNew = imported.filter(s => !existingCodes.has(s.code + s.semester));
            const updatedSubjects = [...prev, ...uniqueNew];

            // Force immediate cloud sync
            forceSyncCloud(students, updatedSubjects, scores);

            return updatedSubjects;
          });
          alert(`นำเข้าข้อมูลรายวิชาสำเร็จ ${imported.length} วิชา`);
        } else {
          alert('ไม่พบข้อมูลรายวิชาที่ตรงตามรูปแบบในไฟล์นี้');
        }
      },
      error: (error) => alert(`Error: ${error.message}`)
    });
  };

  const STANDARD_SUBJECTS_P13 = [
    { code: 'ท11101', name: 'ภาษาไทย', type: 'พื้นฐาน', credit: 4, maxScore: 100 },
    { code: 'ค11101', name: 'คณิตศาสตร์', type: 'พื้นฐาน', credit: 4, maxScore: 100 },
    { code: 'ว11101', name: 'วิทยาศาสตร์และเทคโนโลยี', type: 'พื้นฐาน', credit: 2, maxScore: 100 },
    { code: 'ส11101', name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', type: 'พื้นฐาน', credit: 2, maxScore: 100 },
    { code: 'พ11101', name: 'สุขศึกษาและพลศึกษา', type: 'พื้นฐาน', credit: 2, maxScore: 100 },
    { code: 'ศ11101', name: 'ศิลปะ', type: 'พื้นฐาน', credit: 2, maxScore: 100 },
    { code: 'ง11101', name: 'การงานอาชีพ', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
    { code: 'อ11101', name: 'ภาษาอังกฤษ', type: 'พื้นฐาน', credit: 2, maxScore: 100 },
    { code: 'ส11201', name: 'หน้าที่พลเมือง', type: 'เพิ่มเติม', credit: 0.5, maxScore: 100 },
    { code: 'อ11201', name: 'ภาษาอังกฤษเพื่อการสื่อสาร', type: 'เพิ่มเติม', credit: 0.5, maxScore: 100 },
    { code: 'ก11901', name: 'กิจกรรมพัฒนาผู้เรียน', type: 'กิจกรรม', credit: 0, maxScore: 100 },
  ];

  const STANDARD_SUBJECTS_P46 = [
    { code: 'ท14101', name: 'ภาษาไทย', type: 'พื้นฐาน', credit: 4, maxScore: 100 },
    { code: 'ค14101', name: 'คณิตศาสตร์', type: 'พื้นฐาน', credit: 4, maxScore: 100 },
    { code: 'ว14101', name: 'วิทยาศาสตร์และเทคโนโลยี', type: 'พื้นฐาน', credit: 2, maxScore: 100 },
    { code: 'ส14101', name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', type: 'พื้นฐาน', credit: 2, maxScore: 100 },
    { code: 'พ14101', name: 'สุขศึกษาและพลศึกษา', type: 'พื้นฐาน', credit: 2, maxScore: 100 },
    { code: 'ศ14101', name: 'ศิลปะ', type: 'พื้นฐาน', credit: 2, maxScore: 100 },
    { code: 'ง14101', name: 'การงานอาชีพ', type: 'พื้นฐาน', credit: 1, maxScore: 100 },
    { code: 'อ14101', name: 'ภาษาอังกฤษ', type: 'พื้นฐาน', credit: 2, maxScore: 100 },
    { code: 'ส14201', name: 'หน้าที่พลเมือง', type: 'เพิ่มเติม', credit: 0.5, maxScore: 100 },
    { code: 'อ14201', name: 'ภาษาอังกฤษเพื่อการสื่อสาร', type: 'เพิ่มเติม', credit: 0.5, maxScore: 100 },
    { code: 'ก14901', name: 'กิจกรรมพัฒนาผู้เรียน', type: 'กิจกรรม', credit: 0, maxScore: 100 },
  ];

  const loadStandardSubjects = (gradeRange: 'p13' | 'p46') => {
    if (!isAdminMode) {
      setShowAdminLogin(true);
      return;
    }

    const template = gradeRange === 'p13' ? STANDARD_SUBJECTS_P13 : STANDARD_SUBJECTS_P46;

    setSubjects(prev => {
      const existingCodes = new Set(prev.filter(s => s.semester === activeSemester).map(s => s.code));
      const newSubjectsToAdd = template
        .filter(t => !existingCodes.has(t.code || ''))
        .map((t, idx) => ({
          id: `sub-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          code: t.code || '',
          name: t.name || '',
          type: t.type || 'พื้นฐาน',
          credit: t.credit || 1,
          semester: activeSemester,
          maxScore: 100
        } as Subject));

      if (newSubjectsToAdd.length === 0) {
        alert('วิชาเหล่านี้มีอยู่ในระบบแล้ว');
        return prev;
      }

      alert(`โหลดวิชามาตรฐาน (${gradeRange === 'p13' ? 'ป.1-3' : 'ป.4-6'}) สำเร็จ ${newSubjectsToAdd.length} วิชา`);
      return [...prev, ...newSubjectsToAdd];
    });
  };

  const updateScore = (studentId: string, subjectId: string, value: string) => {
    if (lockedYear !== null && academicYear !== lockedYear) {
      return;
    }
    const numValue = Math.min(Math.max(0, Number(value) || 0), 50); // สูงสุด 50 ต่อเทอม
    setScores(prev => {
      const existing = prev.find(s => s.studentId === studentId && s.subjectId === subjectId && s.year === academicYear);
      if (existing) {
        return prev.map(s => {
          if (s.studentId === studentId && s.subjectId === subjectId && s.year === academicYear) {
            return {
              ...s,
              [activeSemester === 1 ? 'score1' : 'score2']: numValue
            };
          }
          return s;
        });
      } else {
        return [...prev, {
          studentId,
          subjectId,
          score1: activeSemester === 1 ? numValue : 0,
          score2: activeSemester === 2 ? numValue : 0,
          year: academicYear
        }];
      }
    });
  };

  const getScoreRecord = (studentId: string, subjectId: string, year?: number) => {
    const targetYear = year || academicYear;
    return scores.find(s => s.studentId === studentId && s.subjectId === subjectId && (s.year === targetYear || !s.year)) || null;
  };

  const exportCSV = () => {
    const data = students.map(student => {
      const row: any = {
        'เลขประจำตัว': student.code,
        'ชื่อนามสกุล': student.name,
        'ชั้น': student.class,
      };
      subjects.forEach(subject => {
        const scoreRecord = getScoreRecord(student.id, subject.id);
        const scoreValue = scoreRecord ? (activeSemester === 1 ? scoreRecord.score1 : scoreRecord.score2) : 0;
        row[`${subject.name} (คะแนน)`] = scoreValue;
        row[`${subject.name} (เกรด)`] = calculateGrade(scoreValue);
      });
      return row;
    });

    const csv = Papa.unparse(data);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `คะแนนนักเรียน_${new Date().toLocaleDateString('th-TH')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddSubject = () => {
    if (!isAdminMode) {
      setShowAdminLogin(true);
      return;
    }
    if (newSubject.code && newSubject.name) {
      setSubjects(prev => [...prev, {
        ...newSubject as Subject,
        id: `sub-${Date.now()}`,
        semester: newSubject.semester || activeSemester
      }]);
      setNewSubject({ code: '', name: '', maxScore: 100, semester: activeSemester });
      setIsAddSubjectOpen(false);
    }
  };

  const syncToCloud = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students, subjects, scores }),
      });
      if (response.ok) {
        setLastSynced(new Date());
        alert('สำรองข้อมูลขึ้น Cloud (D1) สำเร็จ');
      } else {
        const err = await response.json();
        alert(`ผิดพลาด: ${err.error || 'ไม่สามารถสำรองข้อมูลได้'}`);
      }
    } catch (e) {
      alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setIsSyncing(false);
    }
  };

  const loadFromCloud = async () => {
    if (!confirm('ต้องการดึงข้อมูลจาก Cloud ใช่หรือไม่? ข้อมูลในเครื่อง (LocalStorage) จะถูกแทนที่ด้วยข้อมูลจากเซิร์ฟเวอร์')) return;
    setIsSyncing(true);
    try {
      const response = await fetch('/api/data');
      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
        setSubjects(data.subjects || []);
        setScores(data.scores || []);
        alert('โหลดข้อมูลจาก Cloud สำเร็จ');
      } else {
        alert('ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (e) {
      alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadSubjectTemplate = () => {
    try {
      const data = [
        { 'รหัสวิชา': 'ท11101', 'ชื่อวิชา': 'ภาษาไทย', 'ประเภทวิชา': 'พื้นฐาน', 'หน่วยกิต': 4, 'คะแนนเต็ม': 100, 'เทอม': 1 },
        { 'รหัสวิชา': 'ค11101', 'ชื่อวิชา': 'คณิตศาสตร์', 'ประเภทวิชา': 'พื้นฐาน', 'หน่วยกิต': 4, 'คะแนนเต็ม': 100, 'เทอม': 1 },
        { 'รหัสวิชา': 'ส11201', 'ชื่อวิชา': 'หน้าที่พลเมือง', 'ประเภทวิชา': 'เพิ่มเติม', 'หน่วยกิต': 1, 'คะแนนเต็ม': 100, 'เทอม': 2 },
      ];
      const csv = Papa.unparse(data);
      const fileName = 'subject_template.csv';
      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Download error:', error);
      alert('ไม่สามารถดาวน์โหลดไฟล์ได้ในขณะนี้');
    }
  };

  const runGeneratePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      // In pdfGenerator.ts we will modify it to return the blob URL or handle opening
      await generatePDFUtil(
        students,
        subjects,
        scores,
        academicYear,
        gradingGrade,
        reportSelectedStudent,
        cachedFonts,
        (id1: string, id2: string) => {
          const r = getScoreRecord(id1, id2);
          if (!r) return 0;
          return activeSemester === 1 ? r.score1 : r.score2;
        }
      );
      setIsReportModalOpen(false);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden transition-colors duration-300">
      {/* Mobile Toggle & Status */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between z-40">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">ระบบจัดการคะแนน</h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">เทอม {activeSemester}/{academicYear}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab} setActiveTab={setActiveTab}
        isSidebarCollapsed={isSidebarCollapsed} setIsSidebarCollapsed={setIsSidebarCollapsed}
        isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen}
        isGradingOpen={isGradingOpen} setIsGradingOpen={setIsGradingOpen}
        setGradingGrade={setGradingGrade}
        academicYear={academicYear} setAcademicYear={setAcademicYear}
        isDarkMode={isDarkMode} toggleTheme={toggleTheme}
        isAdminMode={isAdminMode} setIsAdminMode={setIsAdminMode}
        setShowAdminLogin={setShowAdminLogin}
        setIsYearSettingsOpen={setIsYearSettingsOpen}
        isTelegramBacking={isTelegramBacking}
        lastTelegramBackup={lastTelegramBackup}
        telegramBackupStatus={telegramBackupStatus}
        restoreFromTelegram={restoreFromTelegram}
        isSaving={isSaving} lastSaved={lastSaved}
      />

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 overflow-y-auto w-full">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-full"
        >
          {activeTab === 'dashboard' && (
            <DashboardView
              students={students}
              subjects={subjects}
              scores={scores}
              selectedGradeFilter={selectedGradeFilter}
              setSelectedGradeFilter={setSelectedGradeFilter}
              isAdminMode={isAdminMode}
              setStudents={setStudents}
              academicYear={academicYear}
              activeSemester={activeSemester}
              handleImportStudents={handleImportStudents}
              setIsClearDataModalOpen={setIsClearDataModalOpen}
              deleteStudent={deleteStudent}
              getScore={getScoreRecord}
            />
          )}
          {activeTab === 'transcript' && (
            <TranscriptView
              students={students}
              subjects={subjects}
              scores={scores}
              selectedTranscriptStudentId={selectedTranscriptStudentId}
              setSelectedTranscriptStudentId={setSelectedTranscriptStudentId}
              selectedTranscriptRoom={selectedTranscriptRoom}
              setSelectedTranscriptRoom={setSelectedTranscriptRoom}
              gradingGrade={gradingGrade}
              academicYear={academicYear}
              cachedFonts={cachedFonts}
              getScore={getScoreRecord}
            />
          )}
          {activeTab.startsWith('grading') && (
            <GradingView
              gradingGrade={gradingGrade}
              activeSemester={activeSemester}
              setActiveSemester={setActiveSemester}
              subjects={subjects}
              students={students}
              scores={scores}
              setScores={setScores}
              isAdminMode={isAdminMode}
              setIsAddSubjectOpen={setIsAddSubjectOpen}
              setNewSubject={setNewSubject}
              setIsReportModalOpen={setIsReportModalOpen}
              setIsStandardSubjectModalOpen={setIsStandardSubjectModalOpen}
              downloadSubjectTemplate={downloadSubjectTemplate}
              setShowAdminLogin={setShowAdminLogin}
              academicYear={academicYear}
              lockedYear={lockedYear}
            />
          )}
        </motion.div>
      </main>

      <GradingModals
        isYearSettingsOpen={isYearSettingsOpen} setIsYearSettingsOpen={setIsYearSettingsOpen}
        defaultAcademicYear={defaultAcademicYear} setDefaultAcademicYear={setDefaultAcademicYear}
        lockedYear={lockedYear} setLockedYear={setLockedYear} academicYear={academicYear}
        syncToCloud={syncToCloud} loadFromCloud={loadFromCloud} isSaving={isSaving} lastSaved={lastSaved}
        showAdminLogin={showAdminLogin} setShowAdminLogin={setShowAdminLogin}
        adminPassword={adminPassword} setAdminPassword={setAdminPassword} handleAdminLogin={handleAdminLogin}
        isAddSubjectOpen={isAddSubjectOpen} setIsAddSubjectOpen={setIsAddSubjectOpen}
        newSubject={newSubject} setNewSubject={setNewSubject} handleAddSubject={handleAddSubject}
        isReportModalOpen={isReportModalOpen} setIsReportModalOpen={setIsReportModalOpen}
        reportSelectedStudent={reportSelectedStudent} setReportSelectedStudent={setReportSelectedStudent}
        gradingGrade={gradingGrade} students={students}
        isGeneratingPDF={isGeneratingPDF} generatePDF={runGeneratePDF}
        isClearDataModalOpen={isClearDataModalOpen} setIsClearDataModalOpen={setIsClearDataModalOpen}
        getScore={getScoreRecord}
        loadStudentsByFilter={loadStudentsByFilter}
        clearDataCode={clearDataCode} setClearDataCode={setClearDataCode}
        setStudents={setStudents} setScores={setScores}
        isStandardSubjectModalOpen={isStandardSubjectModalOpen} setIsStandardSubjectModalOpen={setIsStandardSubjectModalOpen}
        isAdminMode={isAdminMode} isEditingTemplate={isEditingTemplate} setIsEditingTemplate={setIsEditingTemplate}
        subjects={subjects} setSubjects={setSubjects} scores={scores}
        loadStandardSubjects={loadStandardSubjects}
        standardSubjectsTemplate={standardSubjectsTemplate} setStandardSubjectsTemplate={setStandardSubjectsTemplate}
      />

    </div>
  );
}


