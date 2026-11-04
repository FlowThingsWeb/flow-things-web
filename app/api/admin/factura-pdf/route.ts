import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateFacturaPDFBase64, facturaFileName, notaCreditoFileName } from '@/lib/factura-pdf'

/**
 * GET /api/admin/factura-pdf?ordenId=xxx
 * Regenera el PDF de la factura de una orden a partir de los datos del CAE
 * guardados en datos_comprador. Solo admin.
 */
export async function GET(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  const params = new URL(request.url).searchParams
  const ordenId = params.get('ordenId')
  if (!ordenId) return NextResponse.json({ error: 'Falta ordenId' }, { status: 400 })
  // ?tipo=nc devuelve la nota de crédito en vez de la factura. Mismo layout,
  // mismos datos de la orden: lo único que cambia es el comprobante.
  const esNc = params.get('tipo') === 'nc'

  const { data: orden, error } = await supabaseAdmin
    .from('ordenes')
    .select('total, items, datos_comprador, created_at, descuento_monto, codigo_descuento')
    .eq('id', ordenId)
    .single()

  if (error || !orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  const c = orden.datos_comprador ?? {}
  if (!c.factura_cae || !c.factura_nro) {
    return NextResponse.json({ error: 'Esta orden no tiene factura emitida' }, { status: 404 })
  }
  if (esNc && !c.nc_cae) {
    return NextResponse.json({ error: 'Esta orden no tiene nota de crédito emitida' }, { status: 404 })
  }

  const ptoVenta = Number(process.env.AFIP_PTO_VENTA || 5)
  const dniNumero = String(c.dni ?? '').replace(/\D/g, '')

  const direccionCompleta = [
    c.direccion,
    c.piso ? `Piso ${c.piso}` : '',
    c.departamento ? `Dpto ${c.departamento}` : '',
  ].filter(Boolean).join(' ')

  try {
    const pdfBase64 = await generateFacturaPDFBase64({
      tipoComprobante: esNc ? 'nota_credito' : 'factura',
      nroComprobante: Number(esNc ? c.nc_nro : c.factura_nro),
      ptoVenta:       Number((esNc ? c.nc_pv : null) ?? ptoVenta),
      cuit:           Number(process.env.AFIP_CUIT),
      fecha:          String((esNc ? c.nc_fecha : c.factura_fecha) || new Date(orden.created_at).toLocaleDateString('es-AR')),
      fechaISO:       String(orden.created_at).slice(0, 10),
      caeFechaVto:    String((esNc ? c.nc_vto : c.factura_vto) || ''),
      cae:            String(esNc ? c.nc_cae : c.factura_cae),
      totalNumerico:  Number(orden.total ?? 0),
      ...(esNc
        ? {
            comprobanteAsociado: {
              ptoVenta,
              nro: Number(c.factura_nro),
              fecha: String(c.factura_fecha ?? ''),
            },
          }
        : {}),
      ...(esNc && dniNumero ? { receptor: { tipoDoc: 96, nroDoc: Number(dniNumero) } } : {}),
      cliente: {
        nombre:    c.nombre    || 'Consumidor Final',
        cuitDni:   c.dni        || '–',
        direccion: direccionCompleta || '–',
        ciudad:    c.ciudad     || '–',
        cp:        c.codigo_postal || '–',
      },
      items: (orden.items as { nombre: string; cantidad: number; precio: number; sku?: string | null }[]).map((i) => ({
        sku:            i.sku || undefined,
        descripcion:    i.nombre,
        cantidad:       i.cantidad,
        precioUnitario: i.precio,
      })),
      costoEnvio: Number(c.envio_costo ?? 0),
      descuentoMonto: Number(orden.descuento_monto ?? 0),
      codigoDescuento: orden.codigo_descuento ?? null,
    })

    const buffer = Buffer.from(pdfBase64, 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${
          esNc ? notaCreditoFileName(Number(c.nc_nro)) : facturaFileName(Number(c.factura_nro))
        }"`,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generando PDF'
    console.error('[factura-pdf]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
