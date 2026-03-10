'use client';

import { BookOpen, Upload, Trash2, Users, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/grading-utils';
import { Student, Subject, ScoreRecord } from './types';

interface DashboardViewProps {
    students: Student[];
    subjects: Subject[];
    scores: ScoreRecord[];
    academicYear: number;
    activeSemester: number;
    isAdminMode: boolean;
    selectedGradeFilter: string;
    setSelectedGradeFilter: (v: string) => void;
    handleImportStudents: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setIsClearDataModalOpen: (v: boolean) => void;
    deleteStudent: (id: string) => void;
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
    getScore: (studentId: string, subjectId: string) => ScoreRecord | null;
}

export default function DashboardView({
    students,
    subjects,
    scores,
    academicYear,
    activeSemester,
    isAdminMode,
    selectedGradeFilter,
    setSelectedGradeFilter,
    handleImportStudents,
    setIsClearDataModalOpen,
    deleteStudent,
    setStudents,
    getScore,
}: DashboardViewProps) {
    const studentsInYear = students.filter(s => s.year === academicYear || !s.year);

    const studentsToDisplay = selectedGradeFilter === 'all'
        ? studentsInYear
        : studentsInYear.filter(s => s.class.includes(selectedGradeFilter));

    const classProgress = studentsInYear.reduce((acc, student) => {
        const className = student.class;
        if (!acc[className]) acc[className] = { total: 0, graded: 0 };
        acc[className].total += subjects.filter(s => s.semester === activeSemester).length;
        acc[className].graded += subjects
            .filter(s => s.semester === activeSemester)
            .filter(sub => {
                const sc = getScore(student.id, sub.id);
                if (!sc) return false;
                const val = activeSemester === 1 ? sc.score1 : sc.score2;
                return val > 0;
            }).length;
        return acc;
    }, {} as Record<string, { total: number; graded: number }>);

    const updateStudentNumber = (id: string, newNumber: string) => {
        setStudents(prev => prev.map(s => s.id === id ? { ...s, number: newNumber } : s));
    };

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

            {/* Grading Progress */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">ความคืบหน้า (แยกตามชั้น ป.1-6)</h3>
                <div className="flex flex-wrap gap-3">
                    {['1', '2', '3', '4', '5', '6'].map(grade => {
                        const progress = classProgress[`ป.${grade}`] || classProgress[grade] || { total: 0, graded: 0 };
                        const percentage = progress.total > 0 ? Math.round((progress.graded / progress.total) * 100) : 0;
                        return (
                            <div key={grade} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">ป.{grade}</span>
                                <div className={cn('text-xs font-bold px-1.5 py-0.5 rounded-md',
                                    percentage === 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        percentage > 50 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                )}>
                                    {percentage}%
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Student List */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">รายชื่อนักเรียน</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">จัดการข้อมูลนักเรียนทั้งหมด</p>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            {isAdminMode && (
                                <>
                                    <label className="flex-1 sm:flex-none cursor-pointer flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800 rounded-lg transition-colors text-sm font-bold shadow-sm">
                                        <Upload size={18} />
                                        <span>เลือกไฟล์เพื่อนำเข้า (CSV/Excel)</span>
                                        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportStudents} />
                                    </label>
                                    <button
                                        onClick={() => setIsClearDataModalOpen(true)}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors text-sm"
                                    >
                                        <Trash2 size={18} />
                                        <span>ล้างข้อมูล</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Grade Filter Tabs */}
                    <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-700 w-full overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setSelectedGradeFilter('all')}
                            className={cn('flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap',
                                selectedGradeFilter === 'all'
                                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-100 dark:border-slate-600'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            )}
                        >
                            นักเรียนทั้งหมด
                        </button>
                        {['1', '2', '3', '4', '5', '6'].map(grade => (
                            <button
                                key={grade}
                                onClick={() => setSelectedGradeFilter(grade)}
                                className={cn('flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap',
                                    selectedGradeFilter === grade
                                        ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-100 dark:border-slate-600'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                )}
                            >
                                ป.{grade}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-sm uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold w-24">เลขที่</th>
                                <th className="px-6 py-4 font-semibold">รหัสประจำตัว</th>
                                <th className="px-6 py-4 font-semibold">ชื่อ-นามสกุล</th>
                                <th className="px-6 py-4 font-semibold">ชั้น</th>
                                <th className="px-6 py-4 font-semibold text-center">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {studentsToDisplay.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                                        ยังไม่มีข้อมูลนักเรียนในปี {academicYear} ในระดับชั้นที่เลือก
                                    </td>
                                </tr>
                            ) : (
                                studentsToDisplay
                                    .sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999))
                                    .map(student => (
                                        <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={student.number || ''}
                                                    onChange={e => updateStudentNumber(student.id, e.target.value)}
                                                    className="w-12 h-8 text-center border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all bg-transparent focus:bg-white dark:focus:bg-slate-900"
                                                    placeholder="-"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-mono">{student.code}</td>
                                            <td className="px-6 py-4 text-slate-800 dark:text-slate-100 font-medium">{student.name}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                {!student.class ? "-" : (student.class.startsWith('ป.') ? student.class : `ป.${student.class}`)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {isAdminMode && (
                                                    <button
                                                        onClick={() => deleteStudent(student.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title="ลบนักเรียน"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
                    {studentsToDisplay.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">ยังไม่มีข้อมูลนักเรียน</div>
                    ) : (
                        studentsToDisplay
                            .sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999))
                            .map(student => (
                                <div key={student.id} className="p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-bold">
                                            {student.number || '-'}
                                        </div>
                                        <div>
                                            <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mb-0.5">{student.code}</p>
                                            <p className="font-bold text-slate-800 dark:text-slate-100">{student.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {!student.class ? "-" : (student.class.startsWith('ป.') ? student.class : `ป.${student.class}`)}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteStudent(student.id)}
                                        className="p-2 text-red-400 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
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
}
