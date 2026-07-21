/** @type {import('next').NextConfig} */

// Content-Security-Policy — defensa en profundidad contra XSS/inyección.
// Arranca permisiva (Next.js necesita 'unsafe-inline'/'unsafe-eval' sin nonces),
// pero restringe object-src, base-uri y frame-ancestors, y limita conexiones a https.
// Ajustar (endurecer script-src con nonces) en una segunda iteración.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives },
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
    // Vercel cobra una "transformación" por cada combinación única de
    // (imagen, ancho, calidad, formato). Con ~150 imágenes entre productos y
    // variantes, los defaults de Next (8 deviceSizes + 8 imageSizes, y un
    // cache de 60s) se comen el free tier enseguida.
    //
    // Menos anchos = menos transformaciones. Estos cubren lo que realmente
    // usa el sitio: grillas de 2/3/4 columnas y la ficha a 100vw/50vw.
    deviceSizes: [640, 828, 1080, 1920],
    // Para los <Image> con `sizes` fijo y chico: 36px y 40px (logos),
    // 48px (carrito), 64px (drawer). Next elige el inmediato superior.
    imageSizes: [48, 64, 96, 128, 256],
    // Solo webp. Sumar avif duplicaría las transformaciones por imagen.
    formats: ['image/webp'],
    // 31 días. El default de Next 15 es 60 segundos: cada vez que expira,
    // volver a servir la misma imagen cuenta como transformación nueva.
    // Este es el ahorro más grande y no cambia lo que ve el usuario.
    minimumCacheTTL: 2678400,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['flowthings.com.ar', 'localhost:3000'],
    },
  },
  serverExternalPackages: ['node-forge', 'nodemailer'],
}

module.exports = nextConfig
