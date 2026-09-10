import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CATEGORIAS_PAUSADAS } from '@/lib/categoriasPausadas'
import { marcaDe } from '@/lib/marcas'

export const dynamic = 'force-dynamic'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

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

  const { data: productos } = await supabaseAdmin
    .from('productos')
    .select('id, nombre, slug, sku, descripcion, precio, precio_anterior, imagen_url, imagenes, stock, categorias(nombre, slug)')
    .eq('activo', true)

  /**
   * Imagen de respaldo tomada de las variantes.
   *
   * Los productos con variantes no cargan imagen propia: la imagen vive en cada
   * variante. Para la tienda da igual —la ficha muestra la de la variante
   * elegida— pero al feed le faltaba el atributo obligatorio `image_link`, y
   * Merchant Center no aprueba un producto sin imagen. Eran 24 de 106, entre
   * ellos los cinco más caros del catálogo.
   *
   * Se toma la primera variante activa que tenga imagen. Cuál de las variantes
   * sea importa poco: son el mismo producto en distinto color o modelo, y el
   * comprador llega igual a la ficha, donde las ve todas.
   */
  const primeraImagen = (x: { imagen_url?: string | null; imagenes?: unknown }): string => {
    const url = (x.imagen_url ?? '').trim()
    if (url) return url
    const arr = x.imagenes
    if (Array.isArray(arr) && arr.length) return String(arr[0] ?? '').trim()
    return ''
  }

  const sinImagen = (productos || []).filter((p: any) => !primeraImagen(p)).map((p: any) => p.id)
  const imagenDeVariante = new Map<string, string>()
  if (sinImagen.length) {
    const { data: variantes } = await supabaseAdmin
      .from('variantes')
      .select('producto_id, imagen_url, imagenes, activo, created_at')
      .in('producto_id', sinImagen)
      .order('created_at', { ascending: true })
    for (const v of variantes || []) {
      if (v.activo === false) continue
      if (imagenDeVariante.has(v.producto_id)) continue
      const img = primeraImagen(v)
      if (img) imagenDeVariante.set(v.producto_id, img)
    }
  }

  const items = (productos || [])
    .filter((p: any) => !CATEGORIAS_PAUSADAS.includes(p.categorias?.slug))
    .map((p: any) => {
      const img = primeraImagen(p) || imagenDeVariante.get(p.id) || ''
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
