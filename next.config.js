/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Previene clickjacking — la página no puede ser embebida en un iframe externo
  { key: 'X-Frame-Options', value: 'DENY' },
  // Previene sniffing de MIME type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No envía el Referer completo a sitios externos
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Deshabilita features de browser que no se necesitan
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
  },
  // HSTS: fuerza HTTPS por 1 año (solo en producción — Next.js lo ignora en dev)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        // Aplica a todas las rutas
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['flowthings.com.ar', 'localhost:3000'],
    },
  },
  serverExternalPackages: ['node-forge', 'nodemailer'],
}

module.exports = nextConfig
