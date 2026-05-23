import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Allo StockLock | Inventory Reservation Engine',
  description: 'Concurrency-safe inventory reservation system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-50`}>
        <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </main>
        {/* Global notification toaster with clean dark styling */}
        <Toaster position="top-right" richColors theme="dark" />
      </body>
    </html>
  );
}
