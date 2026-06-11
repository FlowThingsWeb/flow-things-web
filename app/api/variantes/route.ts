import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET /api/variantes?producto_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const producto_id = searchParams.get('producto_id')

  if (!producto_id) {
    return NextResponse.json({ error: 'producto_id requerido' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('variantes')
    .select('*')
    .eq('producto_id', producto_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variantes: data || [] })
}

// POST /api/variantes — crear
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { producto_id, atributos, sku, stock, imagen_url } = body

  if (!producto_id || !atributos) {
    return NextResponse.json({ error: 'producto_id y atributos son requeridos' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('variantes')
    .insert([{ producto_id, atributos, sku: sku || null, stock: stock ?? 0, imagen_url: imagen_url || null }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ variante: data }, { status: 201 })
}

// PUT /api/variantes — actualizar
export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('variantes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ variante: data })
}

// DELETE /api/variantes?id=xxx
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabaseAdmin.from('variantes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
