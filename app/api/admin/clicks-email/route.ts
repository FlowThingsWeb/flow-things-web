import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'
import { clasificarClicks, resumirPorCampana, type ClickCrudo } from '@/lib/clicks-bots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/clicks-email[?campana=mafalda&dias=30&detalle=1]
 *
 * Los clicks de los mails de difusión, agrupados y con los escáneres de correo
 * apartados. Sin esto el conteo queda en una tabla que nadie mira, que es lo
 * mismo que no contar; y sin apartar las máquinas, peor: cuenta mal.
 *
 * `reales` es el número que sirve para decidir. `clicks` es el crudo, y se
 * devuelve al lado para que la diferencia se vea en vez de esconderse.
 */
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const params = req.nextUrl.searchParams
  const campana = params.get('campana')?.trim()
  const diasParam = Number(params.get('dias'))
  const dias = Number.isFinite(diasParam) && diasParam > 0 ? Math.floor(diasParam) : 90
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString()
  const detalle = params.get('detalle') === '1'

  let query = supabaseAdmin
    .from('clicks_email')
    .select('campana, destino, posicion, user_agent, created_at')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (campana) query = query.eq('campana', campana)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clicks = clasificarClicks((data ?? []) as ClickCrudo[])
  const reales = clicks.filter(c => !c.sospechoso)
  const sospechosos = clicks.filter(c => c.sospechoso)

  // Qué link del mail tiró: es lo que dice si el que convence es el producto
  // caro de arriba o el barato del final. Sólo con clicks reales — un escáner
  // abre todos los links por igual y aplanaría el ranking.
  const porDestino = new Map<string, { campana: string; destino: string; posicion: string | null; clicks: number }>()
  for (const c of reales) {
    const k = `${c.campana}|${c.destino}`
    const prev = porDestino.get(k)
    if (prev) prev.clicks++
    else porDestino.set(k, { campana: c.campana, destino: c.destino, posicion: c.posicion, clicks: 1 })
  }

  const motivos: Record<string, number> = {}
  for (const c of sospechosos) motivos[c.motivo ?? 'desconocido'] = (motivos[c.motivo ?? 'desconocido'] ?? 0) + 1

  return NextResponse.json({
    dias,
    total: clicks.length,
    reales: reales.length,
    sospechosos: sospechosos.length,
    motivos,
    campanas: resumirPorCampana(clicks),
    destinos: [...porDestino.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 50),
    ultimo: clicks[0]?.created_at ?? null,
    ultimo_real: reales[0]?.created_at ?? null,
    // Para auditar la clasificación cuando un número no cierra.
    ...(detalle ? { detalle_sospechosos: sospechosos.slice(0, 200) } : {}),
  })
}
