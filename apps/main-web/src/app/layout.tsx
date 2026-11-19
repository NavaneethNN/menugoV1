import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The QROS | Operating System for Every Venue',
  description:
    'Powering smart table ordering for dining restaurants and seamless in-seat delivery for cinema theatres across India.',
  icons: {
    icon: '/qros_logo.png'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
