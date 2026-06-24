import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET — devuelve toda la configuración
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const { data, error } = await supabaseAdmin
    .from('configuracion')
    .select('*')
    .order('seccion')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PUT — actualiza uno o varios campos de configuración
// Acepta { clave, valor } para un solo campo
// o { updates: { clave1: valor1, clave2: valor2, ... } } para múltiples
export async function PUT(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const body = await req.json()

  // Batch update
  if (body.updates && typeof body.updates === 'object') {
    const rows = Object.entries(body.updates).map(([clave, valor]) => ({ clave, valor }))
    if (rows.length === 0) return NextResponse.json({ ok: true })

    const { error } = await supabaseAdmin
      .from('configuracion')
      .upsert(rows, { onConflict: 'clave' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Single update (retrocompatible)
  const { clave, valor } = body
  if (!clave) return NextResponse.json({ error: 'Falta clave' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('configuracion')
    .upsert({ clave, valor }, { onConflict: 'clave' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST — sube imagen y actualiza la clave
export async function POST(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const formData = await req.formData()
  const file = formData.get('file') as Blob | null
  const clave = formData.get('clave') as string

  if (!file || !clave) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const ext = (file as File).name?.split('.').pop() || 'png'
  const path = `config/${clave}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('productos')
    .upload(path, file, { upsert: true, contentType: (file as File).type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin.storage
    .from('productos')
    .getPublicUrl(path)

  const publicUrl = urlData.publicUrl

  const { error: dbError } = await supabaseAdmin
    .from('configuracion')
    .upsert({ clave, valor: publicUrl }, { onConflict: 'clave' })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true, url: publicUrl })
}
