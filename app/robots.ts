import type { MetadataRoute } from 'next'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

// Privado o sin valor para un buscador: el panel, las rutas internas y las
// páginas de sesión del cliente.
const PRIVADO = ['/admin', '/api', '/cuenta', '/carrito', '/exito', '/confirmar', '/retomar']

/**
 * Los asistentes (ChatGPT, Perplexity, Claude, Gemini) recomiendan productos
 * leyendo sitios con sus propios crawlers, distintos del de Google. Con una
 * sola regla `*` quedaban permitidos por omisión, que funciona hasta el día
 * que alguien agregue un disallow general y se los lleve puestos sin querer.
 *
 * Acá van nombrados uno por uno, con el mismo permiso que Google: el catálogo
 * abierto y lo privado cerrado. Que el sitio sea citable por un asistente es
 * justamente lo que se busca — es tráfico que hoy no pasa por el buscador.
 */
const BOTS_IA = [
  'GPTBot',          // OpenAI, entrenamiento
  'OAI-SearchBot',   // OpenAI, índice de búsqueda de ChatGPT
  'ChatGPT-User',    // OpenAI, visita en vivo cuando el usuario pregunta
  'ClaudeBot',       // Anthropic
  'Claude-User',
  'PerplexityBot',   // Perplexity, índice
  'Perplexity-User', // Perplexity, visita en vivo
  'Google-Extended', // Gemini / AI Overviews
  'Applebot-Extended',
  'Bingbot',         // Copilot se apoya en el índice de Bing
  'Amazonbot',
  'CCBot',           // Common Crawl: fuente de casi todos los modelos
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // El feed de productos es público a propósito: lo consumen Merchant
        // Center y Meta, y vive bajo /api, que está bloqueado en general.
        disallow: PRIVADO,
      },
      ...BOTS_IA.map((userAgent) => ({
        userAgent,
        allow: ['/', '/api/feed'],
        disallow: PRIVADO,
      })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
