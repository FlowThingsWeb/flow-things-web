import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { escapeHtml } from '@/lib/escape-html'
import { getConfig } from '@/lib/config'
import { estadoCyber } from '@/lib/cyber'
import { leerTodo } from '@/lib/cyber-aplicar'
import { FACTORES_DEFAULT } from '@/lib/cyber-precios'

/**
 * El cuerpo del mail de las Ofertas Cyber, armado con los precios de ahora.
 *
 * No se escribe a mano por una razón concreta: el mail sale el mismo día que
 * se aplican los descuentos, y un HTML escrito el jueves con los precios del
 * jueves anuncia números que el lunes ya no existen. Acá los productos y los
 * precios se leen al momento de armarlo, así lo que dice el mail es lo que
 * dice la tienda.
 *
 * Devuelve sólo el contenido: el encabezado con el logo, el botón del final y
 * el pie con el link de baja los pone `buildDifusionHtml` al enviar.
 */

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.flowthings.com.ar').replace(/\/$/, '')

/** Campaña con la que se cuentan los clicks en `clicks_email`. */
export const CAMPANA_CYBER = 'cyber-2026'

/**
 * Todos los links del mail pasan por /r: cuenta el click y redirige.
 *
 * Gmail no reescribe links ni mete pixel, y GA4 sólo ve al que además llegó a
 * cargar la página. Sin esto no hay forma de saber si el mail funcionó.
 */
function link(destino: string, posicion: string): string {
  const u = `${BASE}${destino}`
  return `${BASE}/r?c=${CAMPANA_CYBER}&p=${encodeURIComponent(posicion)}&u=${encodeURIComponent(u)}`
}

const money = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')

export interface OfertaMail {
  nombre: string
  slug: string
  precio: number
  precio_anterior: number
  imagen: string | null
}

/**
 * Lo que VA a estar rebajado, cuando todavía no se aplicó el descuento.
 *
 * Existe para poder armar y mirar el mail antes de que la promo arranque. Los
 * precios no son inventados: son los que va a poner el mismo código que
 * aplica el descuento, con el piso de margen y las exclusiones ya puestas. Si
 * algo cambia entre hoy y el lunes —un costo, un stock— el borrador se vuelve
 * a armar solo apenas se aplica.
 */
async function ofertasProyectadas(limite: number): Promise<OfertaMail[]> {
  const { filas } = await leerTodo(FACTORES_DEFAULT)
  const candidatos = filas.filter((f) => !f.bajo_piso && !f.sin_descuento_real && f.stock > 0)
  if (candidatos.length === 0) return []

  const { data } = await supabaseAdmin
    .from('productos')
    .select('id, slug, imagen_url, imagenes')
    .in(
      'id',
      candidatos
        .sort((a, b) => b.descuento_real - a.descuento_real)
        .slice(0, limite)
        .map((f) => f.id),
    )

  const porId = new Map((data ?? []).map((p) => [String(p.id), p]))
  return candidatos
    .sort((a, b) => b.descuento_real - a.descuento_real)
    .slice(0, limite)
    .map((f) => {
      const p = porId.get(f.id)
      const galeria = Array.isArray(p?.imagenes) ? (p!.imagenes as string[]) : []
      return {
        nombre: f.nombre,
        slug: String(p?.slug ?? ''),
        precio: f.precio_oferta,
        precio_anterior: f.precio_inflado,
        imagen: p?.imagen_url ? String(p.imagen_url) : (galeria[0] ?? null),
      }
    })
    .filter((p) => p.slug !== '')
}

