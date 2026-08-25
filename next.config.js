/** @type {import('next').NextConfig} */

// Content-Security-Policy — defensa en profundidad contra XSS/inyección.
// Arranca permisiva (Next.js necesita 'unsafe-inline'/'unsafe-eval' sin nonces),
// pero restringe object-src, base-uri y frame-ancestors, y limita conexiones a https.
// Ajustar (endurecer script-src con nonces) en una segunda iteración.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://maps.googleapis.com https://maps.gstatic.com",
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
  async redirects() {
    return [
      {
        // Las categorías pasaron a tener URL propia. La vieja
        // /productos?categoria=jugueteria manda a /categoria/jugueteria, que es
        // la que Google indexa. Con `missing` se deja pasar la búsqueda dentro
        // de una categoría (?categoria=x&q=...), que sigue viviendo en
        // /productos y va con noindex.
        source: '/productos',
        has: [{ type: 'query', key: 'categoria', value: '(?<cat>.*)' }],
        missing: [{ type: 'query', key: 'q' }],
        destination: '/categoria/:cat',
        permanent: true,
      },
    ]
  },
  images: {
    // Loader propio: el optimizador de Vercel no se usa. Cobra una
    // transformación por combo único (imagen, ancho, calidad, formato) y el
    // free tier son 5.000 por mes; con ~1.100 imágenes distintas en el
    // catálogo, servirlo una vez en dos anchos y dos formatos (webp para
    // browsers, jpeg para bots sin `Accept: image/webp`) ya lo agota y las
    // imágenes empiezan a fallar. Las derivadas las generamos al subir
    // (lib/imagen-derivadas.ts) y las servimos desde Supabase.
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
    // Anchos del srcset. Tienen que ser los mismos que ANCHOS_DERIVADOS:
    // pedir un ancho que no existe hace que el loader caiga al inmediato
    // superior y el browser se baje un archivo más grande al pedo.
    deviceSizes: [640, 1280],
    imageSizes: [200],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['flowthings.com.ar', 'localhost:3000'],
    },
  },
  serverExternalPackages: ['node-forge', 'nodemailer'],
}

module.exports = nextConfig
