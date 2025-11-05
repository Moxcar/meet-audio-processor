/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Para mantener compatibilidad con Express/socket.io si es necesario
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Turbopack is default in Next 16; remove custom webpack config to avoid conflicts
  async rewrites() {
    return [
      {
        source: '/webhook/transcription',
        destination: '/api/webhook/transcription',
      },
    ];
  },
}

module.exports = nextConfig

