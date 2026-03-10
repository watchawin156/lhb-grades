'use client';

import { BookOpen, Trash2, Upload, Download, X, FileText, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/grading-utils';
import { Student, Subject, ScoreRecord } from './types';
import StandardSubjectModal from './StandardSubjectModal';

interface GradingModalsProps {
  isYearSettingsOpen: boolean; setIsYearSettingsOpen: (v: boolean) => void;
  defaultAcademicYear: number; setDefaultAcademicYear: (v: number) => void;
  lockedYear: number | null; setLockedYear: (v: number | null) => void;
  academicYear: number;
  syncToCloud: () => void; loadFromCloud: () => void;
  isSaving: boolean; lastSaved: Date | null;
  showAdminLogin: boolean; setShowAdminLogin: (v: boolean) => void;
  adminPassword: string; setAdminPassword: (v: string) => void;
  handleAdminLogin: () => void;
  isAddSubjectOpen: boolean; setIsAddSubjectOpen: (v: boolean) => void;
  newSubject: Partial<Subject>; setNewSubject: (fn: (prev: Partial<Subject>) => Partial<Subject>) => void;
  handleAddSubject: () => void;
  isReportModalOpen: boolean; setIsReportModalOpen: (v: boolean) => void;
  reportSelectedStudent: string; setReportSelectedStudent: (v: string) => void;
  gradingGrade: string; students: Student[];
  isGeneratingPDF: boolean; generatePDF: () => void;
  isClearDataModalOpen: boolean; setIsClearDataModalOpen: (v: boolean) => void;
  clearDataCode: string; setClearDataCode: (v: string) => void;
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  setScores: React.Dispatch<React.SetStateAction<ScoreRecord[]>>;
  isAdminMode: boolean; isEditingTemplate: boolean; setIsEditingTemplate: (v: boolean) => void;
  subjects: Subject[]; setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  scores: ScoreRecord[];
  loadStandardSubjects: (gradeRange: 'p13' | 'p46') => void;
  standardSubjectsTemplate: Partial<Subject>[]; setStandardSubjectsTemplate: (v: Partial<Subject>[]) => void;
  getScore: (studentId: string, subjectId: string) => ScoreRecord | null;
  loadStudentsByFilter: (grade: string, year: string) => Promise<void>;
}

export default function GradingModals(props: GradingModalsProps) {
  const {
    isYearSettingsOpen, setIsYearSettingsOpen, defaultAcademicYear, setDefaultAcademicYear,
    lockedYear, setLockedYear, academicYear, syncToCloud, loadFromCloud, isSaving, lastSaved,
    showAdminLogin, setShowAdminLogin, adminPassword, setAdminPassword, handleAdminLogin,
    isAddSubjectOpen, setIsAddSubjectOpen, newSubject, setNewSubject, handleAddSubject,
    isReportModalOpen, setIsReportModalOpen, reportSelectedStudent, setReportSelectedStudent,
    gradingGrade, students, isGeneratingPDF, generatePDF,
    isClearDataModalOpen, setIsClearDataModalOpen, clearDataCode, setClearDataCode,
    setStudents, setScores,
    isAdminMode,
    isEditingTemplate, setIsEditingTemplate, subjects, setSubjects, scores,
    loadStandardSubjects, standardSubjectsTemplate, setStandardSubjectsTemplate,
  } = props;

  return (
    <>
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
                </div>

                {isAdminMode && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 space-y-3">
                    <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">ดึงข้อมูลนักเรียนจากฐานข้อมูลกลาง</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">เลือกชั้น</label>
                        <select id="admin-filter-grade" className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                          <option value="">ทั้งหมด</option>
                          <option value="1">ป.1</option>
                          <option value="2">ป.2</option>
                          <option value="3">ป.3</option>
                          <option value="4">ป.4</option>
                          <option value="5">ป.5</option>
                          <option value="6">ป.6</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">ปีการศึกษา</label>
                        <select id="admin-filter-year" defaultValue={academicYear} className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                          {Array.from({ length: 5 }, (_, i) => academicYear - 2 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const g = (document.getElementById('admin-filter-grade') as HTMLSelectElement).value;
                        const y = (document.getElementById('admin-filter-year') as HTMLSelectElement).value;
                        if (confirm(`ยืนยันการดึงข้อมูลนักเรียน ป.${g || 'ทั้งหมด'} ปี ${y} ใช่หรือไม่?`)) {
                          // This will be handled by a new function passed via props
                          (props as any).loadStudentsByFilter(g, y);
                        }
                      }}
                      className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={14} />
                      ดึงข้อมูลนักเรียน
                    </button>
                  </div>
                )}

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
              className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm m-4"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">ยืนยันตัวตน Admin</h3>
                <button onClick={() => setShowAdminLogin(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-100 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-medium">ส่วนนี้สำหรับผู้ดูแลระบบเท่านั้น กรุณากรอกรหัสผ่านเพื่อดำเนินการต่อ</p>
                </div>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="รหัสผ่านผู้ดูแลระบบ"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 dark:text-slate-100"
                />
                <button
                  onClick={handleAdminLogin}
                  className="w-full py-3 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl hover:bg-slate-900 dark:hover:bg-white font-bold transition-all shadow-lg"
                >
                  เข้าสู่ระบบ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


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
                    {students.filter(s => s.class?.includes(gradingGrade)).map(s => (
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
                    onClick={() => generatePDF()}
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

    </>
  );
}
