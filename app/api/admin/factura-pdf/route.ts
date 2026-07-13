import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateFacturaPDFBase64, facturaFileName } from '@/lib/factura-pdf'

/**
 * GET /api/admin/factura-pdf?ordenId=xxx
 * Regenera el PDF de la factura de una orden a partir de los datos del CAE
 * guardados en datos_comprador. Solo admin.
 */
export async function GET(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  const ordenId = new URL(request.url).searchParams.get('ordenId')
  if (!ordenId) return NextResponse.json({ error: 'Falta ordenId' }, { status: 400 })

  const { data: orden, error } = await supabaseAdmin
    .from('ordenes')
    .select('total, items, datos_comprador, created_at')
    .eq('id', ordenId)
    .single()

  if (error || !orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  const c = orden.datos_comprador ?? {}
  if (!c.factura_cae || !c.factura_nro) {
    return NextResponse.json({ error: 'Esta orden no tiene factura emitida' }, { status: 404 })
  }

  const direccionCompleta = [
    c.direccion,
    c.piso ? `Piso ${c.piso}` : '',
    c.departamento ? `Dpto ${c.departamento}` : '',
  ].filter(Boolean).join(' ')

  try {
    const pdfBase64 = await generateFacturaPDFBase64({
      nroComprobante: Number(c.factura_nro),
      ptoVenta:       Number(process.env.AFIP_PTO_VENTA || 5),
      cuit:           Number(process.env.AFIP_CUIT),
      fecha:          String(c.factura_fecha || new Date(orden.created_at).toLocaleDateString('es-AR')),
      fechaISO:       String(orden.created_at).slice(0, 10),
      caeFechaVto:    String(c.factura_vto || ''),
      cae:            String(c.factura_cae),
      totalNumerico:  Number(orden.total ?? 0),
      cliente: {
        nombre:    c.nombre    || 'Consumidor Final',
        cuitDni:   c.dni        || '–',
        direccion: direccionCompleta || '–',
        ciudad:    c.ciudad     || '–',
        cp:        c.codigo_postal || '–',
      },
      items: (orden.items as { nombre: string; cantidad: number; precio: number }[]).map((i) => ({
        descripcion:    i.nombre,
        cantidad:       i.cantidad,
        precioUnitario: i.precio,
      })),
      costoEnvio: Number(c.envio_costo ?? 0),
    })

    const buffer = Buffer.from(pdfBase64, 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${facturaFileName(Number(c.factura_nro))}"`,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generando PDF'
    console.error('[factura-pdf]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
