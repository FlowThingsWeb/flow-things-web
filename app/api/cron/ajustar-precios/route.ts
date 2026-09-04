import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/email'
import { getConfig } from '@/lib/config'
import {
  calcularPrecioWeb,
  configDesdeSitio,
  type AjustePrecio,
  type ConfigPreciosWeb,
} from '@/lib/precios-web'

export const maxDuration = 60

/**
 * Ajusta los precios de la tienda según el costo de reposición del CRM.
 *
 * El costo vive en el CRM (que registra las compras) y los precios acá: son
 * dos bases distintas y lo único que comparten es el SKU. Este cron le pide al
 * CRM el costo con IVA de cada SKU y recalcula el precio para que quede dentro
 * del margen objetivo, ya descontadas la comisión de cobro y el envío que paga
 * la tienda.
 *
 * No usa n8n a propósito: no hay ninguna API de terceros en el medio, y el
 * plan gratuito de n8n tiene un tope de ejecuciones que ya consume el workflow
 * de Mercado Libre.
 */

/**
 * Tope de seguridad: un error de cálculo no puede tocar toda la tienda.
 *
 * Se puede subir con ?max=N para una corrida puntual —por ejemplo, después de
 * corregir un error de costo que dejó mal todo el catálogo—, pero el default
 * se queda bajo a propósito: el cron semanal no debería mover 90 precios sin
 * que nadie lo haya mirado.
 */
const MAX_CAMBIOS = 25

type CostoCrm = {
  sku: string
  costo_con_iva: number
  unidades_vendidas: number
  /** Precio efectivo del mismo SKU en ML, con promociones ya aplicadas. */
  precio_ml?: number | null
}

async function traerCostosDelCrm(): Promise<CostoCrm[]> {
  const url = process.env.CRM_URL
  const secreto = process.env.CRM_SECRET
  // Mensajes distintos por causa: el 90% de las fallas acá es una variable de
  // entorno que falta o un secreto que no coincide, y conviene saber cuál.
  if (!url) throw new Error('Falta la variable CRM_URL en la web')
  if (!secreto) throw new Error('Falta la variable CRM_SECRET en la web')

  // ml=1 trae además a cuánto se vende cada SKU en Mercado Libre: la web no
  // puede quedar más cara que su propia publicación.
  const r = await fetch(`${url}/api/integraciones/costos-por-sku?ml=1`, {
    headers: { Authorization: `Bearer ${secreto}` },
    cache: 'no-store',
  })
  if (r.status === 401) {
    throw new Error('El CRM rechazó la credencial: CRM_SECRET no coincide con WEB_SECRET del CRM')
  }
  if (r.status === 404) {
    throw new Error(`El CRM no tiene el endpoint (¿CRM_URL mal?): ${url}`)
  }
  if (!r.ok) {
    // El cuerpo trae el motivo real; sin esto el log sólo dice "500" y hay que
    // adivinar si fue la base, un timeout o una consulta.
    const detalle = await r.text().catch(() => '')
    throw new Error(`El CRM respondió ${r.status}: ${detalle.slice(0, 300)}`)
  }
  const data = await r.json()
  return (data.resultados ?? []) as CostoCrm[]
}

/** Unidades vendidas por SKU en la tienda, para no tocar lo que ya funciona. */
/**
 * El precio ya no depende de si el producto se vendió.
 *
 * Antes se dejaba quieto el precio de lo que había vendido en la última
 * semana, con la idea de que el mercado ya lo había validado. Con el margen
 * medido sobre lo facturado y dos tramos según quién paga el envío, el precio
 * correcto es uno solo y sale del costo: dejar quieto uno que quedó bajo el
 * objetivo es vender barato por inercia.
 */

const money = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

