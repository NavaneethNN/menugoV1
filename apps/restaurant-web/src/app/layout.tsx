import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f172a'
};

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://menugo.com').replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'MenuGo | Smart Table Dining & Order Management',
    template: '%s | MenuGo'
  },
  description:
    'Instant QR code digital menus and table ordering platform. No app downloads or registrations required. Scan, explore, and order at your own pace.',
  keywords: [
    'QR code menu',
    'restaurant digital menu',
    'contactless dining',
    'table ordering',
    'kitchen display system',
    'MenuGo'
  ],
  authors: [{ name: 'MenuGo' }],
  creator: 'MenuGo',
  publisher: 'MenuGo',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [{ url: '/apple-icon' }]
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: appUrl,
    siteName: 'MenuGo',
    title: 'MenuGo | Your Table. Your Time. Your Order.',
    description:
      'Give your customers the freedom to explore your menu and order whenever they are ready. Give your restaurant a simpler way to receive and manage table orders.',
    images: [
      {
        url: '/icon.svg',
        width: 512,
        height: 512,
        alt: 'MenuGo Smart Dining Platform'
      }
    ]
  },
  twitter: {
    card: 'summary',
    title: 'MenuGo | Your Table. Your Time. Your Order.',
    description:
      'A better way to dine. A smarter way to serve. No app downloads. Just scan, explore and order.',
    images: ['/icon.svg']
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900 selection:bg-orange-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
