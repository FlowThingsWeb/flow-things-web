import { NextRequest, NextResponse } from 'next/server'

const CABIFY_CLIENT_ID = process.env.CABIFY_CLIENT_ID
const CABIFY_CLIENT_SECRET = process.env.CABIFY_CLIENT_SECRET
const CABIFY_AUTH_URL = 'https://cabify.com/auth/api/authorization'
const CABIFY_API_BASE = 'https://logistics.api.cabify.com'

// Cache del token en memoria del proceso del servidor (~30 días de validez)
let tokenCache: { token: string; expiresAt: number } | null = null

async function getCabifyToken(): Promise<string> {
  const now = Date.now()

  // Reutilizar si queda más de 5 minutos de vida
  if (tokenCache && tokenCache.expiresAt > now + 300_000) {
    return tokenCache.token
  }

  const res = await fetch(CABIFY_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CABIFY_CLIENT_ID!,
      client_secret: CABIFY_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cabify auth error ${res.status}: ${text}`)
  }

  const data = await res.json()

  tokenCache = {
    token: data.access_token,
    // expires_in viene en segundos (~2591999 = ~30 días)
    expiresAt: now + data.expires_in * 1000,
  }

  return tokenCache.token
}

const MODALIDAD_LABEL: Record<string, string> = {
  express: 'Express (mismo día, pocas horas)',
  same_day: 'Same Day (hoy)',
  next_day: 'Next Day (al día siguiente)',
}

export async function POST(req: NextRequest) {
  try {
    if (!CABIFY_CLIENT_ID || !CABIFY_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Servicio de envío no configurado en el servidor.' },
        { status: 503 }
      )
    }

    const body = await req.json()
    const { direccion, ciudad, provincia, codigo_postal } = body ?? {}

    const token = await getCabifyToken()

    // Consultar tipos de envío disponibles para la cuenta
    const shippingRes = await fetch(`${CABIFY_API_BASE}/v1/shipping_types/available`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (!shippingRes.ok) {
      const text = await shippingRes.text()
      console.error('[cotizar] shipping_types error:', shippingRes.status, text)
      throw new Error(`Cabify API error ${shippingRes.status}`)
    }

    const shippingData = await shippingRes.json()

    // La API puede devolver { shipping_types: [...] } o directamente un array
    const tipos: any[] = Array.isArray(shippingData)
      ? shippingData
      : (shippingData.shipping_types ?? shippingData.data ?? [])

    const opciones = tipos.map((t: any) => {
      const modalidad: string = t.modality ?? t.type ?? t.id ?? ''
      const precio =
        t.price?.amount != null
          ? t.price.amount
          : t.price != null
          ? t.price
          : t.cost?.amount != null
          ? t.cost.amount
          : t.cost != null
          ? t.cost
          : null

      return {
        id: t.id ?? t.code ?? modalidad,
        nombre:
          t.name ??
          t.label ??
          MODALIDAD_LABEL[modalidad] ??
          modalidad,
        modalidad,
        precio,
        moneda: t.price?.currency ?? t.currency ?? 'ARS',
        descripcion: t.description ?? null,
        tiempo_estimado: t.estimated_time ?? t.eta ?? t.delivery_time ?? null,
      }
    })

    return NextResponse.json({
      opciones,
      direccion_destino: [direccion, ciudad, provincia, codigo_postal]
        .filter(Boolean)
        .join(', '),
    })
  } catch (err: any) {
    console.error('[cotizar]', err.message)
    return NextResponse.json(
      { error: 'No se pudo calcular el costo de envío. Intentá de nuevo.' },
      { status: 500 }
    )
  }
}
