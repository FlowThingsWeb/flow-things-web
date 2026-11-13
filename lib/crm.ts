import { supabaseAdmin } from './supabaseAdmin'
import { expandirPacks } from '@/lib/packs'
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

/**
 * "Piso 3 Depto B", a partir de los dos campos del checkout.
 *
 * Los campos piden sólo el valor ("3", "B") pero mucha gente escribe la
 * palabra igual, así que si ya está no se repite: "Piso Piso 3" en la planilla
 * del cadete es peor que no poner nada.
 */
function referenciaPisoDepto(piso?: string | null, depto?: string | null): string | null {
  const limpio = (v: string | null | undefined, etiqueta: string, palabras: RegExp) => {
    const t = String(v ?? '').trim()
    if (!t) return null
    return palabras.test(t) ? t : `${etiqueta} ${t}`
  }
  return (
    [
      limpio(piso, 'Piso', /^(piso|p\.?b\.?|pb)\b/i),
      limpio(depto, 'Depto', /^(d(e?p)?to|departamento|unidad)\b/i),
    ]
      .filter(Boolean)
      .join(' ') || null
  )
}

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
    .select('id, items, mp_payment_id, estado, total, descuento_monto, datos_comprador')
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

  /**
   * Un pack es un producto de la tienda que por dentro son varios. El CRM no
   * los conoce —su stock, su FIFO y sus reportes están escritos sobre
   * productos—, así que se abre acá y del otro lado llegan los componentes
   * de siempre, con el precio del pack repartido a prorrata.
   */
  const expansion = await expandirPacks(
    items.map((i) => ({
      sku: i.sku as string,
      variante: i.variante_nombre ?? null,
      cantidad: i.cantidad,
      precio_unitario: i.precio,
    })),
  )
  const itemsCRM = expansion.items
  const packsAbiertos = expansion.packsAbiertos
  if (expansion.avisos.length > 0) {
    console.warn(`[crm] orden ${ordenId}: ${expansion.avisos.join(' · ')}`)
  }

  // Total REAL cobrado (= productos + envío − descuento), para que el CRM no
  // marque saldo pendiente por la diferencia. El envío y el descuento se mandan
  // aparte para el detalle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dc = (orden.datos_comprador as any) ?? {}
  const envio = Number(dc.envio_costo ?? 0) || 0
  const descuento = Number(orden.descuento_monto ?? 0) || 0

  const payload = {
    orden_id: orden.id,
    mp_payment_id: orden.mp_payment_id ?? null,
    total: Number(orden.total ?? 0) || 0,
    envio,
    descuento,
    /**
     * A dónde va el paquete. El CRM no ve esta base, así que si no se lo
     * mandamos no tiene con qué armar el remito ni la pantalla de envíos: las
     * ventas de canal tienda le quedaban sin dirección ni teléfono.
     */
    comprador: {
      nombre: dc.nombre ?? null,
      telefono: dc.telefono ?? null,
      email: dc.email ?? null,
      domicilio: [dc.direccion, dc.piso, dc.departamento].filter(Boolean).join(' ') || null,
      /**
       * La misma dirección, partida como la pide la planilla del cadete.
       *
       * `domicilio` va pegado y es lo que se muestra; la planilla del envío en
       * el día pide la calle y el número en una columna y el piso/depto en
       * otra, porque el piso no sirve para ubicar la dirección en el mapa y
       * mezclado la rompe. Separarlas del string pegado no se puede sin
       * adivinar —en "Av. 9 de Julio 1250 3 B" cualquier regla sobre los
       * números se equivoca—, y acá están separadas de entrada.
       */
      calle: dc.direccion ?? null,
      referencia: referenciaPisoDepto(dc.piso, dc.departamento),
      localidad: dc.ciudad ?? null,
      provincia: dc.provincia ?? null,
      cp: dc.codigo_postal ?? null,
      doc_nro: dc.dni ?? null,
      sin_piso: dc.sin_piso_depto === true,
    },
    envio_metodo: dc.envio_nombre ?? dc.envio_tipo ?? null,
    /**
     * El identificador del método, además del nombre.
     *
     * `envio_metodo` es lo que ve el comprador y sale de una variable de
     * configuración de la tienda: si se renombra, el CRM deja de reconocer
     * los envíos por km y los manda al circuito equivocado sin que nada
     * falle a la vista. `envio_tipo` ('cercania', 'amba', 'bsas',
     * 'interior', 'retiro') lo pone el cotizador y no cambia.
     */
    envio_tipo: dc.envio_tipo ?? null,
    /**
     * Cuándo dijo el comprador que puede recibir. Va al CRM porque es dato de
     * despacho: sin esto habría que entrar a la tienda para saber cuándo
     * llevar el paquete.
     */
    franjas_entrega: Array.isArray(dc.franjas_entrega) ? dc.franjas_entrega : null,
    items: itemsCRM,
    /**
     * Los packs que se abrieron, para que la venta del CRM lo deje dicho.
     * El CRM ya no conoce los packs: ve los componentes sueltos, y sin esta
     * nota no habría forma de saber que esos cuatro renglones eran una caja.
     */
    packs_abiertos: packsAbiertos.length > 0 ? packsAbiertos : undefined,
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

/**
 * Le manda al CRM los comprobantes fiscales de una orden.
 *
 * La factura de la tienda la emite la tienda, con su certificado y su punto de
 * venta, así que el CRM no tiene forma de enterarse del CAE: lo ve el contador
 * en un lado y el CRM muestra la venta sin comprobante. Esto cierra ese hueco.
 *
 * Van juntas la factura y la nota de crédito —si existe— por un motivo
 * concreto: el CRM ofrece emitir la NC de toda venta cancelada que tenga CAE.
 * Si le llegara sólo la factura, ese botón aparecería sobre una venta que ya
 * tiene su NC hecha en la tienda, y apretarlo emitiría una segunda NC contra
 * la misma factura, desde otro punto de venta.
 *
 * Lanza si falla, para que el job reintente: el aviso puede llegar antes que
 * la venta misma —la factura se emite después de encolar la venta— y lo que
 * corresponde ahí es esperar y volver a intentar.
 */
export async function notificarComprobantesCRM(ordenId: string): Promise<void> {
  if (!crmHabilitado()) {
    console.log('[crm] CRM_URL/CRM_WEBHOOK_SECRET no configurados — se omite el aviso')
    return
  }

  const { data: orden, error } = await supabaseAdmin
    .from('ordenes')
    .select('id, total, datos_comprador')
    .eq('id', ordenId)
    .single()

  if (error || !orden) {
    throw new Error(`No se pudo leer la orden ${ordenId}: ${error?.message}`)
  }

  const c = (orden.datos_comprador ?? {}) as Record<string, unknown>
  if (!c.factura_cae || !c.factura_nro) {
    console.warn(`[crm] Orden ${ordenId} sin factura emitida — no hay comprobante que informar`)
    return
  }

  const ptoVenta = Number(process.env.AFIP_PTO_VENTA || 5)

  const payload = {
    orden_id: ordenId,
    factura: {
      tipo: 'C',
      punto_venta: ptoVenta,
      numero: Number(c.factura_nro),
      fecha: fechaISO(c.factura_fecha),
      cae: String(c.factura_cae),
      cae_vencimiento: fechaISODesdeAfip(c.factura_vto),
    },
    ...(c.nc_cae
      ? {
          nota_credito: {
            punto_venta: Number(c.nc_pv ?? ptoVenta),
            numero: Number(c.nc_nro),
            fecha: fechaISO(c.nc_fecha),
            cae: String(c.nc_cae),
            cae_vencimiento: fechaISODesdeAfip(c.nc_vto),
            total: Number(orden.total ?? 0),
          },
        }
      : {}),
  }

  const res = await fetch(`${CRM_URL!.replace(/\/$/, '')}/api/integraciones/tienda/factura`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tienda-secret': CRM_SECRET!,
    },
    body: JSON.stringify(payload),
  })

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(`CRM respondió ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
  }

  console.log(
    `[crm] Orden ${ordenId}: factura ${payload.factura.numero}${payload.nota_credito ? ` + NC ${payload.nota_credito.numero}` : ''} informadas`
  )
}

/** "4/11/2026" → "2026-11-04", que es lo que entiende una columna `date`. */
function fechaISO(fecha: unknown): string | null {
  const m = String(fecha ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mes, a] = m
  return `${a}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/** "20261114" (formato AFIP) → "2026-11-14". */
function fechaISODesdeAfip(fecha: unknown): string | null {
  const t = String(fecha ?? '').trim()
  return /^\d{8}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : null
}
