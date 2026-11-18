import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MenuGo — Smart Table Dining & Order Management',
    short_name: 'MenuGo',
    description: 'Instant QR code digital menus and ordering platform for restaurants and diners.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#ea580c',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml'
      }
    ]
  };
}
