import type { MetadataRoute } from 'next'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

// Privado o sin valor para un buscador: el panel, las rutas internas y las
// páginas de sesión del cliente.
const PRIVADO = ['/admin', '/api', '/cuenta', '/carrito', '/exito', '/confirmar', '/retomar']

/**
 * Filtros y variantes: mismo contenido con otra URL.
 *
 * Estas páginas ya declaran su canónica y apuntan a la URL limpia, así que
 * Google nunca las indexó. El problema no era la indexación sino el RASTREO:
 * el 3/9/2026 gastó 25 visitas en permutaciones de filtros de una sola marca
 * —?min=20000, ?max=40000, ?disponible=1, seis variantes del mismo producto—
 * mientras 44 subcategorías con producto real seguían sin visitar desde que
 * las descubrió el 25/7. Google le da a cada sitio un presupuesto de rastreo
 * según su autoridad; el de esta tienda es chico y se estaba yendo en copias.
 *
 * El patrón va como `/*?*x=` y no `/*?x=`: el segundo sólo agarra el
 * parámetro cuando es el PRIMERO de la query, y se escaparían las
 * combinaciones tipo ?max=40000&min=20000.
 *
 * `page` queda FUERA de la lista a propósito. Es paginación, no un filtro:
 * bloquearla puede esconder productos a los que sólo se llega desde una
 * página profunda. Google la maneja bien sola.
 *
 * El intercambio, que conviene tener presente: al bloquear el rastreo, Google
 * deja de ver la canónica de estas URLs. Es lo recomendado para navegación
 * por filtros, pero no sale gratis.
 */
const FACETAS = [
  '/*?*variante=',
  '/*?*min=',
  '/*?*max=',
  '/*?*orden=',
  '/*?*disponible=',
  '/*?*sub=',
]

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
        disallow: [...PRIVADO, ...FACETAS],
      },
      ...BOTS_IA.map((userAgent) => ({
        userAgent,
        allow: ['/', '/api/feed'],
        disallow: [...PRIVADO, ...FACETAS],
      })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
