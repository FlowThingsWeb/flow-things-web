import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET /api/productos — Lista todos los productos (público)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const categoria = searchParams.get('categoria')
  const destacados = searchParams.get('destacados')
  const limit = parseInt(searchParams.get('limit') || '50')
  const page = parseInt(searchParams.get('page') || '1')
  const offset = (page - 1) * limit

  // Con categoría: !inner excluye productos cuya categoría no coincide (INNER JOIN).
  // Sin categoría: left join para traer todos los productos con o sin categoría.
  const selectStr = categoria
    ? '*, categorias!inner(id, nombre, slug)'
    : '*, categorias(id, nombre, slug)'

  let query = supabaseAdmin
    .from('productos')
    .select(selectStr, { count: 'exact' })
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (categoria) {
    query = query.eq('categorias.slug', categoria)
  }

  if (destacados === 'true') {
    query = query.eq('destacado', true)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ productos: data, total: count })
}

// POST /api/productos — Crear nuevo producto (admin)
export async function POST(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth
  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('productos')
      .insert([body])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ producto: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// PUT /api/productos — Actualizar producto (admin)
export async function PUT(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('productos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ producto: data })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// DELETE /api/productos?id=xxx — Eliminar producto (admin)
export async function DELETE(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  // Borrado real. Las variantes y favoritos tienen FK ON DELETE CASCADE, así que
  // se eliminan solos. El historial de órdenes guarda los items como snapshot JSON
  // (sin FK), por lo que no se ve afectado.
  const { error } = await supabaseAdmin
    .from('productos')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
