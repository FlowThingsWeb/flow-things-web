import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminToken } from '@/lib/admin-auth'

// PUT — actualiza título / asunto / cuerpo de una difusión
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth
  const { id } = await params

  const { titulo, asunto, cuerpo, enviada_at, destinatarios_count } = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (titulo !== undefined) patch.titulo = String(titulo).trim()
  if (asunto !== undefined) patch.asunto = String(asunto).trim()
  if (cuerpo !== undefined) patch.cuerpo = String(cuerpo)
  if (enviada_at !== undefined) patch.enviada_at = enviada_at
  if (destinatarios_count !== undefined) patch.destinatarios_count = destinatarios_count

  const { data, error } = await supabaseAdmin
    .from('difusiones')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE — elimina una difusión
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth
  const { id } = await params

  const { error } = await supabaseAdmin.from('difusiones').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
