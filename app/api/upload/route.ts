import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    // Validar tipo. La extensión se deriva del MIME validado, no del nombre
    // del archivo del cliente (que podría inyectar strings arbitrarios en el path).
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    const ext = mimeToExt[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Solo JPG, PNG, WebP o GIF.' },
        { status: 400 }
      )
    }

    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'El archivo no puede superar 5MB' },
        { status: 400 }
      )
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `productos/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error } = await supabaseAdmin.storage
      .from('productos')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('productos')
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl, path })
  } catch {
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 })
  }
}