function armarMail(
  ajustes: AjustePrecio[],
  aplicados: AjustePrecio[],
  cfg: ConfigPreciosWeb,
  quedanFuera: number,
): string {
  const suben = aplicados.filter(a => a.direccion === 'sube').length
  const bajan = aplicados.filter(a => a.direccion === 'baja').length
  const caros = ajustes.filter(a => a.mas_caro_que_ml)

  const filas = aplicados
    .map(a => `<tr>
<td>${a.nombre}<br><small style="color:#888">SKU ${a.sku}</small></td>
<td>${money(a.costo_con_iva)}</td>
<td>${money(a.precio_actual)}</td>
<td><b>${money(a.precio_nuevo)}</b> ${a.direccion === 'sube' ? '↑' : a.direccion === 'baja' ? '↓' : ''}</td>
<td>${a.absorbe_envio ? `−${money(a.envio_monto)}` : '<small style="color:#888">lo paga el cliente</small>'}</td>
<td><b>${money(a.ganancia)}</b></td>
<td>${a.margen_nuevo_pct}%</td>
<td>${a.precio_ml ? money(a.precio_ml) : '—'}</td>
</tr>`)
    .join('')

  return `<h2>Precios de la tienda</h2>
<p>${aplicados.length} precio(s) actualizados: ${suben} suben y ${bajan} bajan, sobre ${ajustes.length} productos revisados.
${quedanFuera > 0 ? `Quedaron ${quedanFuera} para la próxima corrida por el tope de seguridad.` : ''}</p>

<p style="color:#666;font-size:14px">Objetivo: <b>${(cfg.margen_propio * 100).toFixed(0)}%</b> sobre lo facturado
cuando el envío lo paga el cliente, y <b>${(cfg.margen_con_envio * 100).toFixed(0)}%</b> cuando lo absorbe la
tienda, que es a partir de ${money(cfg.umbral_envio_gratis)}. Cobrar cuesta
${((cfg.comision_cobro + cfg.costo_cuotas) * 100).toFixed(2)}% (Mercado Pago más las 3 cuotas sin interés) y el
envío ${money(cfg.envio)} a cualquier punto del país.</p>

<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial;font-size:14px">
<tr><th>Producto</th><th>Costo c/IVA</th><th>Antes</th><th>Ahora</th><th>Envío</th><th>Ganancia</th><th>Margen</th><th>En ML</th></tr>
${filas}</table>

${caros.length === 0 ? '' : `<h3>${caros.length} quedan más caros que en Mercado Libre</h3>
<p style="color:#666;font-size:14px">No se les bajó el precio a propósito: hacerlo rompería el margen, y el
problema en estos casos no es el precio sino el costo de reposición — son productos donde Mercado Libre cobra
poca comisión y por eso su precio es difícil de igualar. Conviene mirarlos con el proveedor.</p>
<ul>${caros.map(a => `<li>${a.nombre} — web ${money(a.precio_nuevo)} contra ${money(a.precio_ml ?? 0)} en ML</li>`).join('')}</ul>`}`
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  // Con ?dry=1 calcula y avisa, pero no toca ningún precio.
  const params = new URL(request.url).searchParams
  const dry = params.get('dry') === '1'
  const maxParam = Number(params.get('max'))
  const maxCambios =
    Number.isFinite(maxParam) && maxParam > 0 ? Math.floor(maxParam) : MAX_CAMBIOS

  try {
    const [costos, cfgSitio] = await Promise.all([traerCostosDelCrm(), getConfig()])

    // El costo del envío y el umbral salen de la configuración de la tienda,
    // así cambiarlos no obliga a tocar código.
    const sitio = cfgSitio as Record<string, string | undefined>
    const cfg: ConfigPreciosWeb = configDesdeSitio(sitio)
    const costoPorSku = new Map(costos.map(c => [c.sku, c]))

    const { data: productos } = await supabaseAdmin
      .from('productos')
      .select('id, sku, nombre, precio')
      .eq('activo', true)

    const ajustes: AjustePrecio[] = []
    for (const p of productos ?? []) {
      const costo = p.sku ? costoPorSku.get(p.sku) : undefined
      // Sin compras registradas no hay con qué calcular el precio.
      if (!costo?.costo_con_iva || !p.precio) continue
      ajustes.push(
        calcularPrecioWeb(
          { id: p.id, sku: p.sku, nombre: p.nombre, precio: Number(p.precio) },
          costo.costo_con_iva,
          cfg,
          costo.precio_ml ?? null,
        ),
      )
    }

    const aCambiar = ajustes.filter(a => a.cambia).slice(0, maxCambios)
    const quedanFuera = ajustes.filter(a => a.cambia).length - aCambiar.length

    if (!dry) {
      for (const a of aCambiar) {
        await supabaseAdmin
          .from('productos')
          .update({ precio: a.precio_nuevo, updated_at: new Date().toISOString() })
          .eq('id', a.id)
      }
    }

    if (aCambiar.length > 0 && process.env.ADMIN_EMAIL) {
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        asunto: `Tienda: ${aCambiar.length} precio(s) actualizados${dry ? ' (simulación)' : ''}`,
        cuerpo: armarMail(ajustes, aCambiar, cfg, quedanFuera),
      })
    }

    return NextResponse.json({
      revisados: ajustes.length,
      cambiados: aCambiar.length,
      simulacion: dry,
      // Con qué reglas salieron estos precios. Sin esto no hay forma de saber,
      // mirando el resultado, por qué un precio quedó donde quedó.
      reglas: {
        margen_propio: cfg.margen_propio,
        margen_con_envio: cfg.margen_con_envio,
        cobro: cfg.comision_cobro + cfg.costo_cuotas,
        envio: cfg.envio,
        umbral_envio_gratis: cfg.umbral_envio_gratis,
      },
      absorben_envio: ajustes.filter(a => a.absorbe_envio).length,
      // Quedan más caros que su propia publicación de ML. No se les baja el
      // precio solo: hay que mirar el costo de reposición.
      mas_caros_que_ml: ajustes.filter(a => a.mas_caro_que_ml).map(a => ({
        sku: a.sku,
        web: a.precio_nuevo,
        ml: a.precio_ml,
      })),
      detalle: aCambiar.map(a => ({
        sku: a.sku,
        de: a.precio_actual,
        a: a.precio_nuevo,
        margen: a.margen_nuevo_pct,
        ganancia: a.ganancia,
        envio_gratis: a.absorbe_envio,
        ml: a.precio_ml ?? null,
      })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
