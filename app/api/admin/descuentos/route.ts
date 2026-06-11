import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET — listar todos los códigos
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('codigos_descuento')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST — crear nuevo código
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { codigo, descripcion, tipo, valor, usos_maximos, fecha_vencimiento } = body

    if (!codigo || !tipo || !valor) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('codigos_descuento')
      .insert([{
        codigo: codigo.trim().toUpperCase(),
        descripcion: descripcion || null,
        tipo,
        valor: parseFloat(valor),
        usos_maximos: usos_maximos ? parseInt(usos_maximos) : null,
        fecha_vencimiento: fecha_vencimiento || null,
        activo: true,
      }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un código con ese nombre' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Error al crear el código' }, { status: 500 })
  }
}

// PATCH — toggle activo/inactivo
export async function PATCH(request: NextRequest) {
  const { id, activo } = await request.json()

  const { error } = await supabaseAdmin
    .from('codigos_descuento')
    .update({ activo })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — eliminar código
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('codigos_descuento')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
