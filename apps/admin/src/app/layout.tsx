import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/AdminShell';
import './globals.css';

export const metadata: Metadata = { title: 'KLEPS Yönetim', robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
