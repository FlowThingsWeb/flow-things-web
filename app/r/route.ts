import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
// Nunca cachear: cada visita es un click que hay que contar.
export const dynamic = 'force-dynamic'

/**
 * GET /r?c=<campana>&u=<destino>&p=<posicion>
 *
 * Cuenta el click y redirige. Es el contador propio de los mails de difusión:
 * salen por SMTP de Gmail, que no reescribe links ni mete pixel, y GA4 sólo ve
 * al que además llegó a cargar la página — el que clickea y cierra antes no
 * aparece en ningún lado.
 *
 * El registro no puede hacer esperar a nadie: si la base falla o tarda, se
 * redirige igual. Un click perdido en la estadística es molesto; un link roto
 * en un mail que ya se mandó no se arregla.
 */

/**
 * A dónde se permite redirigir.
 *
 * Esto es lo único importante de este archivo. Un endpoint que redirige a
 * donde le digan por query string es un redirect abierto: sirve para que un
 * tercero mande "flowthings.com.ar/r?u=sitio-falso" y la víctima vea nuestro
 * dominio en el link antes de terminar en otro lado. Es el clásico para
 * phishing, y los filtros de spam lo penalizan además.
 *
 * Por eso el destino se valida contra esta lista y, si no entra, se manda al
 * home en vez de al destino pedido.
 */
const HOSTS_PERMITIDOS = new Set([
  'flowthings.com.ar',
  'www.flowthings.com.ar',
])

const HOME = 'https://www.flowthings.com.ar/'

function destinoSeguro(bruto: string | null): string | null {
  if (!bruto) return null
  let u: URL
  try {
    u = new URL(bruto)
  } catch {
    // Ruta relativa: es nuestra por definición.
    if (bruto.startsWith('/') && !bruto.startsWith('//')) return new URL(bruto, HOME).toString()
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (!HOSTS_PERMITIDOS.has(u.hostname)) return null
  return u.toString()
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const campana = (params.get('c') ?? '').slice(0, 80).trim()
  const posicion = (params.get('p') ?? '').slice(0, 40).trim() || null
  const destino = destinoSeguro(params.get('u'))

  // Destino inválido o de otro dominio: al home, y no se cuenta — no fue un
  // click nuestro, fue alguien probando el endpoint.
  if (!destino) return NextResponse.redirect(HOME, 302)

  if (campana) {
    try {
      await supabaseAdmin.from('clicks_email').insert({
        campana,
        destino,
        posicion,
        user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
        referer: request.headers.get('referer')?.slice(0, 400) ?? null,
      })
    } catch {
      // El conteo no puede romper el link. Ver el comentario de arriba.
    }
  }

  return NextResponse.redirect(destino, 302)
}
