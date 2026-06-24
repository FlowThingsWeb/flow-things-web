import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  try {
    const { codigo, subtotal } = await request.json()

    if (!codigo || typeof codigo !== 'string') {
      return NextResponse.json({ valido: false, mensaje: 'Código inválido' }, { status: 400 })
    }

    // Búsqueda exacta (case-sensitive) por código
    const { data, error } = await supabaseAdmin
      .from('codigos_descuento')
      .select('*')
      .eq('codigo', codigo.trim())
      .single()

    if (error || !data) {
      return NextResponse.json({
        valido: false,
        mensaje: 'No existe un código de descuento así.',
      })
    }

    // Verificar que esté activo
    if (!data.activo) {
      return NextResponse.json({
        valido: false,
        mensaje: 'Este código de descuento no está activo.',
      })
    }

    // Verificar usos máximos
    if (data.usos_maximos !== null && data.usos_actuales >= data.usos_maximos) {
      return NextResponse.json({
        valido: false,
        mensaje: 'Este código ya alcanzó su límite de usos.',
      })
    }

    // Verificar vencimiento
    if (data.fecha_vencimiento) {
      const vencimiento = new Date(data.fecha_vencimiento)
      vencimiento.setHours(23, 59, 59, 999)
      if (vencimiento < new Date()) {
        return NextResponse.json({
          valido: false,
          mensaje: 'Este código de descuento ya venció.',
        })
      }
    }

    // Calcular monto de descuento
    const sub = subtotal || 0
    let descuento_monto = 0

    if (data.tipo === 'porcentaje') {
      descuento_monto = Math.round((sub * data.valor) / 100)
    } else {
      // monto_fijo
      descuento_monto = Math.min(data.valor, sub)
    }

    return NextResponse.json({
      valido: true,
      codigo: data.codigo,
      tipo: data.tipo,
      valor: data.valor,
      descuento_monto,
      descripcion: data.descripcion || null,
      mensaje:
        data.tipo === 'porcentaje'
          ? `¡Código aplicado! ${data.valor}% de descuento`
          : `¡Código aplicado! $${descuento_monto.toLocaleString('es-AR')} de descuento`,
    })
  } catch (err) {
    console.error('[descuentos/validar] error:', err)
    return NextResponse.json({ valido: false, mensaje: 'Error al validar el código' }, { status: 500 })
  }
}
