import { supabaseAdmin } from './supabaseAdmin'
import { ItemOrden } from '@/types'

/**
 * Integración con el CRM (sistema de gestión que también maneja Mercado Libre).
 *
 * El CRM es el dueño del stock: cada venta de la tienda se le informa para que
 * la registre como canal 'tienda', descuente stock y propague el cambio a las
 * publicaciones de ML. El CRM además registra el cobro y lo libera a Mercado
 * Pago cuando MP libera los fondos.
 *
 * El endpoint del CRM es idempotente por orden_id, así que reintentar es seguro
 * (se invoca desde la cola de jobs con backoff).
 */

const CRM_URL = process.env.CRM_URL
const CRM_SECRET = process.env.CRM_WEBHOOK_SECRET

/** True si la integración está configurada. Sin esto, se omite silenciosamente. */
export function crmHabilitado(): boolean {
  return Boolean(CRM_URL && CRM_SECRET)
}

/**
 * Informa una venta aprobada al CRM. Lanza si falla, para que el job reintente.
 */
export async function notificarVentaCRM(ordenId: string): Promise<void> {
  if (!crmHabilitado()) {
    console.log('[crm] CRM_URL/CRM_WEBHOOK_SECRET no configurados — se omite el aviso')
    return
  }

  const { data: orden, error } = await supabaseAdmin
    .from('ordenes')
    .select('id, items, mp_payment_id, estado')
    .eq('id', ordenId)
    .single()

  if (error || !orden) {
    throw new Error(`No se pudo leer la orden ${ordenId}: ${error?.message}`)
  }
  if (orden.estado !== 'approved') {
    console.warn(`[crm] Orden ${ordenId} no está approved (${orden.estado}) — no se informa`)
    return
  }

  const items = (orden.items as ItemOrden[]) ?? []

  // Sin SKU el CRM no puede mapear el producto. Cortamos antes de enviar una
  // venta incompleta (mejor que quede sin registrar y se vea en los logs).
  const sinSku = items.filter((i) => !i.sku)
  if (sinSku.length > 0) {
    throw new Error(
      `Orden ${ordenId}: hay items sin SKU (${sinSku.map((i) => i.nombre).join(', ')}). ` +
      `No se puede informar al CRM.`
    )
  }

  const payload = {
    orden_id: orden.id,
    mp_payment_id: orden.mp_payment_id ?? null,
    items: items.map((i) => ({
      sku: i.sku,
      variante: i.variante_nombre ?? null,
      cantidad: i.cantidad,
      precio_unitario: i.precio,
    })),
  }

  const res = await fetch(`${CRM_URL!.replace(/\/$/, '')}/api/integraciones/tienda/venta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tienda-secret': CRM_SECRET!,
    },
    body: JSON.stringify(payload),
  })

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(
      `CRM respondió ${res.status}: ${JSON.stringify(body).slice(0, 300)}`
    )
  }

  console.log(
    `[crm] Orden ${ordenId} informada${body.idempotente ? ' (ya existía)' : ''} → venta ${body.venta_id}`
  )
}
