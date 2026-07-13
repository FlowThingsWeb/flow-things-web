import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CATEGORIAS_PAUSADAS } from '@/lib/categoriasPausadas'

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
  const { data: productos } = await supabaseAdmin
    .from('productos')
    .select('id, nombre, slug, descripcion, precio, imagen_url, imagenes, stock, categorias(nombre, slug)')
    .eq('activo', true)

  const items = (productos || [])
    .filter((p: any) => !CATEGORIAS_PAUSADAS.includes(p.categorias?.slug))
    .map((p: any) => {
      const img = p.imagen_url || p.imagenes?.[0] || ''
      const desc = p.descripcion || p.nombre
      const disponibilidad = p.stock > 0 ? 'in stock' : 'out of stock'
      return `    <item>
      <g:id>${esc(p.id)}</g:id>
      <title>${esc(p.nombre)}</title>
      <description>${esc(desc)}</description>
      <link>${BASE}/productos/${esc(p.slug)}</link>
      <g:image_link>${esc(img)}</g:image_link>
      <g:price>${Number(p.precio).toFixed(2)} ARS</g:price>
      <g:availability>${disponibilidad}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>Flow Things</g:brand>
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