/** Lo rebajado, de mayor descuento a menor: el mail abre con lo que más baja. */
export async function ofertasParaElMail(limite = 8): Promise<OfertaMail[]> {
  const { data } = await supabaseAdmin
    .from('productos')
    .select('nombre, slug, precio, precio_anterior, imagen_url, imagenes, stock')
    .eq('activo', true)
    .not('precio_anterior', 'is', null)

  const reales = (data ?? [])
    .map((p) => {
      const galeria = Array.isArray(p.imagenes) ? (p.imagenes as string[]) : []
      return {
        nombre: String(p.nombre),
        slug: String(p.slug),
        precio: Number(p.precio),
        precio_anterior: Number(p.precio_anterior),
        imagen: p.imagen_url ? String(p.imagen_url) : (galeria[0] ?? null),
        stock: Number(p.stock ?? 0),
      }
    })
    // Sin stock no entra: un mail que lleva a un producto agotado quema el
    // click y la confianza al mismo tiempo.
    .filter((p) => p.stock > 0 && p.precio_anterior > p.precio)
    .sort(
      (a, b) =>
        (b.precio_anterior - b.precio) / b.precio_anterior -
        (a.precio_anterior - a.precio) / a.precio_anterior,
    )
    .slice(0, limite)
    .map(({ stock: _stock, ...resto }) => resto)

  /**
   * Sin nada rebajado todavía, se muestra lo que va a estar.
   *
   * Es el caso de los días previos: el precio de lista ya subió pero el
   * descuento se aplica recién cuando arranca la promo. Sin esto, el
   * borrador que se arma para revisarlo sale sin un solo producto, que es
   * justo cuando uno quiere verlo.
   */
  return reales.length > 0 ? reales : ofertasProyectadas(limite)
}

function fichaProducto(p: OfertaMail): string {
  const off = Math.round(((p.precio_anterior - p.precio) / p.precio_anterior) * 100)
  const href = link(`/productos/${p.slug}`, 'producto')
  return `<td width="50%" valign="top" style="padding:0 6px 16px">
  <a href="${href}" style="text-decoration:none;color:#1a0040">
    ${
      p.imagen
        ? `<img src="${escapeHtml(p.imagen)}" width="250" alt="${escapeHtml(p.nombre)}" style="display:block;width:100%;max-width:250px;border-radius:12px;border:1px solid #ece9f5"/>`
        : ''
    }
    <div style="margin:8px 0 2px;font-size:11px;font-weight:800;color:#ffffff;background:#7C3AED;display:inline-block;padding:3px 8px;border-radius:999px">-${off}%</div>
    <div style="font-size:13px;line-height:1.35;color:#1a0040">${escapeHtml(p.nombre.slice(0, 58))}</div>
    <div style="margin-top:4px;font-size:17px;font-weight:800;color:#1a0040">${money(p.precio)}</div>
    <div style="font-size:12px;color:#9ca3af;text-decoration:line-through">${money(p.precio_anterior)}</div>
  </a>
</td>`
}

export interface DifusionCyber {
  asunto: string
  cuerpo: string
  productos: number
  descuentoMaximo: number
}

export async function armarDifusionCyber(): Promise<DifusionCyber> {
  const [cfg, ofertas] = await Promise.all([getConfig(), ofertasParaElMail()])
  return cuerpoDifusionCyber(ofertas, {
    titulo: estadoCyber(cfg).titulo,
    umbral: Number(cfg.envio_cadeteria_gratis_desde || cfg.precio_umbral_envio_gratis) || 61000,
    llegaHoy: cfg.envio_cadeteria_activo === '1',
  })
}

/**
 * La parte que arma el HTML, sin base de datos.
 *
 * Separada para poder verla antes de que exista una sola oferta cargada: un
 * mail que sólo se puede mirar el día que sale es un mail que se revisa con
 * la lista de destinatarios ya elegida.
 */
