import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CATEGORIAS_PAUSADAS } from '@/lib/categoriasPausadas'
import { marcaDe } from '@/lib/marcas'

export const dynamic = 'force-dynamic'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

/**
 * Cuántas imágenes extra van además de la principal.
 *
 * Google acepta hasta 10 additional_image_link por producto y descarta el
 * resto. El catálogo tiene con qué —la mayoría de los productos guarda entre 4
 * y 8 fotos, y los que no tienen imagen propia llegan a 35 entre sus
 * variantes— pero el feed mandaba una sola, así que Merchant Center puntuaba
 * "Imágenes por oferta: 0" cuando el rango bueno arranca en 1 y termina en 8.
 */
const MAX_ADICIONALES = 10

/**
 * Tope explícito de filas para la consulta de variantes.
 *
 * PostgREST corta en 1000 por defecto y no avisa: devuelve las primeras mil sin
 * error y sin marca de que faltan. Ese corte silencioso reproduce exactamente
 * el bug del 29/9/2026 —productos que salen con la imagen vacía y Merchant los
 * desaprueba— pero sin un `error` que mirar, así que no habría con qué
 * agarrarlo.
 *
 * Puesto a mano, y con aire: hoy la consulta trae 88 filas. Si algún día
 * devuelve exactamente este número hay que asumir que se cortó, porque desde
 * afuera un tope alcanzado y un resultado completo se ven igual.
 */
const MAX_VARIANTES = 5000

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * GET /api/feed
 * Feed de productos (RSS 2.0 + namespace g:) compatible con Google Merchant Center
 * y Meta (Facebook/Instagram) para anuncios de catálogo.
 */
