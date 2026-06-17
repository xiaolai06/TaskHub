import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // 仅开发环境使用 rewrite 代理 API（生产环境由 Nginx 处理）
  ...(isDev && {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:3001/api/:path*',
        },
      ];
    },
  }),
};

export default nextConfig;
