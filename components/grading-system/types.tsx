// ─────────────────────────────────────────
//  Shared Types & Sidebar UI Components
// ─────────────────────────────────────────
'use client';

import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/grading-utils';

// ── Interfaces ────────────────────────────
export interface Student {
    id: string;
    code: string;
    name: string;
    class: string;
    room?: string;
    number?: string; // เลขที่
    year: number;
}

export interface Subject {
    id: string;
    code: string;
    name: string;
    maxScore: number;
    semester: number;
    type?: 'พื้นฐาน' | 'เพิ่มเติม' | 'กิจกรรม';
    credit?: number;
}

export interface ScoreRecord {
    studentId: string;
    subjectId: string;
    score1: number; // คะแนนเทอม 1 (0-50)
    score2: number; // คะแนนเทอม 2 (0-50)
    year: number;
}

// ── Sidebar Components ────────────────────

export function SidebarItem({ icon: Icon, label, active, onClick, hasSubmenu, isOpen }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group relative',
                active
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'
            )}
            title={label}
        >
            <div className="flex items-center gap-3">
                <Icon size={20} className={cn('transition-colors', active ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600')} />
                {label && <span className="font-medium text-sm whitespace-nowrap overflow-hidden">{label}</span>}
            </div>
            {hasSubmenu && label && (
                <motion.div animate={{ rotate: isOpen ? 90 : 0 }} className="text-slate-400">
                    <ChevronRight size={16} />
                </motion.div>
            )}
            {active && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-emerald-600 rounded-r-full" />}
        </button>
    );
}

export function SidebarSubItem({ label, active, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full text-left pl-12 pr-4 py-2 text-sm rounded-lg transition-colors relative',
                active
                    ? 'text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50/50 dark:bg-emerald-900/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
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
}
