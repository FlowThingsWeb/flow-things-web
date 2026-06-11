import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET — devuelve toda la configuración
export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('configuracion')
    .select('*')
    .order('seccion')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PUT — actualiza un campo de texto
export async function PUT(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
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
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
