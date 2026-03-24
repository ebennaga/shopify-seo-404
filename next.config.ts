/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // Matikan paksa HTTPS redirect bawaan Next.js
  // Ini penting saat development dengan ngrok
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'X-Frame-Options', value: 'ALLOWALL' }],
      },
    ];
  },
};

module.exports = nextConfig;
