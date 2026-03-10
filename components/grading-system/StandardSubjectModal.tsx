'use client';

import { BookOpen, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/grading-utils';
import { Student, Subject, ScoreRecord } from './types';

interface StandardSubjectModalProps {
  isStandardSubjectModalOpen: boolean; setIsStandardSubjectModalOpen: (v: boolean) => void;
  isAdminMode: boolean; isEditingTemplate: boolean; setIsEditingTemplate: (v: boolean) => void;
  subjects: Subject[]; setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  scores: ScoreRecord[]; setScores: React.Dispatch<React.SetStateAction<ScoreRecord[]>>;
  loadStandardSubjects: (gradeRange: 'p13' | 'p46') => void;
  gradingGrade: string;
  standardSubjectsTemplate: Partial<Subject>[]; setStandardSubjectsTemplate: (v: Partial<Subject>[]) => void;
  setShowAdminLogin: (v: boolean) => void;
}

export default function StandardSubjectModal(props: StandardSubjectModalProps) {
  const {
    isStandardSubjectModalOpen, setIsStandardSubjectModalOpen,
    isAdminMode, isEditingTemplate, setIsEditingTemplate,
    subjects, setSubjects, scores, setScores,
    loadStandardSubjects, gradingGrade,
    standardSubjectsTemplate, setStandardSubjectsTemplate,
    setShowAdminLogin,
  } = props;

  return (
    <>
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
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">ตั้งค่าวิชามาตรฐาน</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">จัดการรายวิชาสำหรับระดับชั้น ป.{gradingGrade} หรือโหลดแม่แบบวิชามาตรฐาน</p>
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
                    รายการแม่แบบ (Standard Subject List)
                  </button>
                </div>
              )}

              <div className="overflow-y-auto flex-1 pr-2">
                {!isEditingTemplate ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <button
                        onClick={() => {
                          if (confirm('ต้องการโหลดวิชามาตรฐาน ป.1-3 หรือไม่?')) {
                            loadStandardSubjects('p13');
                          }
                        }}
                        className="py-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-1 transition-colors border border-emerald-200 dark:border-emerald-800"
                      >
                        <BookOpen size={20} />
                        <span>โหลดแม่แบบ ป.1-3</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('ต้องการโหลดวิชามาตรฐาน ป.4-6 หรือไม่?')) {
                            loadStandardSubjects('p46');
                          }
                        }}
                        className="py-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-1 transition-colors border border-blue-200 dark:border-blue-800"
                      >
                        <BookOpen size={20} />
                        <span>โหลดแม่แบบ ป.4-6</span>
                      </button>
                    </div>

                    {subjects.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <p className="mb-2">ยังไม่มีรายวิชาในระบบ</p>
                        <p className="text-xs">กรุณาคลิกเลือก "โหลดแม่แบบ" ด้านบนเพื่อเริ่มใช้งาน</p>
                      </div>
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
                  เรียบร้อย
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
