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
        <div className="space-y-8">
            {/* Minimal Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">แผงควบคุมหลัก</h2>
                    <p className="text-sm text-slate-500 font-medium">ภาพรวมข้อมูลปีการศึกษา {academicYear} เทอม {activeSemester}</p>
                </div>
                {isAdminMode && (
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                            <Upload size={16} className="text-emerald-500" />
                            <span className="text-xs font-black text-slate-700 dark:text-slate-300">นำเข้านักเรียน</span>
                            <input type="file" accept=".csv" onChange={handleImportStudents} className="hidden" />
                        </label>
                        <button
                            onClick={() => setIsClearDataModalOpen(true)}
                            className="p-2.5 text-rose-500 bg-rose-50 dark:bg-rose-900/10 rounded-2xl hover:bg-rose-100 transition-all active:scale-95 border border-rose-100 dark:border-rose-900/20"
                            title="ล้างข้อมูลทั้งหมด"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Premium Stats Cards - Mobile App Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="relative overflow-hidden group p-6 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-500/20 active:scale-98 transition-all">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
                    <div className="relative flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-white/70 uppercase tracking-widest">นักเรียนทั้งหมด</p>
                            <h3 className="text-3xl font-black">{studentsInYear.length} <span className="text-sm font-medium">คน</span></h3>
                        </div>
                    </div>
                </div>

                <div className="relative overflow-hidden group p-6 rounded-[2.5rem] bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/20 active:scale-98 transition-all">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
                    <div className="relative flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-white/70 uppercase tracking-widest">รายวิชาเปิดสอน</p>
                            <h3 className="text-3xl font-black">{subjects.filter(s => s.semester === activeSemester).length} <span className="text-sm font-medium">วิชา</span></h3>
                        </div>
                    </div>
                </div>

                <div className="relative overflow-hidden group p-6 rounded-[2.5rem] bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-xl shadow-purple-500/20 active:scale-98 transition-all sm:col-span-2 lg:col-span-1">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
                    <div className="relative flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                            <FileSpreadsheet size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-white/70 uppercase tracking-widest">รายการคะแนน</p>
                            <h3 className="text-3xl font-black">{scores.filter(s => s.year === academicYear).length} <span className="text-sm font-medium">ชุด</span></h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grade Filter Chips - Touch Friendly */}
            <div className="bg-white/50 dark:bg-slate-900/50 p-4 lg:p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">ความคืบหน้าแยกตามชั้น</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto invisible-scrollbar">
                        <button
                            onClick={() => setSelectedGradeFilter('all')}
                            className={cn(
                                "whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black transition-all border",
                                selectedGradeFilter === 'all'
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg"
                                    : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                            )}
                        >
                            ทั้งหมด
                        </button>
                        {['1', '2', '3', '4', '5', '6'].map(grade => (
                            <button
                                key={grade}
                                onClick={() => setSelectedGradeFilter(grade)}
                                className={cn(
                                    "whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black transition-all border",
                                    selectedGradeFilter === grade
                                        ? "bg-emerald-500 text-white border-transparent shadow-lg shadow-emerald-500/20"
                                        : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                )}
                            >
                                ป.{grade}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {['1', '2', '3', '4', '5', '6'].map(grade => {
                        const progress = classProgress[`ป.${grade}`] || classProgress[grade] || { total: 0, graded: 0 };
                        const percentage = progress.total > 0 ? Math.round((progress.graded / progress.total) * 100) : 0;
                        return (
                            <div key={grade} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                <span className="font-black text-slate-700 dark:text-slate-200 text-lg">ป.{grade}</span>
                                <div className={cn('text-sm font-bold px-2 py-1 rounded-full mt-2',
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
