import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MenuGo | Multi-Restaurant QR Ordering Platform',
  description: 'Instant QR code digital menus and ordering platform for restaurants, cafes, and food courts.'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}

