/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
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
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
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
  async redirects() {
    return [
      {
        source: '/how-it-works',
        destination: '/#how-it-works',
        permanent: false
      },
      {
        source: '/features',
        destination: '/#features',
        permanent: false
      },
      {
        source: '/business-selection',
        destination: '/#business-selection',
        permanent: false
      },
      {
        source: '/cinema-ordering-flow',
        destination: '/#cinema-ordering-flow',
        permanent: false
      },
      {
        source: '/theatre',
        destination: '/cinema/onboarding',
        permanent: false
      },
      {
        source: '/theatre/onboarding',
        destination: '/cinema/onboarding',
        permanent: false
      },
      {
        source: '/cinema',
        destination: '/#cinema-view',
        permanent: false
      },
      {
        source: '/restaurant',
        destination: '/#restaurant-view',
        permanent: false
      }
    ];
  },
  async rewrites() {
    // Proxy /api calls through Next.js to backend Express service
    const targetApi = process.env.INTERNAL_API_URL || process.env.API_URL || 'http://localhost:5001';
    return [
      {
        source: '/api/:path*',
        destination: `${targetApi.endsWith('/') ? targetApi.slice(0, -1) : targetApi}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
