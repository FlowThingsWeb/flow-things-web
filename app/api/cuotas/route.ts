import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/cuotas?amount=12345
 * Devuelve el plan de cuotas real de Mercado Pago para ese monto:
 *  - sinInteres: mejor opción sin interés (más cuotas con tasa 0), si existe
 *  - max: máximo de cuotas disponible
 * Se consulta la API de MP con el access token del comercio, así refleja las
 * promociones vigentes de la cuenta (ej. 3 o 6 cuotas sin interés).
 */

interface PayerCost {
  installments: number
  installment_rate: number
  installment_amount: number
}

interface Plan { cuotas: number; monto: number }

export async function GET(request: NextRequest) {
  const amount = Number(new URL(request.url).searchParams.get('amount'))
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'amount inválido' }, { status: 400 })
  }

  const token = process.env.MP_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ max: null, sinInteres: null })
  }

  try {
    // MP exige payment_method_id (o bin). Consultamos las tarjetas más comunes en
    // AR y unimos los planes. Visa cubre la mayoría; master como respaldo.
    const costs: PayerCost[] = []
    for (const pm of ['visa', 'master']) {
      const r = await fetch(
        `https://api.mercadopago.com/v1/payment_methods/installments?amount=${amount}&payment_method_id=${pm}&locale=es-AR`,
        {
          headers: { Authorization: `Bearer ${token}` },
          // Cache 1h del lado del server: las cuotas no cambian a cada rato.
          next: { revalidate: 3600 },
        }
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
      if (costs.length > 0) break // con visa ya alcanza en la mayoría de los casos
    }

    if (costs.length === 0) return NextResponse.json({ max: null, sinInteres: null })

    // Mejor opción SIN interés (tasa 0), la de más cuotas
    const sinInteresCosts = costs.filter((c) => c.installment_rate === 0 && c.installments > 1)
    const sinInteresRaw = sinInteresCosts.sort((a, b) => b.installments - a.installments)[0]
    const sinInteres: Plan | null = sinInteresRaw
      ? { cuotas: sinInteresRaw.installments, monto: sinInteresRaw.installment_amount }
      : null

    // Máximo de cuotas disponible
    const maxRaw = costs.sort((a, b) => b.installments - a.installments)[0]
    const max: Plan = { cuotas: maxRaw.installments, monto: maxRaw.installment_amount }

    return NextResponse.json({ max, sinInteres })
  } catch {
    return NextResponse.json({ max: null, sinInteres: null })
  }
}
