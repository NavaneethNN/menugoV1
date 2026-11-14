import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://menugo.com').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/menu/', '/track/'],
        disallow: ['/admin/', '/kitchen/', '/staff/', '/cashier/', '/service/', '/api/']
      }
    ],
    sitemap: `${appUrl}/sitemap.xml`
  };
}
