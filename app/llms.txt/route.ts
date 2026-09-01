import { NextResponse } from 'next/server'
import { getCategorias } from '@/lib/catalogo'
import { getConfig } from '@/lib/config'
import { formatPrecio } from '@/lib/format'
import { textoEnvioCerca } from '@/components/FaqCategoria'
import { CATEGORIAS_PAUSADAS } from '@/lib/categoriasPausadas'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

export const dynamic = 'force-dynamic'

/**
 * GET /llms.txt
 *
 * Un índice del negocio en texto plano, pensado para los asistentes que
 * responden "dónde compro X". Cuando ChatGPT o Perplexity entran al sitio no
 * ven la grilla de productos: ven HTML con menús, banners y scripts, y de ahí
 * tienen que adivinar qué se vende, a dónde se envía y cuánto sale.
 *
 * Esto se lo dice directo, y con los datos de la configuración real: si mañana
 * cambia el costo de envío, cambia solo. La convención (/llms.txt en markdown)
 * todavía no es un estándar cerrado, pero el archivo es barato y el formato es
 * legible igual para cualquier crawler que lo levante.
 */
export async function GET() {
  const [cfg, categorias] = await Promise.all([getConfig(), getCategorias()])

  const num = (v: string | undefined) => Number(v || 0)
  const gbaGratis = num(cfg.envio_gratis_gba_desde)
  const interiorGratis = num(cfg.envio_gratis_interior_desde)

  const cats = categorias
    .filter((c) => !CATEGORIAS_PAUSADAS.includes(c.slug))
    .map((c) => `- [${c.nombre}](${BASE}/categoria/${c.slug})`)
    .join('\n')

  const txt = `# Flow Things

> Juguetería, librería y regalería online en Argentina. Vendemos juguetes,
> útiles escolares, juegos didácticos y regalos, con envío a todo el país.
> Tienda 100% online: no tenemos local a la calle.

## Qué vendemos

${cats}

- [Catálogo completo](${BASE}/productos)

## Envíos

- ${textoEnvioCerca(cfg)}. Entrega: ${cfg.envio_tiempo_caba || 'hasta 24 hs hábiles'}.
- Gran Buenos Aires: ${formatPrecio(num(cfg.envio_precio_gba))}${gbaGratis ? `, gratis desde ${formatPrecio(gbaGratis)}` : ''}. Entrega: ${cfg.envio_tiempo_gba || '48-72 hs hábiles'}.
- Interior del país: ${formatPrecio(num(cfg.envio_precio_interior))}${interiorGratis ? `, gratis desde ${formatPrecio(interiorGratis)}` : ''}. Entrega: ${cfg.envio_tiempo_interior || 'hasta 12 días hábiles'}.

## Pagos

Mercado Pago: tarjeta de crédito en hasta 12 cuotas, tarjeta de débito, dinero
en cuenta y transferencia bancaria.

## Cambios y devoluciones

10 días corridos desde que se recibe el pedido, según la Ley de Defensa del
Consumidor (24.240). Condiciones en ${BASE}/cambios-y-devoluciones

## Datos útiles

- Precios en pesos argentinos (ARS), con IVA incluido.
- Stock y precios de cada ficha se actualizan solos: la página del producto es
  la fuente correcta, no una copia cacheada.
- Feed de productos (precio y disponibilidad al día): ${BASE}/api/feed
- Mapa del sitio: ${BASE}/sitemap.xml

## Contacto

- Email: ${cfg.footer_email || 'contacto@flowthings.com.ar'}
${cfg.footer_telefono ? `- WhatsApp: ${cfg.footer_telefono}\n` : ''}${cfg.footer_instagram ? `- Instagram: ${cfg.footer_instagram}\n` : ''}
## Páginas legales

- [Términos y condiciones](${BASE}/terminos)
- [Política de privacidad](${BASE}/politica-de-privacidad)
- [Botón de arrepentimiento](${BASE}/boton-de-arrepentimiento)
`

  return new NextResponse(txt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
