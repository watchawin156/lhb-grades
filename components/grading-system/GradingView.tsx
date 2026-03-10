'use client';

import { useState } from 'react';
import { BookOpen, Upload, Download, Plus, Settings, FileText, Table as TableIcon } from 'lucide-react';
import { cn } from '@/lib/grading-utils';
import { Student, Subject, ScoreRecord } from './types';

// ── Utility ────────────────────────────────
export const getShortSubjectName = (name: string): string => {
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

// ── Props ───────────────────────────────────
// ── Props ───────────────────────────────────
interface GradingViewProps {
    students: Student[];
    subjects: Subject[];
    scores: ScoreRecord[];
    academicYear: number;
    activeSemester: number;
    gradingGrade: string;
    lockedYear: number | null;
    isAdminMode: boolean;
    setActiveSemester: (v: number) => void;
    setGradingGrade: (v: string) => void;
    setIsAddSubjectOpen: (v: boolean) => void;
    setIsReportModalOpen: (v: boolean) => void;
    downloadSubjectTemplate: () => void;
    setShowAdminLogin: (v: boolean) => void;
    setScores: React.Dispatch<React.SetStateAction<ScoreRecord[]>>;
    setNewSubject: React.Dispatch<React.SetStateAction<Partial<Subject>>>;
}

export default function GradingView({
    students, subjects, scores, academicYear, activeSemester, gradingGrade,
    setGradingGrade, lockedYear, isAdminMode,
    setActiveSemester, setIsAddSubjectOpen,
    setIsReportModalOpen,
    downloadSubjectTemplate, setShowAdminLogin, setScores,
    setNewSubject,
}: GradingViewProps) {
    const [isSubjectMenuOpen, setIsSubjectMenuOpen] = useState(false);
    const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null); // Unlock entire column

    const getScore = (studentId: string, subjectId: string) => {
        const record = scores.find(s => s.studentId === studentId && s.subjectId === subjectId && (s.year === academicYear || !s.year));
        if (!record) return 0;
        return activeSemester === 1 ? record.score1 : record.score2;
    };

    const handleDoubleClick = (subjectId: string) => {
        if (isAdminMode) return; // Admin is read-only
        if (lockedYear !== null && academicYear !== lockedYear) return;
        setEditingSubjectId(subjectId);
    };

    const updateScore = (studentId: string, subjectId: string, value: string) => {
        if (isAdminMode) return;
        if (lockedYear !== null && academicYear !== lockedYear) return;
        const numValue = Math.min(Math.max(0, Number(value) || 0), 50); // จำกัดที่ 50 คะแนนต่อเทอม
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

    const exportCSV = () => {
        const data = students.map(student => {
            const row: any = { 'เลขที่': student.number, 'ชื่อนามสกุล': student.name, 'ชั้น': student.class };
            subjects.filter(s => s.semester === activeSemester).forEach(subject => {
                row[subject.name] = getScore(student.id, subject.id);
            });
            return row;
        });
        // Implementation handled by main logic via CSV util
    };

    const studentsInYear = students.filter(s => s.year === academicYear || !s.year);
    const filteredStudents = gradingGrade
        ? studentsInYear.filter(s => s.class.includes(gradingGrade))
        : studentsInYear;
    const filteredSubjects = subjects.filter(s => s.semester === activeSemester && (gradingGrade ? s.code.startsWith(gradingGrade === '1' ? 'ท11' : gradingGrade === '2' ? 'ท21' : gradingGrade === '3' ? 'ท31' : gradingGrade === '4' ? 'ท41' : gradingGrade === '5' ? 'ท51' : 'ท61') || s.id.includes(gradingGrade) : true));

    const handleKeyDown = (
        e: React.KeyboardEvent,
        studentIndex: number,
        subjectIndex: number,
        totalStudents: number,
    ) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextStudentIndex = studentIndex + 1;
            if (nextStudentIndex < totalStudents) {
                const nextInput = document.querySelector(
                    `input[data-pos="${nextStudentIndex}-${subjectIndex}"]`
                ) as HTMLInputElement;
                nextInput?.focus();
                nextInput?.select();
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Premium Header - Glassmorphism */}
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-4 lg:p-6 rounded-[2rem] shadow-sm border border-white/20 dark:border-slate-800/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sticky top-0 lg:static z-30">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                        <TableIcon size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">บันทึกคะแนน</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            {isAdminMode && <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter border border-amber-500/20">READ ONLY</span>}
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Semester {activeSemester} Grade {gradingGrade}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200/20 dark:border-white/5 w-full sm:w-auto">
                        <button
                            onClick={() => setActiveSemester(1)}
                            className={cn(
                                "flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all",
                                activeSemester === 1
                                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            เทอม 1
                        </button>
                        <button
                            onClick={() => setActiveSemester(2)}
                            className={cn(
                                "flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all",
                                activeSemester === 2
                                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            เทอม 2
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
                        <select
                            value={gradingGrade}
                            onChange={(e) => setGradingGrade(e.target.value)}
                            className="bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/20 dark:border-white/5 rounded-2xl px-4 py-2 text-sm font-black text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                        >
                            {['1', '2', '3', '4', '5', '6'].map(g => (
                                <option key={g} value={g}>ชั้น ป.{g}</option>
                            ))}
                        </select>
                        <button
                            onClick={exportCSV}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                        >
                            <Download size={16} />
                            ส่งออก
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Tips Card */}
            <div className="mx-1 px-4 py-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm border border-emerald-500/10 rounded-2xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Plus size={16} className="animate-pulse" />
                </div>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                    <span className="text-emerald-600 dark:text-emerald-400">💡 เคล็ดลับ:</span>
                    {isAdminMode ? " คุณกำลังอยู่ในโหมดตรวจสอบข้อมูล (ไม่สามารถแก้ไขได้)" : " ดับเบิลคลิกที่ 'ชื่อวิชา' เพื่อเปิดการกรอกทั้งคอลัมน์ และใช้ปุ่ม Enter เพื่อเลื่อนลงอย่างรวดเร็ว"}
                </p>
            </div>

            {/* Grading Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                            <TableIcon className="text-emerald-600" size={24} />
                            ตารางกรอกคะแนน {gradingGrade ? `ป.${gradingGrade}` : ''}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                            {isAdminMode ? 'โหมด Admin: ดูคะแนนได้อย่างเดียว' : 'ดับเบิลคลิกช่องคะแนนเพื่อเปิดการกรอกทั้งห้อง'}
                        </p>
                    </div>
                    {lockedYear && academicYear !== lockedYear && (
                        <div className="px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                            ปีการศึกษา {academicYear} ถูกล็อค (Read-only)
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto max-h-[70vh] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                            <tr className="text-slate-500 dark:text-slate-400 text-[11px] font-black uppercase tracking-widest">
                                <th className="px-6 py-5 min-w-[250px] bg-slate-50 dark:bg-slate-800 sticky left-0 z-30 border-r border-slate-200 dark:border-slate-700">
                                    ชื่อ-นามสกุลนักเรียน
                                </th>
                                {filteredSubjects.map(subject => (
                                    <th
                                        key={subject.id}
                                        className="px-2 py-5 text-center border-r border-slate-100 dark:border-slate-700 last:border-r-0 min-w-[90px] group relative"
                                    >
                                        <div className="flex flex-col items-center">
                                            <span className="text-slate-800 dark:text-slate-200" title={subject.name}>
                                                {getShortSubjectName(subject.name)}
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-medium">({subject.maxScore})</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={filteredSubjects.length + 1} className="px-6 py-20 text-center text-slate-400 italic">
                                        ยังไม่ได้เลือกชั้นเรียน หรือไม่พบข้อมูลนักเรียน
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((student, sIdx) => (
                                    <tr key={student.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group">
                                        <td className="px-6 py-4 bg-white dark:bg-slate-900 sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    {student.number || sIdx + 1}
                                                </div>
                                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{student.name}</span>
                                            </div>
                                        </td>
                                        {filteredSubjects.map((subject, subIdx) => {
                                            const score = getScore(student.id, subject.id);
                                            const isEditing = editingSubjectId === subject.id && !isAdminMode;
                                            const isLocked = (lockedYear !== null && academicYear !== lockedYear) || isAdminMode;

                                            return (
                                                <td key={subject.id} className="px-2 py-4 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={subject.maxScore}
                                                        data-pos={`${sIdx}-${subIdx}`}
                                                        value={score || ''}
                                                        readOnly={!isEditing || isLocked}
                                                        onFocus={e => e.target.select()}
                                                        onDoubleClick={() => handleDoubleClick(subject.id)}
                                                        onWheel={e => e.currentTarget.blur()}
                                                        onKeyDown={e => handleKeyDown(e, sIdx, subIdx, filteredStudents.length)}
                                                        onChange={e => updateScore(student.id, subject.id, e.target.value)}
                                                        className={cn(
                                                            'w-16 h-10 text-center border-2 rounded-xl outline-none transition-all text-sm font-bold',
                                                            isLocked
                                                                ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent cursor-not-allowed'
                                                                : isEditing
                                                                    ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-lg shadow-blue-500/10 text-blue-600 dark:text-blue-400 scale-105'
                                                                    : 'bg-transparent border-slate-100 dark:border-slate-800 text-slate-300 cursor-help hover:border-slate-300 dark:hover:border-slate-700'
                                                        )}
                                                        placeholder="-"
                                                    />
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
}