export function cuerpoDifusionCyber(
  ofertas: OfertaMail[],
  opts: { titulo: string; umbral: number; llegaHoy: boolean },
): DifusionCyber {
  const { titulo, umbral, llegaHoy } = opts
  const cyber = { titulo }

  const descuentoMaximo = ofertas.length
    ? Math.max(
        ...ofertas.map((p) =>
          Math.round(((p.precio_anterior - p.precio) / p.precio_anterior) * 100),
        ),
      )
    : 0

  const filas: string[] = []
  for (let i = 0; i < ofertas.length; i += 2) {
    filas.push(
      `<tr>${fichaProducto(ofertas[i])}${
        ofertas[i + 1] ? fichaProducto(ofertas[i + 1]) : '<td width="50%"></td>'
      }</tr>`,
    )
  }

  /**
   * El asunto dice el número, no "ofertas imperdibles".
   *
   * En una bandeja llena de mails de Cyber, lo único que distingue al nuestro
   * es un dato: cuánto baja, y que llega hoy. Los adjetivos los pone todo el
   * mundo.
   */
  const asunto = descuentoMaximo
    ? `Hasta ${descuentoMaximo}% OFF &#x26A1; ${cyber.titulo}`
    : `${cyber.titulo} &#x26A1;`

  const cuerpo = `
<h1 style="margin:0 0 6px;font-size:26px;line-height:1.2;color:#1a0040">${escapeHtml(cyber.titulo)}</h1>
<p style="margin:0 0 18px;font-size:17px;color:#4b3b73">
  ${descuentoMaximo ? `Hasta <strong>${descuentoMaximo}% de descuento</strong> en toda la tienda.` : 'Descuentos en toda la tienda.'}
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border-collapse:separate;border-spacing:0 8px">
  ${
    llegaHoy
      ? `<tr><td style="background:#f6f2ff;border-radius:12px;padding:12px 14px;font-size:14px;color:#1a0040">
      &#x1F6F5; <strong>Llega hoy</strong> en CABA y alrededores, comprando antes de las 13.
    </td></tr>`
      : ''
  }
  <tr><td style="background:#f6f2ff;border-radius:12px;padding:12px 14px;font-size:14px;color:#1a0040">
    &#x1F69A; <strong>Envío gratis</strong> a todo el país desde ${money(umbral)}.
  </td></tr>
  <tr><td style="background:#f6f2ff;border-radius:12px;padding:12px 14px;font-size:14px;color:#1a0040">
    &#x1F4B3; <strong>3 cuotas sin interés</strong> con todas las tarjetas.
  </td></tr>
</table>

${
  filas.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">${filas.join('\n')}</table>`
    : '<p style="margin:0 0 18px;font-size:15px;color:#6b7280">Mirá todo lo rebajado en la tienda.</p>'
}

<p style="margin:18px 0 0;text-align:center">
  <a href="${link('/cyber', 'cta')}" style="display:inline-block;background:#1a0040;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:15px 38px;border-radius:12px">Ver todas las ofertas</a>
</p>
`.trim()

  return { asunto, cuerpo, productos: ofertas.length, descuentoMaximo }
}

/** Título del borrador. Es uno solo: se pisa, no se acumula. */
export const TITULO_DIFUSION = 'Ofertas Cyber'

/**
 * Guarda —o rehace— el borrador del mail. No manda nada.
 *
 * Lo usan el botón del panel y el aplicador automático: cuando el descuento
 * entra solo a las 00:00, el borrador se rehace en el mismo momento con los
 * precios ya aplicados. Así el mail no puede quedar anunciando los precios de
 * la proyección del jueves.
 */
export async function guardarBorradorCyber(): Promise<DifusionCyber & { id: string }> {
  const armado = await armarDifusionCyber()

  const { data: existente } = await supabaseAdmin
    .from('difusiones')
    .select('id')
    .eq('titulo', TITULO_DIFUSION)
    .maybeSingle()

  const fila = {
    titulo: TITULO_DIFUSION,
    asunto: armado.asunto,
    cuerpo: armado.cuerpo,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = existente
    ? await supabaseAdmin.from('difusiones').update(fila).eq('id', existente.id).select().single()
    : await supabaseAdmin.from('difusiones').insert(fila).select().single()

  if (error) throw new Error(error.message)
  return { ...armado, id: String(data.id) }
}
