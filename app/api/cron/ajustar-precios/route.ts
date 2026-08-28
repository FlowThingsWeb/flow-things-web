import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/email'
import { getConfig } from '@/lib/config'
import {
  CONFIG_WEB_DEFAULT,
  MUESTRAS_KM_MINIMAS,
  calcularPrecioWeb,
  costeoDesdeConfig,
  escalonesDesdeConfig,
  recomendarUmbrales,
  type AjustePrecio,
  type ConfigPreciosWeb,
  type CosteoEnvio,
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
async function ventasWebPorSku(dias: number): Promise<Map<string, number>> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString()
  const { data } = await supabaseAdmin
    .from('ordenes')
    .select('items, estado, created_at')
    .gte('created_at', desde)

  const porSku = new Map<string, number>()
  for (const orden of data ?? []) {
    // Sólo cuentan las ventas cobradas.
    if (!ESTADOS_COBRADOS.includes(String(orden.estado).toLowerCase())) {
      continue
    }
    for (const item of (orden.items ?? []) as { sku?: string; cantidad?: number }[]) {
      if (!item?.sku) continue
      porSku.set(item.sku, (porSku.get(item.sku) ?? 0) + Number(item.cantidad ?? 1))
    }
  }
  return porSku
}

/** Estados en los que la venta se considera cobrada. */
const ESTADOS_COBRADOS = ['pagado', 'aprobado', 'approved', 'completado']

/**
 * Distancias de los envíos por cercanía ya despachados.
 *
 * Es lo que le permite al costeo dejar de asumir el peor caso: en vez de
 * cobrar todos los productos como si cada envío fuera al borde del radio, se
 * usa el percentil 90 de lo que realmente se despachó. Sólo cuentan las
 * órdenes cobradas y sólo las que se cobraron por distancia (las de tarifa
 * plana no tienen km).
 */
async function kmDespachados(dias: number): Promise<number[]> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString()
  const { data } = await supabaseAdmin
    .from('ordenes')
    .select('datos_comprador, estado')
    .gte('created_at', desde)

  const kms: number[] = []
  for (const orden of data ?? []) {
    if (!ESTADOS_COBRADOS.includes(String(orden.estado).toLowerCase())) continue
    const km = Number((orden.datos_comprador as { envio_km?: number } | null)?.envio_km)
    if (Number.isFinite(km) && km > 0) kms.push(km)
  }
  return kms
}

const money = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

