import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * POST /api/integraciones/pack
 *
 * El CRM avisa el precio de un pack. La composición de un pack —qué productos
 * trae y en qué cantidad— se decide en el CRM, que es el único que puede
 * saber si hay stock para armarlo; el precio se decide ahí mismo para no
 * tener que tocar dos pantallas, y llega acá, que es donde la caja cobra.
 *
 * Lo que este endpoint NO hace es publicar. `activo` se cambia desde el admin
 * de la tienda, igual que en cualquier otro producto: si el CRM pudiera
 * publicar, una edición de precio podría poner un pack a la venta sin que
 * nadie lo haya decidido.
 *
 * El precio anterior se respeta si ya está puesto. Si no, se usa el que
 * tenía el producto, que es contra lo que el cliente compara el descuento.
 *
 * Auth: el mismo secreto compartido que el push de stock.
 */

export const runtime = 'nodejs'

function secretoValido(request: NextRequest): boolean {
  const esperado = process.env.CRM_WEBHOOK_SECRET
  if (!esperado) {
    console.error('[integraciones/pack] CRM_WEBHOOK_SECRET no configurado')
    return false
  }
  const recibido = request.headers.get('x-crm-secret') ?? ''
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  if (!secretoValido(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: { sku?: string; precio?: number; precio_anterior?: number | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const sku = String(body.sku ?? '').trim()
  const precio = Number(body.precio)
  if (!sku) return NextResponse.json({ error: 'Falta sku' }, { status: 400 })
  if (!Number.isFinite(precio) || precio < 0) {
    return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
  }

  const { data: producto } = await supabaseAdmin
    .from('productos')
    .select('id, precio, precio_anterior, activo')
    .eq('sku', sku)
    .maybeSingle()

  if (!producto) {
    // El pack existe en el CRM pero no hay ficha en la tienda. No se crea
    // sola: una ficha necesita foto, descripción y categoría, y eso se carga
    // a mano una vez.
    return NextResponse.json(
      { error: `No hay ningún producto con SKU ${sku} en la tienda` },
      { status: 404 },
    )
  }

  const anterior =
    body.precio_anterior !== undefined
      ? body.precio_anterior
      : (producto.precio_anterior ?? producto.precio)

  const { error } = await supabaseAdmin
    .from('productos')
    .update({ precio, precio_anterior: anterior })
    .eq('id', producto.id)

  if (error) {
    console.error(`[integraciones/pack] error actualizando ${sku}:`, error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // El catálogo sale de caché; sin esto el precio nuevo tarda en verse.
  revalidateTag('catalogo')

  return NextResponse.json({
    ok: true,
    sku,
    precio,
    precio_anterior: anterior,
    activo: producto.activo,
  })
}
