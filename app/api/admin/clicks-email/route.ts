import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/clicks-email[?campana=mafalda&dias=30]
 *
 * Los clicks de los mails de difusión, agrupados. Sin esto el conteo queda en
 * una tabla que nadie mira, que es lo mismo que no contar.
 */
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const params = req.nextUrl.searchParams
  const campana = params.get('campana')?.trim()
  const diasParam = Number(params.get('dias'))
  const dias = Number.isFinite(diasParam) && diasParam > 0 ? Math.floor(diasParam) : 90
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString()

  let query = supabaseAdmin
    .from('clicks_email')
    .select('campana, destino, posicion, created_at')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (campana) query = query.eq('campana', campana)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filas = data ?? []

  const porCampana = new Map<string, number>()
  const porDestino = new Map<string, { campana: string; destino: string; clicks: number }>()
  for (const f of filas) {
    porCampana.set(f.campana, (porCampana.get(f.campana) ?? 0) + 1)
    const k = `${f.campana}|${f.destino}`
    const prev = porDestino.get(k)
    if (prev) prev.clicks++
    else porDestino.set(k, { campana: f.campana, destino: f.destino, clicks: 1 })
  }

  return NextResponse.json({
    dias,
    total: filas.length,
    campanas: [...porCampana.entries()]
      .map(([campana, clicks]) => ({ campana, clicks }))
      .sort((a, b) => b.clicks - a.clicks),
    // Qué link del mail tiró: es lo que dice si el que convence es el producto
    // caro de arriba o el barato del final.
    destinos: [...porDestino.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 50),
    ultimo: filas[0]?.created_at ?? null,
  })
}
