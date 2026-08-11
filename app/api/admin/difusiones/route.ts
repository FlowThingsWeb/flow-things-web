import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'

// GET — lista de difusiones guardadas (más recientes primero)
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const { data, error } = await supabaseAdmin
    .from('difusiones')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — crea una difusión nueva
export async function POST(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const { titulo, asunto, cuerpo } = await req.json()
  if (!titulo?.trim()) return NextResponse.json({ error: 'Falta el título' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('difusiones')
    .insert({ titulo: titulo.trim(), asunto: (asunto ?? '').trim(), cuerpo: cuerpo ?? '' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
