import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * POST /api/integraciones/stock
 *
 * Recibe el stock ABSOLUTO desde el CRM (que es el dueño del stock) y lo
 * espeja en la tienda. Se llama cuando el stock cambia por cualquier motivo:
 * venta en Mercado Libre, compra, ajuste manual, o la propia venta web.
 *
 * Se manda absoluto (no delta) a propósito: la tienda descuenta de forma
 * optimista al aprobarse un pago, y este push la corrige/converge. Aplicar
 * deltas duplicaría el descuento.
 *
 * Modelo: en la tienda `productos.stock` es el TOTAL y `variantes.stock` el
 * de cada variante (total = suma). Por eso el CRM manda las dos cosas.
 *
 * Auth: secreto compartido en el header `x-crm-secret` (env CRM_WEBHOOK_SECRET,
 * mismo valor que TIENDA_WEBHOOK_SECRET del lado del CRM).
 */

export const runtime = 'nodejs'

interface VarianteStock {
  nombre: string
  stock: number
}

interface ProductoStock {
  sku: string
  stock_total: number
  variantes?: VarianteStock[]
}

function secretoValido(request: NextRequest): boolean {
  const esperado = process.env.CRM_WEBHOOK_SECRET
  if (!esperado) {
    console.error('[integraciones/stock] CRM_WEBHOOK_SECRET no configurado')
    return false
  }
  const recibido = request.headers.get('x-crm-secret') ?? ''
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Normaliza para comparar nombres de variante (mayúsculas/acentos/espacios). */
function norm(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export async function POST(request: NextRequest) {
  if (!secretoValido(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: { productos?: ProductoStock[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const productos = Array.isArray(body.productos) ? body.productos : []
  if (productos.length === 0) {
    return NextResponse.json({ error: 'Sin productos' }, { status: 400 })
  }

  const skus = [...new Set(productos.map((p) => p.sku).filter(Boolean))]
  const { data: existentes } = await supabaseAdmin
    .from('productos')
    .select('id, sku, variantes(id, atributos)')
    .in('sku', skus)

  const porSku = new Map((existentes ?? []).map((p: any) => [p.sku, p]))

  const actualizados: string[] = []
  const sinMapear: string[] = []

  for (const p of productos) {
    const prod: any = porSku.get(p.sku)
    if (!prod) {
      sinMapear.push(p.sku)
      continue
    }

    // Stock total del producto
    if (Number.isFinite(p.stock_total)) {
      const { error } = await supabaseAdmin
        .from('productos')
        .update({ stock: Math.max(0, Math.trunc(p.stock_total)) })
        .eq('id', prod.id)
      if (error) {
        console.error(`[integraciones/stock] error en producto ${p.sku}:`, error.message)
        continue
      }
    }

    // Stock por variante (match por el valor de los atributos: "Celeste")
    for (const v of p.variantes ?? []) {
      const variante = (prod.variantes as any[] | null)?.find(
        (vv) => norm(Object.values(vv.atributos ?? {}).join(' / ')) === norm(v.nombre)
      )
      if (!variante) {
        sinMapear.push(`${p.sku} / ${v.nombre}`)
        continue
      }
      const { error } = await supabaseAdmin
        .from('variantes')
        .update({ stock: Math.max(0, Math.trunc(v.stock)) })
        .eq('id', variante.id)
      if (error) {
        console.error(`[integraciones/stock] error en variante ${p.sku}/${v.nombre}:`, error.message)
      }
    }

    actualizados.push(p.sku)
  }

  if (sinMapear.length > 0) {
    console.warn('[integraciones/stock] sin mapear:', sinMapear)
  }

  return NextResponse.json({
    ok: true,
    actualizados: actualizados.length,
    sin_mapear: sinMapear,
  })
}
