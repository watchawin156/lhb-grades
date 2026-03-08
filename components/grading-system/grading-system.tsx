'use client';

import { useState, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  Users,
  BookOpen,
  Table as TableIcon,
  Download,
  Upload,
  Plus,
  Trash2,
  Save,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  FileSpreadsheet,
  X,
  FileText,
  Menu,
  Settings,
  FileBarChart,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { cn, calculateGrade, getGradeColor } from '@/lib/grading-utils';

interface Student {
  id: string;
  code: string;
  name: string;
  class: string;
  room?: string;
  year: number;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  maxScore: number;
  semester: number;
  type?: 'พื้นฐาน' | 'เพิ่มเติม' | 'กิจกรรม';
  credit?: number;
}

interface ScoreRecord {
  studentId: string;
  subjectId: string;
  score: number;
  year: number;
}

// Helper Components for Sidebar
const SidebarItem = ({ icon: Icon, label, active, onClick, hasSubmenu, isOpen }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group relative",
      active
        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm"
        : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100"
    )}
    title={!label ? "เมนู" : undefined}
  >
    <div className="flex items-center gap-3">
      <Icon size={20} className={cn("transition-colors", active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600")} />
      {label && <span className="font-medium text-sm whitespace-nowrap overflow-hidden">{label}</span>}
    </div>
    {hasSubmenu && label && (
      <motion.div
        animate={{ rotate: isOpen ? 90 : 0 }}
        className="text-slate-400"
      >
        <ChevronRight size={16} />
      </motion.div>
    )}
    {active && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-emerald-600 rounded-r-full" />}
  </button>
);

const SidebarSubItem = ({ label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full text-left pl-12 pr-4 py-2 text-sm rounded-lg transition-colors relative",
      active
        ? "text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50/50 dark:bg-emerald-900/20"
        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
    )}
  >
    {active && (
      <motion.div
        layoutId="activeSubItem"
        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-emerald-500 rounded-r-full"
      />
    )}
    <span className="truncate block">{label}</span>
  </button>
);

export default function GradingSystem() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeSemester, setActiveSemester] = useState<number>(1);
  const [gradingGrade, setGradingGrade] = useState<string>('');
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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

  // Theme Handling
  useEffect(() => {
    const savedTheme = localStorage.getItem('grading_theme');
    // Default to dark if no preference is saved
    if (savedTheme === 'dark' || !savedTheme) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
      // If no theme was saved yet, save 'dark' as default preference
      if (!savedTheme) localStorage.setItem('grading_theme', 'dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newTheme = !prev;
      if (newTheme) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('grading_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
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

      // 1. Get from LocalStorage (Source of truth for latest UI changes)
      const localStudents = JSON.parse(localStorage.getItem('grading_students') || '[]');
      const localSubjects = JSON.parse(localStorage.getItem('grading_subjects') || '[]');
      const localScores = JSON.parse(localStorage.getItem('grading_scores') || '[]');
      const loadedTemplate = localStorage.getItem('grading_standard_template');
      if (loadedTemplate) setStandardSubjectsTemplate(JSON.parse(loadedTemplate));

      // 2. Try to fetch from Cloud
      try {
        const response = await fetch('/api/data');
        if (response.ok) {
          const cloudData = await response.json();

          // 3. Safe Merge: Use Cloud if it has data, but fallback to Local if Cloud part is empty
          // This prevents "Cloud (only subjects) wiping Local (students + subjects)"
          const mergedStudents = (cloudData.students && cloudData.students.length > 0) ? cloudData.students : localStudents;
          const mergedSubjects = (cloudData.subjects && cloudData.subjects.length > 0) ? cloudData.subjects : localSubjects;
          const mergedScores = (cloudData.scores && cloudData.scores.length > 0) ? cloudData.scores : localScores;

          setStudents(mergedStudents);
          setSubjects(mergedSubjects);
          setScores(mergedScores);
          setLastSynced(new Date());
        } else {
          // Response not OK - Use local
          setStudents(localStudents);
          setSubjects(localSubjects);
          setScores(localScores);
        }
      } catch (e) {
        // Network Error - Use local
        setStudents(localStudents);
        setSubjects(localSubjects);
        setScores(localScores);
      }
      setIsLoaded(true);
    };

    initData();
  }, []);

  // Real-time Auto-save with Debounce
  useEffect(() => {
    if (isLoaded) {
      setIsSaving(true);

      // Save to localStorage immediately
      localStorage.setItem('grading_students', JSON.stringify(students));
      localStorage.setItem('grading_subjects', JSON.stringify(subjects));
      localStorage.setItem('grading_scores', JSON.stringify(scores));
      localStorage.setItem('grading_year_settings', JSON.stringify({
        defaultYear: defaultAcademicYear,
        lockedYear: lockedYear
      }));
      localStorage.setItem('grading_standard_template', JSON.stringify(standardSubjectsTemplate));

      const timer = setTimeout(async () => {
        // Debounced Cloud Sync
        try {
          await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students, subjects, scores }),
          });
          setLastSynced(new Date());
        } catch (e) {
          console.error("Cloud sync failed", e);
        }
        setIsSaving(false);
        setLastSaved(new Date());
      }, 2000); // 2 seconds debounce

      return () => clearTimeout(timer);
    }
  }, [students, subjects, scores, isLoaded, defaultAcademicYear, lockedYear]);

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

      const code = normalizedRow['รหัสนักเรียน'] || normalizedRow['เลขประจำตัว'] || normalizedRow['เลขที่'] || normalizedRow['code'] || normalizedRow['No.'] || '';
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
        name: fullName,
        class: className.toString(),
        room: room.toString(),
        year: academicYear
      };
    }).filter(s => s.name);

    // Filter out Kindergarten 2 & 3
    const imported = importedOrigin.filter(s =>
      !s.class.includes('อ.2') &&
      !s.class.includes('อ.3')
    );

    if (imported.length === 0) {
      alert('ไม่สามารถนำเข้าข้อมูลได้ กรุณาตรวจสอบหัวตาราง\nตัวอย่างที่รองรับ: รหัสนักเรียน, ชื่อ, นามสกุล, ชั้น, ห้อง');
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

  const loadStandardSubjects = (grade: string) => {
    if (!isAdminMode) {
      setShowAdminLogin(true);
      return;
    }

    setSubjects(prev => {
      let addedCount = 0;
      const existingNames = new Set(prev.filter(s => s.semester === activeSemester).map(s => s.name));

      const newSubjects = standardSubjectsTemplate
        .filter(s => !existingNames.has(s.name || ''))
        .map(s => {
          addedCount++;
          return {
            id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            code: '', // No code as requested
            name: s.name,
            type: s.type || 'พื้นฐาน',
            credit: s.credit || 1,
            semester: activeSemester,
            maxScore: 100
          } as Subject;
        });

      if (addedCount === 0) {
        alert(`ระดับชั้น ป.${grade} มีวิชามาตรฐานครบถ้วนแล้ว (เทอม ${activeSemester})`);
        return prev;
      }

      alert(`โหลดวิชามาตรฐาน ป.${grade} สำเร็จ: เพิ่มใหม่ ${addedCount} วิชา`);
      return [...prev, ...newSubjects];
    });
  };

  const updateScore = (studentId: string, subjectId: string, value: string) => {
    if (lockedYear !== null && academicYear !== lockedYear) {
      return; // Silently ignore or show a toast if possible, but alert might be annoying during typing
    }
    const numValue = Math.min(Math.max(0, Number(value) || 0), 100);
    setScores(prev => {
      const filtered = prev.filter(s => !(s.studentId === studentId && s.subjectId === subjectId && (s.year === academicYear || !s.year)));
      return [...filtered, { studentId, subjectId, score: numValue, year: academicYear }];
    });
  };

  const getScore = (studentId: string, subjectId: string) => {
    return scores.find(s => s.studentId === studentId && s.subjectId === subjectId && (s.year === academicYear || !s.year))?.score || 0;
  };

  const exportCSV = () => {
    const data = students.map(student => {
      const row: any = {
        'เลขประจำตัว': student.code,
        'ชื่อนามสกุล': student.name,
        'ชั้น': student.class,
      };
      subjects.forEach(subject => {
        const score = getScore(student.id, subject.id);
        row[`${subject.name} (คะแนน)`] = score;
        row[`${subject.name} (เกรด)`] = calculateGrade(score);
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

      // 2. Create PDF
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);
      const customFontBold = await pdfDoc.embedFont(fontBoldBytes);
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      const margin = 50;

      // 3. Header
      page.drawText('รายงานผลการเรียนรายบุคคล (ปพ.1)', { x: width / 2 - 130, y: height - 60, size: 22, font: customFontBold, color: rgb(0, 0, 0) });
      page.drawText(`ชื่อ-นามสกุล: ${student.name}`, { x: margin, y: height - 100, size: 16, font: customFont, color: rgb(0, 0, 0) });
      page.drawText(`ชั้น: ${student.class.split('/')[0]}`, { x: margin, y: height - 120, size: 16, font: customFont, color: rgb(0, 0, 0) });
      page.drawText(`เลขประจำตัว: ${student.code}`, { x: width - 200, y: height - 100, size: 16, font: customFont, color: rgb(0, 0, 0) });
      page.drawText(`ปีการศึกษา: ${academicYear}`, { x: width - 200, y: height - 120, size: 16, font: customFont, color: rgb(0, 0, 0) });

      // 4. Data Processing
      const subjectGroups: Record<string, any> = {};
      subjects.forEach(sub => {
        const key = sub.code || sub.name;
        if (!subjectGroups[key]) subjectGroups[key] = { code: sub.code, name: sub.name, type: sub.type || 'พื้นฐาน', sem1: null, sem2: null, credit: sub.credit || 1 };
        if (sub.semester === 1) subjectGroups[key].sem1 = sub;
        if (sub.semester === 2) subjectGroups[key].sem2 = sub;
      });
      const sortedSubjs = Object.values(subjectGroups).sort((a: any, b: any) => {
        const typeOrder: Record<string, number> = { 'พื้นฐาน': 1, 'เพิ่มเติม': 2, 'กิจกรรม': 3 };
        return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99) || (a.code || "").localeCompare(b.code || "");
      });

      // 5. Table Rendering
      const tableTop = height - 160;
      const colWidths = [30, 180, 60, 50, 50, 50, 40, 40];
      const colX = [margin];
      colWidths.forEach((w, i) => colX.push(colX[i] + w));

      const drawRow = (y: number, texts: string[], isBold = false) => {
        const font = isBold ? customFontBold : customFont;
        texts.forEach((text, i) => page.drawText(text, { x: colX[i] + 5, y: y + 5, size: 12, font, color: rgb(0, 0, 0) }));
        page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
      };

      page.drawLine({ start: { x: margin, y: tableTop + 25 }, end: { x: width - margin, y: tableTop + 25 }, thickness: 1, color: rgb(0, 0, 0) });
      drawRow(tableTop, ['ที่', 'รายวิชา', 'ประเภท', 'นก.', 'เทอม 1', 'เทอม 2', 'รวม', 'เกรด'], true);

      let currentY = tableTop - 25;
      sortedSubjs.forEach((sub: any, idx) => {
        const s1 = sub.sem1 ? getScore(student.id, sub.sem1.id) : null;
        const s2 = sub.sem2 ? getScore(student.id, sub.sem2.id) : null;
        const totalGot = (s1 || 0) + (s2 || 0);
        const totalMax = (sub.sem1?.maxScore || 0) + (sub.sem2?.maxScore || 0);
        const percent = totalMax > 0 ? Math.round((totalGot / totalMax) * 100) : 0;
        const grade = sub.type === 'กิจกรรม' ? (totalMax > 0 ? (percent >= 50 ? 'ผ' : 'มผ') : '-') : (totalMax > 0 ? calculateGrade(percent) : '-');
        drawRow(currentY, [(idx + 1).toString(), sub.name.substring(0, 30), sub.type, (sub.credit || 1).toString(), s1 !== null ? s1.toString() : '-', s2 !== null ? s2.toString() : '-', totalMax > 0 ? percent.toString() : '-', grade]);
        currentY -= 25;
      });

      colX.forEach(x => page.drawLine({ start: { x, y: tableTop + 25 }, end: { x, y: currentY + 25 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }));
      const pdfBase64 = await pdfDoc.saveAsBase64({ dataUri: true });
      setPdfPreviewUrl(pdfBase64);
      setIsGeneratingPDF(false);
    } catch (e) {
      console.error('PDF Error:', e);
      setIsGeneratingPDF(false);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent, studentIndex: number, subjectIndex: number, totalStudents: number, totalSubjects: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextStudentIndex = studentIndex + 1;
      if (nextStudentIndex < totalStudents) {
        const nextInput = document.querySelector(`input[data-pos="${nextStudentIndex}-${subjectIndex}"]`) as HTMLInputElement;
        nextInput?.focus();
        nextInput?.select();
      }
    }
  };

  const renderTranscript = () => {
    const uniqueStudents = students.reduce((acc, student) => {
      const existing = acc.find(s => s.code === student.code);
      if (!existing) {
        acc.push(student);
      }
      return acc;
    }, [] as Student[]);

    const uniqueClasses = Array.from(new Set(uniqueStudents.map(s => s.class))).sort();

    const filteredStudentsByRoom = selectedTranscriptRoom === 'all'
      ? uniqueStudents
      : uniqueStudents.filter(s => s.class === selectedTranscriptRoom);

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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">ค้นหาและเลือกห้อง (ชั้น)</label>
              <select
                value={selectedTranscriptRoom}
                onChange={(e) => {
                  setSelectedTranscriptRoom(e.target.value);
                  setSelectedTranscriptStudentId('');
                }}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value="all">-- ทุกห้อง --</option>
                {uniqueClasses.map(room => (
                  <option key={room} value={room}>{room.split('/')[0]}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">ค้นหาและเลือกนักเรียน</label>
              <select
                value={selectedTranscriptStudentId || ''}
                onChange={(e) => {
                  const sid = e.target.value;
                  setSelectedTranscriptStudentId(sid);
                  const student = students.find(s => s.id === sid);
                  if (student) {
                    generateTranscriptPDF(student);
                  } else {
                    setPdfPreviewUrl(null);
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
              >
                <option value="">-- เลือกนักเรียน --</option>
                {filteredStudentsByRoom.sort((a, b) => a.name.localeCompare(b.name, 'th')).map(student => (
                  <option key={student.id} value={student.id}>
                    {student.code} - {student.name}
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
                    <p className="text-xs text-slate-500 dark:text-slate-400">เลขประจำตัว: {selectedStudent.code} | ชั้น {selectedStudent.class.split('/')[0]}</p>
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
                    <p className="font-bold text-emerald-600 animate-pulse">กำลังประมวลผล PDF ตลอดยอดกิต...</p>
                  </div>
                ) : pdfPreviewUrl ? (
                  <iframe
                    src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-full border-none"
                    title="PDF Preview"
                  />
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
  };


  const getShortSubjectName = (name: string) => {
    if (name.includes('ภาษาไทย')) return 'ไทย';
    if (name.includes('คณิตศาสตร์')) return 'คณิต';
    if (name.includes('วิทยาศาสตร์')) return 'วิทย์';
    if (name.includes('สังคมศึกษา')) return 'สังคม';
    if (name.includes('ประวัติศาสตร์')) return 'ประวัติ';
    if (name.includes('สุขศึกษา')) return 'สุขศึกษา';
    if (name.includes('ศิลปะ')) return 'ศิลปะ';
    if (name.includes('การงานอาชีพ')) return 'การงาน';
    if (name.includes('ภาษาอังกฤษ')) return 'อังกฤษ';
    if (name.includes('หน้าที่พลเมือง')) return 'หน้าที่';
    if (name.includes('การป้องกันการทุจริต')) return 'ต้านโกง';
    if (name.includes('คอมพิวเตอร์')) return 'คอม';
    if (name.includes('ลูกเสือ')) return 'ลูกเสือ';
    if (name.includes('ชุมนุม')) return 'ชุมนุม';
    if (name.includes('แนะแนว')) return 'แนะแนว';
    return name.substring(0, 10);
  };

  // --- Render Sections ---

  const renderDashboard = () => {
    const studentsInYear = students.filter(s => s.year === academicYear || !s.year);

    // Calculate grading progress by class
    const classProgress = studentsInYear.reduce((acc, student) => {
      const className = student.class; // Only show grade level, not room
      if (!acc[className]) {
        acc[className] = { total: 0, graded: 0 };
      }
      acc[className].total += subjects.filter(s => s.semester === activeSemester).length;

      // Count graded subjects for this student
      const gradedCount = subjects
        .filter(s => s.semester === activeSemester)
        .filter(s => getScore(student.id, s.id) > 0)
        .length;

      acc[className].graded += gradedCount;
      return acc;
    }, {} as Record<string, { total: number; graded: number }>);

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"><Users size={24} /></div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">นักเรียนทั้งหมด ({academicYear})</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{studentsInYear.length} คน</h3>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl"><BookOpen size={24} /></div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">รายวิชาทั้งหมด</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{subjects.length} วิชา</h3>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl"><FileSpreadsheet size={24} /></div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">บันทึกคะแนนแล้ว</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{scores.length} รายการ</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Grading Progress by Class */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">ความคืบหน้า (แยกตามห้อง)</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(classProgress).map(([className, progress]) => {
              const percentage = progress.total > 0 ? Math.round((progress.graded / progress.total) * 100) : 0;
              return (
                <div key={className} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{className.split('/')[0]}</span>
                  <div className={cn("text-xs font-bold px-1.5 py-0.5 rounded-md",
                    percentage === 100 ? "bg-emerald-100 text-emerald-700" :
                      percentage > 50 ? "bg-blue-100 text-blue-700" :
                        "bg-slate-200 text-slate-600"
                  )}>
                    {percentage}%
                  </div>
                </div>
              );
            })}
            {Object.keys(classProgress).length === 0 && (
              <span className="text-xs text-slate-400">ยังไม่มีข้อมูล</span>
            )}
          </div>
        </div>

        {/* Student List Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">รายชื่อนักเรียน</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">จัดการข้อมูลนักเรียนทั้งหมด</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {isAdminMode && (
                <>
                  <label className="flex-1 sm:flex-none cursor-pointer flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors text-sm">
                    <Upload size={18} />
                    <span>นำเข้า CSV</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        handleImportStudents(e);
                      }}
                    />
                  </label>
                  <button
                    onClick={() => {
                      setIsClearDataModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-sm"
                  >
                    <Trash2 size={18} />
                    <span>ล้างข้อมูล</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Table for Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">รหัส</th>
                  <th className="px-6 py-4 font-semibold">ชื่อ-นามสกุล</th>
                  <th className="px-6 py-4 font-semibold">ชั้น/ห้อง</th>
                  <th className="px-6 py-4 font-semibold text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {studentsInYear.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                      ยังไม่มีข้อมูลนักเรียนในปี {academicYear} กรุณานำเข้าไฟล์ CSV
                    </td>
                  </tr>
                ) : (
                  studentsInYear.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group">
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200 font-mono">{student.code}</td>
                      <td className="px-6 py-4 text-slate-800 dark:text-slate-100 font-medium">{student.name}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{student.class.split('/')[0]}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => deleteStudent(student.id)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="ลบนักเรียน"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Card View for Mobile */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
            {studentsInYear.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                ยังไม่มีข้อมูลนักเรียนในปี {academicYear} กรุณานำเข้าไฟล์ CSV
              </div>
            ) : (
              studentsInYear.map((student) => (
                <div key={student.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mb-0.5">{student.code}</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">{student.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{student.class.split('/')[0]}</p>
                  </div>
                  <button
                    onClick={() => deleteStudent(student.id)}
                    className="p-2 text-red-400 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGrading = () => {
    const studentsInYear = students.filter(s => s.year === academicYear || !s.year);
    const filteredStudents = gradingGrade
      ? studentsInYear.filter(s => s.class.includes(gradingGrade))
      : studentsInYear;

    const filteredSubjects = subjects.filter(s => s.semester === activeSemester);

    return (
      <div className="space-y-6">
        {/* Top Controls: Semester & Subject Management */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start">
          <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700 w-full lg:w-fit shadow-sm overflow-x-auto">
            {[1, 2].map(sem => (
              <button
                key={sem}
                onClick={() => setActiveSemester(sem)}
                className={cn(
                  "flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                  activeSemester === sem
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
                )}
              >
                เทอม {sem}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full lg:w-auto">
            {isAdminMode && (
              <>
                <button
                  onClick={() => {
                    setNewSubject(prev => ({ ...prev, semester: activeSemester }));
                    setIsAddSubjectOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors shadow-sm text-xs sm:text-sm"
                >
                  <Plus size={18} />
                  <span>เพิ่มรายวิชา</span>
                </button>
                <div className="relative">
                  <button
                    onClick={() => setIsSubjectMenuOpen(!isSubjectMenuOpen)}
                    className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm text-xs sm:text-sm"
                  >
                    <Settings size={18} />
                    <span>จัดการรายวิชา</span>
                  </button>
                  alimony
                  {isSubjectMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsSubjectMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                        <button
                          onClick={() => {
                            setIsSubjectMenuOpen(false);
                            setIsStandardSubjectModalOpen(true);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                        >
                          <BookOpen size={16} className="text-slate-400 dark:text-slate-500" />
                          กำหนดวิชามาตรฐาน
                        </button>
                        <label className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 cursor-pointer transition-colors">
                          <Upload size={16} className="text-slate-400 dark:text-slate-500" />
                          นำเข้าวิชา (CSV)
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                              setIsSubjectMenuOpen(false);
                              handleImportSubjects(e);
                            }}
                          />
                        </label>
                        <button
                          onClick={() => {
                            setIsSubjectMenuOpen(false);
                            downloadSubjectTemplate();
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900 flex items-center gap-3 transition-colors border-t border-slate-50 dark:border-slate-700"
                        >
                          <Download size={16} className="text-emerald-500 dark:text-emerald-400" />
                          ดาวน์โหลดเทมเพลต
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Grading Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                ตารางกรอกคะแนน ป.{gradingGrade} (เทอม {activeSemester})
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Enter: ลงล่าง | Tab: ไปขวา</p>
                {lockedYear !== null && academicYear !== lockedYear && (
                  <span className="text-[10px] bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 px-2 py-0.5 rounded-full font-bold animate-pulse">
                    ระบบล็อคไว้ที่ปี {lockedYear} (อ่านอย่างเดียว)
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsReportModalOpen(true)}
                disabled={students.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                <FileText size={16} />
                <span>ออก ปพ.6</span>
              </button>
              <button
                onClick={exportCSV}
                disabled={students.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                <Download size={16} />
                <span>ส่งออก CSV</span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[75vh]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700 shadow-sm">
                <tr className="text-slate-500 dark:text-slate-300 text-[10px] sm:text-xs uppercase tracking-wider">
                  <th className="px-2 sm:px-4 py-4 font-bold min-w-[150px] sm:min-w-[220px] bg-slate-50 dark:bg-slate-700 sticky left-0 z-20 border-r border-slate-200 dark:border-slate-600">นักเรียน</th>
                  {filteredSubjects.map(subject => (
                    <th key={subject.id} className="px-1 sm:px-2 py-4 font-bold text-center border-r border-slate-100 dark:border-slate-700 last:border-r-0 min-w-[60px] sm:min-w-[80px] group relative">
                      <div className="truncate px-1 cursor-help" title={`${subject.name} (${subject.type || 'พื้นฐาน'} - ${subject.credit || 1} หน่วยกิต)`}>
                        {getShortSubjectName(subject.name)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={filteredSubjects.length + 1} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                      ไม่พบข้อมูลนักเรียน
                    </td>
                  </tr>
                ) : filteredSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={filteredSubjects.length + 1} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                      ยังไม่มีรายวิชา
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, sIdx) => (
                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group">
                      <td className="px-2 sm:px-4 py-3 bg-white dark:bg-slate-800 sticky left-0 z-10 border-r border-slate-200 dark:border-slate-600 group-hover:bg-slate-50 dark:group-hover:bg-slate-700">
                        <div className="font-medium text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate" title={student.name}>{student.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">{student.code}</div>
                      </td>
                      {filteredSubjects.map((subject, subIdx) => {
                        const score = getScore(student.id, subject.id);
                        return (
                          <td key={subject.id} className="px-1 sm:px-2 py-3 text-center border-r border-slate-100 dark:border-slate-700 last:border-r-0">
                            <div className="flex flex-col items-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                data-pos={`${sIdx}-${subIdx}`}
                                value={score || ''}
                                disabled={lockedYear !== null && academicYear !== lockedYear}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => handleKeyDown(e, sIdx, subIdx, filteredStudents.length, filteredSubjects.length)}
                                onChange={(e) => updateScore(student.id, subject.id, e.target.value)}
                                className={cn(
                                  "w-full max-w-[50px] sm:max-w-[60px] h-8 sm:h-9 text-center border border-slate-200 dark:border-slate-600 rounded focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-500 dark:focus:border-emerald-400 outline-none transition-all text-xs sm:text-sm font-medium bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100",
                                  lockedYear !== null && academicYear !== lockedYear && "bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                )}
                                placeholder="-"
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const generatePDF = () => {
    alert('ระบบ ปพ.6 กำลังอยู่ระหว่างการปรับปรุงครับ');
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
      <aside
        className={cn(
          "bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-8 transition-all duration-300 fixed lg:relative h-full z-50",
          isSidebarCollapsed ? "w-20" : "w-64",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden lg:block absolute -right-3 top-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full p-1 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-sm z-10"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={cn("flex items-center gap-3 px-2 overflow-hidden", isSidebarCollapsed && "justify-center")}>
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex shrink-0 items-center justify-center text-white">
            <LayoutDashboard size={24} />
          </div>
          {!isSidebarCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="font-bold text-slate-800 dark:text-slate-100 leading-tight whitespace-nowrap text-sm">ระบบจัดการคะแนน</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">Grade Management</p>
            </motion.div>
          )}
        </div>

        {/* Academic Year Selector */}
        {(!isSidebarCollapsed || isMobileMenuOpen) && (
          <div className="px-2">
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">ปีการศึกษา</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 transition-all cursor-pointer"
            >
              {Array.from({ length: 11 }, (_, i) => {
                const currentBE = new Date().getFullYear() + 543;
                const year = currentBE - 5 + i;
                return <option key={year} value={year}>ปีการศึกษา {year}</option>
              })}
              {/* Fallback if the saved year is outside the ±5 range */}
              {(() => {
                const currentBE = new Date().getFullYear() + 543;
                if (academicYear < currentBE - 5 || academicYear > currentBE + 5) {
                  return <option value={academicYear}>ปีการศึกษา {academicYear}</option>;
                }
                return null;
              })()}
            </select>
          </div>
        )}

        <nav className="flex flex-col gap-2 flex-1">
          <SidebarItem
            icon={LayoutDashboard}
            label={(isSidebarCollapsed && !isMobileMenuOpen) ? "" : "หน้าแรก & นักเรียน"}
            active={activeTab === 'dashboard'}
            onClick={() => {
              setActiveTab('dashboard');
              setIsGradingOpen(false);
              if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
            }}
          />

          <SidebarItem
            icon={TableIcon}
            label={(isSidebarCollapsed && !isMobileMenuOpen) ? "" : "กรอกคะแนน"}
            active={activeTab.startsWith('grading')}
            onClick={() => {
              if (isSidebarCollapsed && !isMobileMenuOpen) setIsSidebarCollapsed(false);
              setIsGradingOpen(!isGradingOpen);
            }}
            hasSubmenu={!isSidebarCollapsed || isMobileMenuOpen}
            isOpen={isGradingOpen}
          />

          <AnimatePresence>
            {isGradingOpen && (!isSidebarCollapsed || isMobileMenuOpen) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden flex flex-col gap-1"
              >
                {['1', '2', '3', '4', '5', '6'].map(grade => (
                  <SidebarSubItem
                    key={grade}
                    label={`ชั้นประถมศึกษาปีที่ ${grade}`}
                    active={activeTab === `grading-${grade}`}
                    onClick={() => {
                      setActiveTab(`grading-${grade}`);
                      setGradingGrade(grade);
                      if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* Footer Actions */}
        <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <SidebarItem
            icon={FileBarChart}
            label={(isSidebarCollapsed && !isMobileMenuOpen) ? "" : "ดูเกรด ปพ.1"}
            active={activeTab === 'transcript'}
            onClick={() => {
              setActiveTab('transcript');
              setIsGradingOpen(false);
              if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
            }}
          />

          <button
            onClick={() => setIsYearSettingsOpen(true)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 transition-all",
              isSidebarCollapsed && !isMobileMenuOpen && "justify-center"
            )}
            title="ตั้งค่าปีการศึกษา"
          >
            <Settings size={20} className="text-slate-400 dark:text-slate-500" />
            {(!isSidebarCollapsed || isMobileMenuOpen) && <span className="text-sm font-medium">ตั้งค่าระบบ</span>}
          </button>

          {/* Auto-save Indicator */}
          <div className={cn("px-3 py-2 flex items-center gap-2", (isSidebarCollapsed && !isMobileMenuOpen) && "justify-center")}>
            <div className={cn("w-2 h-2 rounded-full shrink-0", isSaving ? "bg-amber-400 animate-pulse" : "bg-emerald-500")} />
            {(!isSidebarCollapsed || isMobileMenuOpen) && (
              <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                {isSaving ? "กำลังบันทึก..." : lastSaved ? `บันทึกเมื่อ ${lastSaved.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : "บันทึกอัตโนมัติ"}
              </div>
            )}
          </div>
          {/* Theme Toggle Button for Desktop Sidebar */}
          {(!isSidebarCollapsed || isMobileMenuOpen) && (
            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                title={isDarkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
              >
                {isDarkMode ? <Sun size={20} className="text-slate-400 dark:text-slate-500" /> : <Moon size={20} className="text-slate-400 dark:text-slate-500" />}
                <span className="text-sm font-medium">
                  {isDarkMode ? "โหมดสว่าง" : "โหมดมืด"}
                </span>
              </button>

              <button
                onClick={() => isAdminMode ? setIsAdminMode(false) : setShowAdminLogin(true)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-xl transition-colors",
                  isAdminMode
                    ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100"
                )}
              >
                <div className={cn("w-5 h-5 flex items-center justify-center rounded-full", isAdminMode ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700")}>
                  {isAdminMode ? <Settings size={12} /> : <Settings size={12} className="text-slate-500" />}
                </div>
                <span className="text-sm font-medium">
                  {isAdminMode ? "Admin: ทั่วไป" : "เข้าสู่ระบบ Admin"}
                </span>
                {isAdminMode && <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Year Settings Modal */}
      <AnimatePresence>
        {isYearSettingsOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl w-full max-w-sm"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">ตั้งค่าปีการศึกษา</h3>
                <button onClick={() => setIsYearSettingsOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">ปีการศึกษาเริ่มต้น (Default)</label>
                  <select
                    value={defaultAcademicYear}
                    onChange={(e) => setDefaultAcademicYear(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none font-bold cursor-pointer text-slate-800 dark:text-slate-100"
                  >
                    {Array.from({ length: 11 }, (_, i) => {
                      const currentBE = new Date().getFullYear() + 543;
                      const year = currentBE - 5 + i;
                      return <option key={year} value={year}>ปีการศึกษา {year}</option>
                    })}
                  </select>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">* ปีการศึกษาที่จะแสดงเป็นอันดับแรกเมื่อเปิดแอป</p>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                    Cloud Synchronization (D1)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={syncToCloud}
                      disabled={isSaving} // Use isSaving as a proxy for sync status
                      className="flex flex-col items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded-xl border border-emerald-100 dark:border-emerald-700 transition-all disabled:opacity-50"
                    >
                      <Upload size={18} />
                      <span className="text-[11px] font-bold">สำรองข้อมูลขึ้น Cloud</span>
                    </button>
                    <button
                      onClick={loadFromCloud}
                      disabled={isSaving} // Use isSaving as a proxy for sync status
                      className="flex flex-col items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800 rounded-xl border border-amber-100 dark:border-amber-700 transition-all disabled:opacity-50"
                    >
                      <Download size={18} />
                      <span className="text-[11px] font-bold">ดึงข้อมูลจาก Cloud</span>
                    </button>
                  </div>
                  {lastSaved && (
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-2 text-center font-medium">
                      อัปเดตล่าสุด: {lastSaved.toLocaleTimeString('th-TH')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">ล็อคการแก้ไข (Lock Year)</label>
                  <div className="flex items-center gap-3">
                    <select
                      value={lockedYear || academicYear}
                      disabled={lockedYear === null}
                      onChange={(e) => setLockedYear(Number(e.target.value))}
                      className={cn(
                        "flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none font-bold cursor-pointer text-slate-800 dark:text-slate-100",
                        lockedYear === null ? "opacity-50" : "focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400"
                      )}
                    >
                      {Array.from({ length: 11 }, (_, i) => {
                        const currentBE = new Date().getFullYear() + 543;
                        const year = currentBE - 5 + i;
                        return <option key={year} value={year}>ปีการศึกษา {year}</option>
                      })}
                    </select>
                    <button
                      onClick={() => setLockedYear(lockedYear === null ? academicYear : null)}
                      className={cn(
                        "px-4 py-2 rounded-xl font-bold text-xs transition-all",
                        lockedYear === null
                          ? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                          : "bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800"
                      )}
                    >
                      {lockedYear === null ? "ล็อค" : "ปลดล็อค"}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">* หากล็อคไว้ จะไม่สามารถแก้ไขคะแนนในปีอื่นได้</p>
                </div>

                <button
                  onClick={() => setIsYearSettingsOpen(false)}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-600/20 transition-all"
                >
                  บันทึกการตั้งค่า
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl w-[90%] max-w-sm"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">ยืนยันสิทธิ์ผู้ดูแลระบบ</h3>
                <button onClick={() => setShowAdminLogin(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">รหัสผ่าน</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    placeholder="กรอกรหัสผ่านเพื่อแก้ไขข้อมูล"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  />
                </div>
                <button
                  onClick={handleAdminLogin}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                >
                  ยืนยัน
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 overflow-y-auto w-full">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-full"
        >
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'transcript' && renderTranscript()}
          {activeTab.startsWith('grading') && renderGrading()}
        </motion.div>
      </main>

      {/* Add Subject Modal */}
      {
        isAddSubjectOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">เพิ่มรายวิชาใหม่</h3>
              <div className="space-y-4">
                <div className="flex gap-4 p-1 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                  {[1, 2].map(sem => (
                    <button
                      key={sem}
                      onClick={() => setNewSubject(prev => ({ ...prev, semester: sem }))}
                      className={cn(
                        "flex-1 py-2 rounded-md text-sm font-bold transition-all",
                        newSubject.semester === sem
                          ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                      )}
                    >
                      เทอม {sem}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">รหัสวิชา</label>
                  <input
                    type="text"
                    value={newSubject.code}
                    onChange={e => setNewSubject(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    placeholder="เช่น ท11101"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">ชื่อวิชา</label>
                  <input
                    type="text"
                    value={newSubject.name}
                    onChange={e => setNewSubject(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    placeholder="เช่น ภาษาไทย"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">ประเภทวิชา</label>
                    <select
                      value={newSubject.type || 'พื้นฐาน'}
                      onChange={e => setNewSubject(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    >
                      <option value="พื้นฐาน">พื้นฐาน</option>
                      <option value="เพิ่มเติม">เพิ่มเติม</option>
                      <option value="กิจกรรม">กิจกรรม</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">หน่วยกิต/น้ำหนัก</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newSubject.credit || ''}
                      onChange={e => setNewSubject(prev => ({ ...prev, credit: Number(e.target.value) }))}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                      placeholder="เช่น 1.5"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">คะแนนเต็ม</label>
                  <input
                    type="number"
                    value={newSubject.maxScore}
                    onChange={e => setNewSubject(prev => ({ ...prev, maxScore: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setIsAddSubjectOpen(false)}
                    className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 font-medium"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleAddSubject}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                  >
                    บันทึก
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )
      }
      {/* Report Modal */}
      {
        isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">ออกรายงานผลการเรียน (ปพ.6)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">เลือกนักเรียน ป.{gradingGrade}</label>
                  <select
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    value={reportSelectedStudent}
                    onChange={(e) => setReportSelectedStudent(e.target.value)}
                  >
                    <option value="all">เลือกทั้งหมด (ทุกคนในห้อง)</option>
                    {students.filter(s => s.class.includes(gradingGrade)).map(s => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setIsReportModalOpen(false)}
                    disabled={isGeneratingPDF}
                    className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 font-medium disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={generatePDF}
                    disabled={isGeneratingPDF}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingPDF ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        กำลังสร้าง PDF...
                      </>
                    ) : (
                      <>
                        <FileText size={18} />
                        สร้าง PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )
      }

      {/* Clear Data Modal */}
      <AnimatePresence>
        {isClearDataModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl w-[90%] max-w-sm border-t-4 border-red-500"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Trash2 className="text-red-500" size={20} />
                  ยืนยันการล้างข้อมูลนักเรียน
                </h3>
                <button onClick={() => setIsClearDataModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                ข้อมูลนักเรียนและคะแนนทั้งหมดที่เชื่อมโยงจะถูกลบ <span className="font-bold text-red-500">การกระทำนี้ไม่สามารถกู้คืนได้</span> กรุณากรอกรหัสผู้ดูแลระบบเพื่อยืนยัน
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">รหัสผ่านยืนยัน</label>
                  <input
                    type="password"
                    value={clearDataCode}
                    onChange={(e) => setClearDataCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    placeholder="กรอกรหัสผ่านเพื่อล้างข้อมูล"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (clearDataCode === '31020177') {
                          setStudents([]);
                          setScores([]);
                          setIsClearDataModalOpen(false);
                          setClearDataCode('');
                        } else {
                          alert('รหัสผ่านไม่ถูกต้อง');
                        }
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsClearDataModalOpen(false)}
                    className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 font-medium"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => {
                      if (clearDataCode === '31020177') {
                        setStudents([]);
                        setScores([]);
                        setIsClearDataModalOpen(false);
                        setClearDataCode('');
                      } else {
                        alert('รหัสผ่านไม่ถูกต้อง');
                      }
                    }}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                  >
                    ยืนยันการลบทิ้ง
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Standard Subject Modal */}
      <AnimatePresence>
        {isStandardSubjectModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[60] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col border border-slate-100 dark:border-slate-700"
            >
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">ตั้งค่าวิชามาตรฐาน</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">จัดการรายวิชาสำหรับทุกระดับชั้น หรือแก้ไขแม่แบบพื้นฐาน</p>
                </div>
                <button onClick={() => {
                  setIsStandardSubjectModalOpen(false);
                  setIsEditingTemplate(false);
                }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={24} />
                </button>
              </div>

              {isAdminMode && (
                <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl mb-4 shrink-0">
                  <button
                    onClick={() => setIsEditingTemplate(false)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                      !isEditingTemplate
                        ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    จัดการวิชาในเทอมนี้
                  </button>
                  <button
                    onClick={() => setIsEditingTemplate(true)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                      isEditingTemplate
                        ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    แก้ไขแม่แบบ (Standard Template)
                  </button>
                </div>
              )}

              <div className="overflow-y-auto flex-1 pr-2">
                {!isEditingTemplate ? (
                  <>
                    <div className="mb-4">
                      <button
                        onClick={() => {
                          if (confirm('ต้องการโหลดวิชามาตรฐานทั้งหมดใหม่หรือไม่? (วิชาเดิมจะยังคงอยู่ แต่อาจมีวิชาซ้ำถ้าใช้ชื่อเดียวกัน)')) {
                            loadStandardSubjects(gradingGrade || '1');
                          }
                        }}
                        className="w-full py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors border border-emerald-200 dark:border-emerald-800"
                      >
                        <BookOpen size={16} />
                        โหลดจากแม่แบบล่าสุด (ป.{gradingGrade || '1'})
                      </button>
                    </div>

                    {subjects.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">ยังไม่มีรายวิชาในระบบ</div>
                    ) : (
                      <div className="space-y-3">
                        {subjects.map(subject => (
                          <div key={subject.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">ชื่อวิชา</label>
                                <input
                                  type="text"
                                  value={subject.name}
                                  readOnly={!isAdminMode}
                                  onClick={() => !isAdminMode && setShowAdminLogin(true)}
                                  onChange={(e) => {
                                    if (!isAdminMode) return;
                                    setSubjects(prev => prev.map(s => s.id === subject.id ? { ...s, name: e.target.value } : s));
                                  }}
                                  className={cn(
                                    "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500",
                                    !isAdminMode ? "text-slate-400 cursor-not-allowed" : "text-slate-800 dark:text-slate-100"
                                  )}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">รหัสวิชา</label>
                                <input
                                  type="text"
                                  value={subject.code}
                                  readOnly={!isAdminMode}
                                  onClick={() => !isAdminMode && setShowAdminLogin(true)}
                                  onChange={(e) => {
                                    if (!isAdminMode) return;
                                    setSubjects(prev => prev.map(s => s.id === subject.id ? { ...s, code: e.target.value } : s));
                                  }}
                                  className={cn(
                                    "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500",
                                    !isAdminMode ? "text-slate-400 cursor-not-allowed" : "text-slate-700 dark:text-slate-200"
                                  )}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">ประเภท</label>
                                <select
                                  value={subject.type || 'พื้นฐาน'}
                                  disabled={!isAdminMode}
                                  onChange={(e) => {
                                    if (!isAdminMode) return;
                                    setSubjects(prev => prev.map(s => s.id === subject.id ? { ...s, type: e.target.value as any } : s));
                                  }}
                                  className={cn(
                                    "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500",
                                    !isAdminMode ? "text-slate-400" : "text-slate-800 dark:text-slate-100"
                                  )}
                                >
                                  <option value="พื้นฐาน">พื้นฐาน</option>
                                  <option value="เพิ่มเติม">เพิ่มเติม</option>
                                  <option value="กิจกรรม">กิจกรรม</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">หน่วยกิต</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={subject.credit || 0}
                                  readOnly={!isAdminMode}
                                  onClick={() => !isAdminMode && setShowAdminLogin(true)}
                                  onChange={(e) => {
                                    if (!isAdminMode) return;
                                    setSubjects(prev => prev.map(s => s.id === subject.id ? { ...s, credit: Number(e.target.value) } : s));
                                  }}
                                  className={cn(
                                    "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500",
                                    !isAdminMode ? "text-slate-400 cursor-not-allowed" : "text-slate-800 dark:text-slate-100"
                                  )}
                                />
                              </div>
                              <div className="flex items-end">
                                <button
                                  onClick={() => {
                                    if (!isAdminMode) {
                                      setShowAdminLogin(true);
                                      return;
                                    }
                                    if (confirm(`ต้องการลบวิชา ${subject.name} ใช่หรือไม่?`)) {
                                      setSubjects(prev => prev.filter(s => s.id !== subject.id));
                                      setScores(prev => prev.filter(s => s.subjectId !== subject.id));
                                    }
                                  }}
                                  className={cn(
                                    "w-full py-2 rounded-lg transition-colors flex items-center justify-center gap-2",
                                    !isAdminMode
                                      ? "bg-slate-100 dark:bg-slate-700 text-slate-400"
                                      : "bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                                  )}
                                >
                                  <Trash2 size={16} />
                                  <span className="text-[10px] font-bold">ลบทิ้ง</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">รายการแม่แบบวิชามาตรฐาน (มีทั้งหมด {standardSubjectsTemplate.length} วิชา)</span>
                      <button
                        onClick={() => {
                          setStandardSubjectsTemplate([...standardSubjectsTemplate, { name: 'วิชาใหม่', type: 'พื้นฐาน', credit: 1 }]);
                        }}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                      >
                        เพิ่มวิชา
                      </button>
                    </div>

                    <div className="space-y-2">
                      {standardSubjectsTemplate.map((item, idx) => (
                        <div key={idx} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              const newTemplate = [...standardSubjectsTemplate];
                              newTemplate[idx].name = e.target.value;
                              setStandardSubjectsTemplate(newTemplate);
                            }}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg text-sm font-bold outline-none border border-transparent focus:border-emerald-500 dark:text-slate-100"
                            placeholder="ชื่อวิชา"
                          />
                          <select
                            value={item.type}
                            onChange={(e) => {
                              const newTemplate = [...standardSubjectsTemplate];
                              newTemplate[idx].type = e.target.value as any;
                              setStandardSubjectsTemplate(newTemplate);
                            }}
                            className="w-full sm:w-28 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 rounded-lg text-xs outline-none border border-transparent focus:border-emerald-500 dark:text-slate-200"
                          >
                            <option value="พื้นฐาน">พื้นฐาน</option>
                            <option value="เพิ่มเติม">เพิ่มเติม</option>
                            <option value="กิจกรรม">กิจกรรม</option>
                          </select>
                          <input
                            type="number"
                            step="0.5"
                            value={item.credit}
                            onChange={(e) => {
                              const newTemplate = [...standardSubjectsTemplate];
                              newTemplate[idx].credit = Number(e.target.value);
                              setStandardSubjectsTemplate(newTemplate);
                            }}
                            className="w-full sm:w-16 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 rounded-lg text-xs text-center border border-transparent focus:border-emerald-500 dark:text-slate-200"
                          />
                          <button
                            onClick={() => {
                              setStandardSubjectsTemplate(standardSubjectsTemplate.filter((_, i) => i !== idx));
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 mt-4 flex justify-end shrink-0">
                <button
                  onClick={() => setIsStandardSubjectModalOpen(false)}
                  className="px-6 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 font-medium"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div >
  );
}


