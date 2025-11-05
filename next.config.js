/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Para mantener compatibilidad con Express/socket.io si es necesario
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Deshabilitar Turbopack y usar webpack (más estable)
  webpack: (config, { isServer }) => {
    return config;
  },
}

module.exports = nextConfig

