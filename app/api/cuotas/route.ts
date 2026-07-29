import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * GET /api/cuotas?amount=12345
 *
 * Devuelve el plan de cuotas para ese monto:
 *  - sinInteres: mejor tramo SIN interés que aplica al monto.
 *  - proximo:    siguiente tramo sin interés y cuánto falta para llegar.
 *  - max:        máximo de cuotas (con interés) que informa MP.
 *
 * Las cuotas SIN interés NO se detectan desde la API de MP: esa API no
 * refleja de forma confiable las promos del comercio (un producto de
 * $105k mostraba "24 cuotas con interés" en vez de "2 sin interés"). Se
 * calculan desde los mínimos que el admin configuró en MP, guardados en
 * la tabla `configuracion` (clave `cuotas_sin_interes`). El máximo con
 * interés sí se toma de MP (para eso su API sí sirve).
 */

interface PayerCost {
  installments: number
  installment_rate: number
  installment_amount: number
}

interface Plan { cuotas: number; monto: number }
interface Proximo { cuotas: number; falta: number; min: number }
interface PlanSinInteres { cuotas: number; min: number }

// Fallback si la config no está cargada (coincide con lo seteado en MP).
const PLANES_DEFAULT: PlanSinInteres[] = [
  { cuotas: 2, min: 95000 },
  { cuotas: 3, min: 115000 },
  { cuotas: 6, min: 311000 },
]

async function getPlanesSinInteres(): Promise<PlanSinInteres[]> {
  try {
    const { data } = await supabaseAdmin
      .from('configuracion')
      .select('valor')
      .eq('clave', 'cuotas_sin_interes')
      .maybeSingle()
    if (!data?.valor) return PLANES_DEFAULT
    const parsed = JSON.parse(data.valor) as PlanSinInteres[]
    if (!Array.isArray(parsed) || parsed.length === 0) return PLANES_DEFAULT
    return parsed
      .filter((p) => Number(p.cuotas) > 1 && Number(p.min) >= 0)
      .map((p) => ({ cuotas: Number(p.cuotas), min: Number(p.min) }))
      .sort((a, b) => a.min - b.min)
  } catch {
    return PLANES_DEFAULT
  }
}

async function getMaxConInteres(amount: number): Promise<Plan | null> {
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) return null
  try {
    const costs: PayerCost[] = []
    for (const pm of ['visa', 'master']) {
      const r = await fetch(
        `https://api.mercadopago.com/v1/payment_methods/installments?amount=${amount}&payment_method_id=${pm}&locale=es-AR`,
        {
          headers: { Authorization: `Bearer ${token}` },
          next: { revalidate: 3600 },
        },
      )
      if (!r.ok) continue
      const data = await r.json()
      for (const grupo of Array.isArray(data) ? data : []) {
        for (const pc of grupo.payer_costs || []) {
          costs.push({
            installments: pc.installments,
            installment_rate: pc.installment_rate,
            installment_amount: pc.installment_amount,
          })
        }
      }
      if (costs.length > 0) break
    }
    if (costs.length === 0) return null
    const maxRaw = costs.sort((a, b) => b.installments - a.installments)[0]
    return { cuotas: maxRaw.installments, monto: maxRaw.installment_amount }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const amount = Number(new URL(request.url).searchParams.get('amount'))
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'amount inválido' }, { status: 400 })
  }

  const planes = await getPlanesSinInteres()

  // Mejor tramo sin interés que YA aplica (más cuotas con min <= monto).
  const aplican = planes.filter((p) => amount >= p.min)
  const mejor = aplican.length
    ? aplican.reduce((a, b) => (b.cuotas > a.cuotas ? b : a))
    : null
  const sinInteres: Plan | null = mejor
    ? { cuotas: mejor.cuotas, monto: Math.round(amount / mejor.cuotas) }
    : null

  // Próximo tramo (el de menor min por encima del actual) + cuánto falta.
  const superiores = planes
    .filter((p) => p.min > amount)
    .sort((a, b) => a.min - b.min)
  const proximo: Proximo | null = superiores.length
    ? {
        cuotas: superiores[0].cuotas,
        min: superiores[0].min,
        falta: Math.round(superiores[0].min - amount),
      }
    : null

  const max = await getMaxConInteres(amount)

  return NextResponse.json({ sinInteres, proximo, max })
}