function armarMail(
  ajustes: AjustePrecio[],
  aplicados: AjustePrecio[],
  cfg: ConfigPreciosWeb,
  costeo: CosteoEnvio,
  /** Cuántos quedaron sin cambiar por el tope de la corrida. */
  quedanFuera = 0,
) {
  // Con los precios ya calculados se ve si algún umbral quedó mal ubicado.
  const sugerencias = recomendarUmbrales(ajustes.map(a => a.precio_nuevo), cfg)
  const suben = aplicados.filter(a => a.direccion === 'sube').length
  const bajan = aplicados.filter(a => a.direccion === 'baja').length

  const filas = aplicados
    .map(a => {
      const dif = a.precio_actual ? (a.precio_nuevo / a.precio_actual - 1) * 100 : 0
      const color = dif < 0 ? '#b91c1c' : '#15803d'
      return `<tr>
<td><b>${a.sku}</b><br><small style="color:#888">${a.nombre}</small></td>
<td>${money(a.costo_con_iva)}</td>
<td>${money(a.comision_monto)}<br><small style="color:#888">${a.comision_pct}% de cobro</small></td>
<td>${money(a.costo_envio)}<br><small style="color:#888">envío</small></td>
<td>${a.precio_ml ? money(a.precio_ml) : '<span style="color:#bbb">—</span>'}</td>
<td>${money(a.precio_actual)}</td>
<td><b>${money(a.precio_nuevo)}</b></td>
<td style="color:${color};font-weight:700">${dif > 0 ? '+' : ''}${dif.toFixed(1)}%</td>
<td><b>${money(a.ganancia)}</b><br><small style="color:#888">${a.margen_actual_pct}% → ${a.margen_nuevo_pct}%</small></td>
<td style="font-size:12px">${a.nota}</td></tr>`
    })
    .join('')

  return `<h2>Precios de la tienda actualizados</h2>
<p>Se revisaron ${ajustes.length} productos con costo en el CRM.
Se cambiaron <b>${aplicados.length}</b>: ${suben} suben, ${bajan} bajan.</p>
${quedanFuera > 0 ? `<p style="color:#b45309"><b>Quedaron ${quedanFuera} sin cambiar</b> por el tope de la corrida. Corré de nuevo para seguir.</p>` : ''}
<p>La ganancia es lo que queda por unidad después de la comisión de cobro, el envío que paga la tienda
y el costo con IVA. El margen es esa ganancia sobre el costo.</p>
<p>Objetivo: entre <b>${(cfg.margen_min * 100).toFixed(0)}%</b> y <b>${(cfg.margen_objetivo * 100).toFixed(0)}%</b>
sobre el costo con IVA, ya descontados la comisión de cobro y el envío que paga la tienda.
Además, ningún precio queda por encima del de la misma publicación en Mercado Libre.</p>
${aplicados.length === 0 ? '<p>No hubo cambios: todos los precios están dentro del rango.</p>' : `
<table border="1" cellpadding="6" cellspacing="0" style="font-size:14px">
<tr><th>SKU / producto</th><th>Costo c/IVA</th><th>Comisión</th><th>Envío</th><th>En ML</th><th>Precio viejo</th><th>Precio nuevo</th><th>Dif</th><th>Ganancia y margen</th><th>Por qué</th></tr>
${filas}</table>`}
<h3>Cómo se costeó el envío</h3>
<p>Se toma la zona más cara entre las que ya superaron su umbral de envío gratis, así el margen mínimo
se cumple sin importar a dónde se venda.</p>
<table border="1" cellpadding="6" cellspacing="0" style="font-size:14px">
<tr><th>Zona</th><th>Le cuesta a la tienda</th><th>Gratis desde</th></tr>
${[...cfg.zonas]
  .sort((a, b) => a.gratis_desde - b.gratis_desde)
  .map(z => `<tr><td>${z.nombre}</td><td>${money(z.costo)}</td><td>${money(z.gratis_desde)}</td></tr>`)
  .join('')}
</table>
${!costeo.tarifa_km ? '' : `
<p style="font-size:14px">CABA y AMBA no tienen tarifa plana: se cobra
<b>${money(costeo.tarifa_km.base)} + ${money(costeo.tarifa_km.por_km)} por km</b>,
hasta ${costeo.tarifa_km.radio_max} km. Para poner precio hay que elegir una distancia, porque el precio
se fija antes de saber a dónde va el paquete.</p>
<p style="font-size:14px">Esta corrida costeó a <b>${costeo.km_costeo?.toFixed(1)} km</b>
(${money(cfg.zonas.find(z => z.nombre.startsWith('Cercanía'))?.costo ?? 0)} por envío),
según <b>${costeo.fuente_km}</b>${
  costeo.fuente_km === 'historial de envíos'
    ? ` — percentil 90 de ${costeo.muestras_km} envíos despachados`
    : costeo.fuente_km === 'radio máximo'
      ? `. Hay ${costeo.muestras_km} envío(s) por cercanía registrados y hacen falta ${MUESTRAS_KM_MINIMAS}
         para usar el historial: mientras tanto se cobra el peor caso, que infla el precio de todo lo que
         pasa los ${money(costeo.tarifa_km.gratis_desde)}. Si querés forzar una distancia, seteá
         <code>envio_km_costeo</code> en la configuración`
      : ' (config <code>envio_km_costeo</code>)'
}.</p>`}
${(() => {
  const conflictos = ajustes.filter(a => a.conflicto_ml)
  if (conflictos.length === 0) return ''
  return `
<h3>Publicaciones de Mercado Libre más baratas que el piso de la web</h3>
<p>En estos productos Mercado Libre está por debajo del mínimo que la web necesita para no perder plata,
así que no se pudo aplicar el techo: se dejó el piso. La web cobra 1,49% de comisión y ML cerca del 13%,
o sea que si allá el precio es más bajo que el piso de acá, esa publicación se está vendiendo con muy poco
margen o directamente a pérdida. Conviene mirar la publicación, no el precio de la web.</p>
<table border="1" cellpadding="6" cellspacing="0" style="font-size:14px">
<tr><th>Producto</th><th>Costo c/IVA</th><th>Precio en ML</th><th>Piso de la web</th><th>Diferencia</th></tr>
${conflictos.map(a => `<tr><td>${a.nombre}<br><small style="color:#888">SKU ${a.sku}</small></td>
<td>${money(a.costo_con_iva)}</td><td>${money(a.precio_ml ?? 0)}</td><td><b>${money(a.precio_nuevo)}</b></td>
<td style="color:#c00">${money(a.precio_nuevo - (a.precio_ml ?? 0))}</td></tr>`).join('')}
</table>`
})()}
${sugerencias.length === 0 ? '' : `
<h3>Umbrales que convendría revisar</h3>
<p>Justo por encima de cada umbral hay una zona donde se pierde plata: el producto activa el beneficio
—envío gratis o cuotas— y su costo se lo come, sin que el precio de más alcance a compensarlo.</p>
<table border="1" cellpadding="6" cellspacing="0" style="font-size:14px">
<tr><th>Umbral</th><th>Hoy</th><th>Sugerido</th><th>Productos ahí</th><th>Costo si se vende uno de cada uno</th></tr>
${sugerencias.map(s => `<tr><td>${s.nombre}</td><td>${money(s.umbral_actual)}</td>
<td><b>${money(s.umbral_sugerido)}</b></td><td>${s.productos_afectados}</td>
<td>${money(s.plata_en_juego)}</td></tr>`).join('')}
</table>
<ul>${sugerencias.map(s => `<li>${s.detalle}</li>`).join('')}</ul>
<p style="color:#888">Subir el umbral deja esos productos fuera del beneficio: recupera margen, pero también
saca el gancho comercial. La decisión es tuya.</p>`}`
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
    const [costos, ventas, kms, cfgSitio] = await Promise.all([
      traerCostosDelCrm(),
      ventasWebPorSku(CONFIG_WEB_DEFAULT.dias_ventana_ventas),
      // Ventana larga a propósito: el costeo por distancia necesita volumen,
      // no actualidad, y las tarifas no cambian de una semana a la otra.
      kmDespachados(180),
      getConfig(),
    ])

    // Envíos y cuotas salen de la configuración real de la tienda, así un
    // cambio de tarifa o de mínimo se refleja en los precios sin tocar código.
    // La parte variable (el envío por km) se costea con lo que se despachó de
    // verdad cuando hay historial suficiente, y con el radio máximo si no.
    const sitio = cfgSitio as Record<string, string | undefined>
    const costeo: CosteoEnvio = costeoDesdeConfig(sitio, kms)
    const cfg: ConfigPreciosWeb = {
      ...CONFIG_WEB_DEFAULT,
      zonas: costeo.zonas,
      escalones_cuotas: escalonesDesdeConfig(sitio),
    }
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
          ventas.get(p.sku) ?? 0,
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
        cuerpo: armarMail(ajustes, aCambiar, cfg, costeo, quedanFuera),
      })
    }

    return NextResponse.json({
      revisados: ajustes.length,
      cambiados: aCambiar.length,
      simulacion: dry,
      // Con qué costeo de envío salieron estos precios. Sin esto no hay forma
      // de saber, mirando el resultado, si un precio subió por el costo del
      // producto o por la distancia que se asumió.
      envio: {
        km_costeo: costeo.km_costeo,
        fuente_km: costeo.fuente_km,
        envios_registrados: costeo.muestras_km,
        muestras_necesarias: MUESTRAS_KM_MINIMAS,
        zonas: costeo.zonas.map(z => ({
          zona: z.nombre,
          costo: z.costo,
          gratis_desde: z.gratis_desde,
        })),
      },
      // Productos donde ML quedó por debajo del piso: el techo no se pudo
      // aplicar y hay que decidirlo a mano.
      conflictos_ml: ajustes.filter(a => a.conflicto_ml).map(a => ({
        sku: a.sku,
        ml: a.precio_ml,
        piso_web: a.precio_nuevo,
      })),
      detalle: aCambiar.map(a => ({
        sku: a.sku,
        de: a.precio_actual,
        a: a.precio_nuevo,
        margen: a.margen_nuevo_pct,
        ml: a.precio_ml ?? null,
      })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
