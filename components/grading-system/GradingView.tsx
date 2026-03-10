'use client';

import { useState } from 'react';
import { BookOpen, Upload, Download, Plus, Settings, FileText } from 'lucide-react';
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
    setIsAddSubjectOpen: (v: boolean) => void;
    setIsStandardSubjectModalOpen: (v: boolean) => void;
    setIsReportModalOpen: (v: boolean) => void;
    downloadSubjectTemplate: () => void;
    setShowAdminLogin: (v: boolean) => void;
    setScores: React.Dispatch<React.SetStateAction<ScoreRecord[]>>;
    setNewSubject: React.Dispatch<React.SetStateAction<Partial<Subject>>>;
}

export default function GradingView({
    students, subjects, scores, academicYear, activeSemester, gradingGrade,
    lockedYear, isAdminMode,
    setActiveSemester, setIsAddSubjectOpen,
    setIsStandardSubjectModalOpen, setIsReportModalOpen,
    downloadSubjectTemplate, setShowAdminLogin, setScores,
    setNewSubject,
}: GradingViewProps) {
    const [isSubjectMenuOpen, setIsSubjectMenuOpen] = useState(false);
    const [editingCell, setEditingCell] = useState<string | null>(null); // studentId-subjectId

    const getScore = (studentId: string, subjectId: string) => {
        const record = scores.find(s => s.studentId === studentId && s.subjectId === subjectId && (s.year === academicYear || !s.year));
        if (!record) return 0;
        return activeSemester === 1 ? record.score1 : record.score2;
    };

    const handleDoubleClick = (studentId: string, subjectId: string) => {
        if (lockedYear !== null && academicYear !== lockedYear) return;
        setEditingCell(`${studentId}-${subjectId}`);
    };

    const updateScore = (studentId: string, subjectId: string, value: string) => {
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
            const row: any = { 'เลขประจำตัว': student.code, 'ชื่อนามสกุล': student.name, 'ชั้น': student.class };
            subjects.filter(s => s.semester === activeSemester).forEach(subject => {
                row[subject.name] = getScore(student.id, subject.id);
            });
            return row;
        });
        // Implementation is handled by main system actually, but keep stub if needed
    };

    const handleImportSubjects = (e: any) => {
        // Handled by main system
    };
    const studentsInYear = students.filter(s => s.year === academicYear || !s.year);
    const filteredStudents = gradingGrade
        ? studentsInYear.filter(s => s.class.includes(gradingGrade))
        : studentsInYear;
    const filteredSubjects = subjects.filter(s => s.semester === activeSemester);

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
            {/* Top Controls */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-start">
                {/* Semester Tabs */}
                <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700 w-full lg:w-fit shadow-sm overflow-x-auto">
                    {[1, 2].map(sem => (
                        <button
                            key={sem}
                            onClick={() => setActiveSemester(sem)}
                            className={cn(
                                'flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap',
                                activeSemester === sem
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                            )}
                        >
                            เทอม {sem}
                        </button>
                    ))}
                </div>

                {/* Subject Management Buttons */}
                {isAdminMode && (
                    <div className="flex flex-wrap gap-2 w-full lg:w-auto">
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
                            {isSubjectMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsSubjectMenuOpen(false)} />
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                                        <button
                                            onClick={() => { setIsSubjectMenuOpen(false); setIsStandardSubjectModalOpen(true); }}
                                            className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                                        >
                                            <BookOpen size={16} className="text-slate-400 dark:text-slate-500" />
                                            กำหนดวิชามาตรฐาน
                                        </button>
                                        <label className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 cursor-pointer transition-colors">
                                            <Upload size={16} className="text-slate-400 dark:text-slate-500" />
                                            นำเข้าวิชา (CSV)
                                            <input
                                                type="file" accept=".csv" className="hidden"
                                                onChange={e => { setIsSubjectMenuOpen(false); handleImportSubjects(e); }}
                                            />
                                        </label>
                                        <button
                                            onClick={() => { setIsSubjectMenuOpen(false); downloadSubjectTemplate(); }}
                                            className="w-full text-left px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900 flex items-center gap-3 transition-colors border-t border-slate-50 dark:border-slate-700"
                                        >
                                            <Download size={16} className="text-emerald-500 dark:text-emerald-400" />
                                            ดาวน์โหลดเทมเพลต
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Grading Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            ตารางกรอกคะแนน ป.{gradingGrade} (เทอม {activeSemester}) [สูงสุด 50 คะแนน]
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
                                <th className="px-2 sm:px-4 py-4 font-bold min-w-[150px] sm:min-w-[220px] bg-slate-50 dark:bg-slate-700 sticky left-0 z-20 border-r border-slate-200 dark:border-slate-600">
                                    นักเรียน
                                </th>
                                {filteredSubjects.map(subject => (
                                    <th
                                        key={subject.id}
                                        className="px-1 sm:px-2 py-4 font-bold text-center border-r border-slate-100 dark:border-slate-700 last:border-r-0 min-w-[60px] sm:min-w-[80px] group relative"
                                    >
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
                                    <td colSpan={1} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                                        ยังไม่มีรายวิชา
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((student, sIdx) => (
                                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group">
                                        <td className="px-2 sm:px-4 py-3 bg-white dark:bg-slate-800 sticky left-0 z-10 border-r border-slate-200 dark:border-slate-600 group-hover:bg-slate-50 dark:group-hover:bg-slate-700">
                                            <div className="font-medium text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate" title={student.name}>
                                                {student.name}
                                            </div>
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500">{student.code}</div>
                                        </td>
                                        {filteredSubjects.map((subject, subIdx) => {
                                            const score = getScore(student.id, subject.id);
                                            const isEditing = editingCell === `${student.id}-${subject.id}`;
                                            const isLocked = lockedYear !== null && academicYear !== lockedYear;

                                            return (
                                                <td key={subject.id} className="px-1 sm:px-2 py-3 text-center border-r border-slate-100 dark:border-slate-700 last:border-r-0">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="50"
                                                        data-pos={`${sIdx}-${subIdx}`}
                                                        value={score || ''}
                                                        readOnly={!isEditing || isLocked}
                                                        onFocus={e => e.target.select()}
                                                        onBlur={() => setEditingCell(null)}
                                                        onDoubleClick={() => handleDoubleClick(student.id, subject.id)}
                                                        onWheel={e => e.currentTarget.blur()}
                                                        onKeyDown={e => handleKeyDown(e, sIdx, subIdx, filteredStudents.length)}
                                                        onChange={e => updateScore(student.id, subject.id, e.target.value)}
                                                        className={cn(
                                                            'w-full max-w-[50px] sm:max-w-[60px] h-8 sm:h-9 text-center border rounded outline-none transition-all text-xs sm:text-sm font-medium',
                                                            isLocked
                                                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-600'
                                                                : isEditing
                                                                    ? 'bg-white dark:bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/20 text-slate-800 dark:text-slate-100'
                                                                    : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 text-slate-400 cursor-default hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors'
                                                        )}
                                                        placeholder="-"
                                                        title={!isEditing && !isLocked ? "ดับเบิลคลิกเพื่อปลดล็อคการแก้ไข" : ""}
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
