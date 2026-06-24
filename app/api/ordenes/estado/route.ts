import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * GET /api/ordenes/estado?id=xxx
 * Endpoint público mínimo — solo devuelve el estado de una orden.
 * No expone datos del comprador ni del pago.
 */
export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('ordenes')
    .select('estado')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  return NextResponse.json({ estado: data.estado })
}
