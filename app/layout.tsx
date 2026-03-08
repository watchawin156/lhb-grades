import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ระบบจัดการคะแนนนักเรียน ป.1-6',
  description: 'ระบบบันทึกคะแนนและตัดเกรดอัตโนมัติ รองรับการนำเข้า/ส่งออกไฟล์ CSV ภาษาไทย',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
