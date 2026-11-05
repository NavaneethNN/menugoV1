/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      },
      {
        protocol: 'http',
        hostname: 'localhost'
      }
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  },
  async rewrites() {
    // If an internal backend API URL is configured, proxy /api calls through Next.js
    const targetApi = process.env.INTERNAL_API_URL;
    if (!targetApi) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${targetApi.endsWith('/') ? targetApi.slice(0, -1) : targetApi}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