export async function GET() {

  /**
   * El envío NO viaja en el feed: lo define la política de la cuenta.
   *
   * Antes iban tres zonas con <g:region>, que en Argentina es inválido y
   * desaprobó el catálogo entero durante ocho días. Después quedó un valor
   * plano para todo el país. Ahora no va ninguno, y es a propósito.
   *
   * El feed sólo sabe decir "el envío cuesta X". No sabe decir "gratis a partir
   * de $61.000", que es la condición que de verdad mueve una compra. Eso sólo
   * existe en la política de envíos de Merchant Center, y un g:shipping en el
   * feed la pisa: Google usa el del feed y la condición se pierde.
   *
   * Google tampoco admite zonas para Argentina por ningún camino —ni g:region
   * en el feed, ni región o código postal en la tabla de costes, que sólo
   * ofrece precio, peso y cantidad—. Así que el envío por cercanía de CABA no
   * se puede declarar y la política usa el techo real de $15.000: el comprador
   * de CABA paga menos en la caja de lo que vio, nunca más.
   */

  /**
   * Si la base no contesta, el feed NO se sirve a medias.
   *
   * El cliente de Supabase no tira excepción: devuelve `{ data: null, error }` y
   * sigue. Sin mirar el error, una consulta caída se veía igual que un catálogo
   * vacío, y el feed contestaba 200 con un RSS bien formado y sin un solo item.
   * Google no tiene forma de distinguir eso de "cerraron la tienda": da los
   * productos por vencidos.
   *
   * Un 503 es lo contrario: Google reintenta y mientras tanto conserva la
   * última versión buena. Un feed vacío es una respuesta; un 503 es no haber
   * contestado, que es la verdad.
   */
  const { data: productos, error: errorProductos } = await supabaseAdmin
    .from('productos')
    .select('id, nombre, slug, sku, descripcion, precio, precio_anterior, imagen_url, imagenes, stock, categorias(nombre, slug)')
    .eq('activo', true)

  if (errorProductos) {
    console.error('[feed] No se pudo leer el catálogo:', errorProductos.message)
    return new NextResponse('No se pudo leer el catálogo.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  /**
   * Imagen de respaldo tomada de las variantes.
   *
   * Los productos con variantes no cargan imagen propia: la imagen vive en cada
   * variante. Para la tienda da igual —la ficha muestra la de la variante
   * elegida— pero al feed le faltaba el atributo obligatorio `image_link`, y
   * Merchant Center no aprueba un producto sin imagen. Eran 24 de 106, entre
   * ellos los cinco más caros del catálogo.
   *
   * Se juntan las imágenes de todas las variantes activas, en orden de carga.
   * Cuál quede primera importa poco: son el mismo producto en distinto color o
   * modelo, y el comprador llega igual a la ficha, donde las ve todas. El resto
   * viaja como additional_image_link.
   */
  const imagenesDe = (x: { imagen_url?: string | null; imagenes?: unknown }): string[] => {
    const salida: string[] = []
    const sumar = (u: unknown) => {
      const url = String(u ?? '').trim()
      if (url && !salida.includes(url)) salida.push(url)
    }
    sumar(x.imagen_url)
    if (Array.isArray(x.imagenes)) x.imagenes.forEach(sumar)
    return salida
  }

  const sinImagen = (productos || []).filter((p: any) => !imagenesDe(p).length).map((p: any) => p.id)
  const imagenesDeVariantes = new Map<string, string[]>()
  if (sinImagen.length) {
    const { data: variantes, error: errorVariantes } = await supabaseAdmin
      .from('variantes')
      .select('producto_id, imagen_url, imagenes, activo, created_at')
      .in('producto_id', sinImagen)
      .order('created_at', { ascending: true })
      .limit(MAX_VARIANTES)

    /**
     * Esta consulta es la única imagen que tienen 25 de los 156 productos del
     * feed, así que si falla no se sigue de largo.
     *
     * El 29/9/2026 a las 9:50 el vigilante avisó "25 producto(s) sin
     * g:image_link" y para cuando se miró el feed estaba entero: 25 es
     * exactamente la cantidad que depende de esta consulta. Se cayó una vez,
     * `data` vino null, el `|| []` lo tapó y esos 25 salieron con el atributo
     * obligatorio vacío — que para Merchant no es "falta un dato", es motivo de
     * desaprobación, y revertirla tarda un día entero de rastreo.
     */
    if (errorVariantes) {
      console.error('[feed] No se pudieron leer las variantes:', errorVariantes.message)
      return new NextResponse('No se pudieron leer las imágenes de las variantes.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    /**
     * Tope alcanzado: se corta igual que si la consulta hubiera fallado.
     *
     * Traer 5000 de 5001 no es traer casi todo: son productos concretos que se
     * quedan sin su única imagen, y cuáles depende del orden. Servir el feed
     * así lo desaprueba en Merchant; el 503 hace que Google conserve la última
     * versión buena y reintente.
     *
     * El aviso sale por dos lados. Acá queda el log con el número, y el
     * vigilante del feed —que pide este mismo endpoint— manda el mail "El feed
     * de Google no responde" al ver el 503, que es el que de verdad se lee.
     *
     * Si esto llega a saltar, la salida no es subir el tope: es pedir las
     * variantes por páginas.
     */
    if ((variantes?.length ?? 0) >= MAX_VARIANTES) {
      console.error(
        `[feed] La consulta de variantes tocó el tope de ${MAX_VARIANTES} filas. ` +
          'Hay que paginarla: así salen productos sin imagen y Merchant los desaprueba.',
      )
      return new NextResponse('La consulta de variantes quedó cortada por el tope.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    for (const v of variantes || []) {
      if (v.activo === false) continue
      const acumulado = imagenesDeVariantes.get(v.producto_id) ?? []
      for (const img of imagenesDe(v)) {
        if (!acumulado.includes(img)) acumulado.push(img)
      }
      imagenesDeVariantes.set(v.producto_id, acumulado)
    }
  }

  const galeriaDe = (p: any): string[] => {
    const propias = imagenesDe(p)
    return propias.length ? propias : (imagenesDeVariantes.get(p.id) ?? [])
  }

  /**
   * Un producto sin ninguna foto no entra al feed.
   *
   * Mandarlo igual con `<g:image_link></g:image_link>` no es mandar menos: es
   * mandar un producto que Merchant desaprueba, y la desaprobación queda pegada
   * al artículo hasta que un rastreo posterior la levante. Dejarlo afuera hace
   * que Google conserve lo que ya tenía.
   *
   * Hoy no hay ninguno; esto es para que el día que haya uno no se lleve puesta
   * su propia ficha. Si llegaran a ser muchos, el vigilante avisa por otro lado:
   * compara la cantidad de items contra el catálogo activo.
   */
  const items = (productos || [])
    .filter((p: any) => !CATEGORIAS_PAUSADAS.includes(p.categorias?.slug))
    .filter((p: any) => {
      if (galeriaDe(p).length) return true
      console.warn(`[feed] ${p.slug} queda afuera: no tiene ninguna imagen.`)
      return false
    })
    .map((p: any) => {
      const galeria = galeriaDe(p)
      const img = galeria[0]
      const adicionales = galeria.slice(1, 1 + MAX_ADICIONALES)
      const desc = p.descripcion || p.nombre
      const disponibilidad = p.stock > 0 ? 'in stock' : 'out of stock'

      // Merchant Center espera el precio de lista en g:price y el rebajado en
      // g:sale_price; así muestra el tachado. Mandando el rebajado en g:price
      // el descuento no se ve por ningún lado.
      const anterior = Number(p.precio_anterior)
      const actual = Number(p.precio)
      const enOferta = Number.isFinite(anterior) && anterior > actual
      const precioLista = enOferta ? anterior : actual

      return `    <item>
      <g:id>${esc(p.id)}</g:id>
      <title>${esc(p.nombre)}</title>
      <description>${esc(desc)}</description>
      <link>${BASE}/productos/${esc(p.slug)}</link>
      <g:image_link>${esc(img)}</g:image_link>
${adicionales.map((u: string) => `      <g:additional_image_link>${esc(u)}</g:additional_image_link>`).join('\n')}
      <g:price>${precioLista.toFixed(2)} ARS</g:price>
      ${enOferta ? `<g:sale_price>${actual.toFixed(2)} ARS</g:sale_price>` : ''}
      <g:availability>${disponibilidad}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${esc(marcaDe(p.sku))}</g:brand>
      ${p.categorias?.nombre ? `<g:product_type>${esc(p.categorias.nombre)}</g:product_type>` : ''}
      <g:identifier_exists>no</g:identifier_exists>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Flow Things</title>
    <link>${BASE}</link>
    <description>Catálogo de productos de Flow Things</description>
${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
