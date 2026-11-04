import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { emitirNotaCreditoC } from '@/lib/afip'
import { generateFacturaPDFBase64, notaCreditoFileName } from '@/lib/factura-pdf'
import {
  sendEmail,
  renderTemplateEstricto,
  DEFAULT_NC_ASUNTO,
  DEFAULT_NC_CUERPO,
} from '@/lib/email'
import { formatPrecio } from '@/lib/format'

/**
 * POST /api/admin/nota-credito
 *
 * Emite la Nota de Crédito C que anula la factura de una orden y se la manda
 * al comprador con el PDF adjunto.
 *
 * Va acá y no en el CRM porque la factura la emitió la tienda: mismo
 * certificado, mismo punto de venta y misma serie. Una NC emitida desde otro
 * lado quedaría en otro punto de venta que el comprobante que anula.
 *
 * No devuelve plata: el reintegro se hace en Mercado Pago. Esto es el papel.
 *
 * Sólo el total: la NC parcial necesita elegir renglones y todavía no existe
 * esa pantalla. Si alguna vez se devuelve un producto de un pedido de varios,
 * esto no sirve y hay que hacerla a mano.
 */

export const runtime = 'nodejs'
export const maxDuration = 60

/** "4/11/2026" → "20261104". AFIP valida la fecha del comprobante asociado. */
function fechaAfip(fecha: string | null | undefined): string | undefined {
  const m = String(fecha ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return undefined
  const [, d, mes, a] = m
  return `${a}${mes.padStart(2, '0')}${d.padStart(2, '0')}`
}

export async function POST(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  let body: { ordenId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const ordenId = String(body.ordenId ?? '').trim()
  if (!ordenId) return NextResponse.json({ error: 'Falta ordenId' }, { status: 400 })

  const { data: orden, error } = await supabaseAdmin
    .from('ordenes')
    .select('id, total, items, datos_comprador, created_at, descuento_monto, codigo_descuento')
    .eq('id', ordenId)
    .single()

  if (error || !orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (orden.datos_comprador as any) ?? {}

  if (!c.factura_cae || !c.factura_nro) {
    return NextResponse.json(
      { error: 'Esta orden no tiene factura emitida: no hay nada que anular.' },
      { status: 400 },
    )
  }

  // Una NC de más es un comprobante fiscal de más: no se repite nunca.
  if (c.nc_cae) {
    return NextResponse.json(
      { error: `Esta orden ya tiene la nota de crédito #${c.nc_nro} (CAE ${c.nc_cae}).` },
      { status: 409 },
    )
  }

  const total = Number(orden.total ?? 0)
  if (!(total > 0)) {
    return NextResponse.json({ error: 'La orden no tiene total.' }, { status: 400 })
  }

  let nc
  try {
    nc = await emitirNotaCreditoC({
      total,
      dni: c.dni || undefined,
      facturaOrigen: {
        nro: Number(c.factura_nro),
        fecha: fechaAfip(c.factura_fecha),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[nota-credito] AFIP rechazó la NC:', err)
    return NextResponse.json({ error: `AFIP: ${message}` }, { status: 502 })
  }

  /**
   * Se guarda apenas AFIP contesta y antes de mandar el mail: el comprobante
   * ya existe en AFIP y perder el CAE acá significaría emitir una segunda NC
   * sobre la misma factura.
   */
  const { error: errGuardar } = await supabaseAdmin
    .from('ordenes')
    .update({
      datos_comprador: {
        ...c,
        nc_cae: nc.cae,
        nc_nro: nc.nroComprobante,
        nc_pv: nc.ptoVenta,
        nc_fecha: nc.fecha,
        nc_vto: nc.caeFechaVto,
        nc_emitida_at: new Date().toISOString(),
      },
    })
    .eq('id', ordenId)

  if (errGuardar) {
    console.error('[nota-credito] NC emitida pero no se pudo guardar:', errGuardar)
  }

  // ─── PDF + mail al comprador ────────────────────────────────────────────
  const dniNumero = String(c.dni ?? '').replace(/\D/g, '')
  const direccionCompleta = [
    c.direccion,
    c.piso ? `Piso ${c.piso}` : '',
    c.departamento ? `Dpto ${c.departamento}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const ncNumero = `${String(nc.ptoVenta).padStart(4, '0')}-${String(nc.nroComprobante).padStart(8, '0')}`
  const facturaNumero = `${String(nc.ptoVenta).padStart(4, '0')}-${String(c.factura_nro).padStart(8, '0')}`

  let emailError: string | null = null
  const email = String(c.email ?? '').trim()

  if (!email) {
    emailError = 'La orden no tiene email del comprador.'
  } else {
    try {
      const pdfBase64 = await generateFacturaPDFBase64({
        tipoComprobante: 'nota_credito',
        nroComprobante: nc.nroComprobante,
        ptoVenta: nc.ptoVenta,
        cuit: Number(process.env.AFIP_CUIT),
        fecha: nc.fecha,
        fechaISO: new Date().toISOString().slice(0, 10),
        caeFechaVto: nc.caeFechaVto,
        cae: nc.cae,
        totalNumerico: total,
        comprobanteAsociado: {
          ptoVenta: nc.ptoVenta,
          nro: Number(c.factura_nro),
          fecha: String(c.factura_fecha ?? ''),
        },
        ...(dniNumero ? { receptor: { tipoDoc: 96, nroDoc: Number(dniNumero) } } : {}),
        cliente: {
          nombre: c.nombre || 'Consumidor Final',
          cuitDni: c.dni || '–',
          direccion: direccionCompleta || '–',
          ciudad: c.ciudad || '–',
          cp: c.codigo_postal || '–',
        },
        items: (
          (orden.items as { nombre: string; cantidad: number; precio: number; sku?: string | null }[]) ?? []
        ).map((i) => ({
          sku: i.sku || undefined,
          descripcion: i.nombre,
          cantidad: i.cantidad,
          precioUnitario: i.precio,
        })),
        costoEnvio: Number(c.envio_costo ?? 0),
        descuentoMonto: Number(orden.descuento_monto ?? 0),
        codigoDescuento: orden.codigo_descuento ?? null,
      })

      const vars: Record<string, string> = {
        nombre: String(c.nombre ?? 'Hola').trim() || 'Hola',
        nc_numero: ncNumero,
        factura_numero: facturaNumero,
        total: formatPrecio(total),
        orden_id: ordenId,
      }

      await sendEmail({
        to: email,
        asunto: renderTemplateEstricto(DEFAULT_NC_ASUNTO, vars, 'nc (asunto)'),
        cuerpo: renderTemplateEstricto(DEFAULT_NC_CUERPO, vars, 'nc'),
        adjuntos: [
          {
            filename: notaCreditoFileName(nc.nroComprobante),
            content: pdfBase64,
            encoding: 'base64',
            contentType: 'application/pdf',
          },
        ],
      })
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[nota-credito] NC emitida pero el mail falló:', err)
    }
  }

  return NextResponse.json({
    ok: true,
    cae: nc.cae,
    numero: ncNumero,
    nroComprobante: nc.nroComprobante,
    total,
    emailEnviado: !emailError,
    emailError,
    guardado: !errGuardar,
  })
}
