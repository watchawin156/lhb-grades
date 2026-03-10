'use client';

import { useState, useRef } from 'react';

import { ChevronRight, ChevronLeft, LayoutDashboard, Settings, FileBarChart, Sun, Moon, Table as TableIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/grading-utils';
import { SidebarItem, SidebarSubItem } from './types';

interface SidebarProps {
  activeTab: string; setActiveTab: (v: string) => void;
  isSidebarCollapsed: boolean; setIsSidebarCollapsed: (v: boolean) => void;
  isMobileMenuOpen: boolean; setIsMobileMenuOpen: (v: boolean) => void;
  isGradingOpen: boolean; setIsGradingOpen: (v: boolean) => void;
  setGradingGrade: (v: string) => void;
  academicYear: number; setAcademicYear: (v: number) => void;
  isDarkMode: boolean; toggleTheme: () => void;
  isAdminMode: boolean; setIsAdminMode: (v: boolean) => void;
  setShowAdminLogin: (v: boolean) => void;
  setIsYearSettingsOpen: (v: boolean) => void;
  isSaving: boolean; lastSaved: Date | null;
  isTelegramBacking: boolean;
  lastTelegramBackup: Date | null;
  telegramBackupStatus: 'idle' | 'ok' | 'error';
  restoreFromTelegram: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const {
    activeTab, setActiveTab, isSidebarCollapsed, setIsSidebarCollapsed,
    isMobileMenuOpen, setIsMobileMenuOpen, isGradingOpen, setIsGradingOpen,
    setGradingGrade, academicYear, setAcademicYear, isDarkMode, toggleTheme,
    isAdminMode, setIsAdminMode, setShowAdminLogin, setIsYearSettingsOpen,
    isSaving, lastSaved, isTelegramBacking, lastTelegramBackup,
    telegramBackupStatus, restoreFromTelegram,
  } = props;

  const collapseTimer = useRef<NodeJS.Timeout | null>(null);

  return (
    <aside
      onMouseEnter={() => setIsSidebarCollapsed(false)}
      onMouseLeave={() => setIsSidebarCollapsed(true)}
      className={cn(
        "hidden lg:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 gap-8 transition-all duration-300 relative z-50",
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

      <div className={cn("flex flex-col items-center gap-1 overflow-hidden", isSidebarCollapsed && "justify-center")}>
        <div className="flex items-center gap-3 px-2 w-full overflow-hidden">
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

        {/* Short Year for Collapsed Mode */}
        {isSidebarCollapsed && !isMobileMenuOpen && (
          <div className="mt-1 flex flex-col items-center">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">ปี</span>
            <span className="text-xs font-black text-slate-700 dark:text-slate-200">{String(academicYear).slice(-2)}</span>
          </div>
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
          label={(isSidebarCollapsed && !isMobileMenuOpen) ? "" : "จัดการข้อมูลนักเรียน"}
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
            setActiveTab('grading');
            setIsGradingOpen(false);
            if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
          }}
        />
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

        {isAdminMode && (
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
        )}

        {/* Indicators Hidden as per request */}
        {/* Theme Toggle Button for Desktop Sidebar */}
        {(!isSidebarCollapsed || isMobileMenuOpen) && (
          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 transition-colors border border-slate-100 dark:border-slate-700"
              title={isDarkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
            >
              {isDarkMode ? (
                <>
                  <Sun size={20} className="text-amber-500" />
                  <span className="text-sm font-bold">สลับเป็นโหมดสว่าง</span>
                </>
              ) : (
                <>
                  <Moon size={20} className="text-slate-500" />
                  <span className="text-sm font-bold">สลับเป็นโหมดมืด</span>
                </>
              )}
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

            {isAdminMode && (
              <button
                onClick={restoreFromTelegram}
                disabled={isTelegramBacking}
                className="w-full flex items-center gap-3 p-2 rounded-xl text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors border border-sky-200 dark:border-sky-800 disabled:opacity-50"
              >
                <span className="text-base leading-none">{isTelegramBacking ? '⏳' : '📥'}</span>
                <span className="text-sm font-bold">{isTelegramBacking ? 'กำลังโหลด...' : 'โหลดจาก Telegram'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>

  );
}
