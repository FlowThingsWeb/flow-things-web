import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generarYSubirDerivadas } from '@/lib/imagen-derivadas'

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

    const base = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Los GIF pueden ser animados: sharp se quedaría con el primer cuadro, así
    // que van tal cual. El loader deja pasar sin tocar todo lo que no sea una
    // derivada, así que siguen mostrándose bien.
    if (ext === 'gif') {
      const path = `productos/${base}.gif`
      const { error } = await supabaseAdmin.storage
        .from('productos')
        .upload(path, buffer, { contentType: file.type, upsert: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const { data: { publicUrl: urlGif } } = supabaseAdmin.storage
        .from('productos')
        .getPublicUrl(path)

      return NextResponse.json({ url: urlGif, path })
    }

    // El resto se guarda solo como derivadas (200/640/1280 en webp). No
    // guardamos el original: el cliente ya lo comprime a 1600px antes de
    // subirlo y el master de 1280 cubre hasta el lightbox.
    const { url: publicUrl, paths } = await generarYSubirDerivadas(buffer, base)

    return NextResponse.json({ url: publicUrl, paths })
  } catch {
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 })
  }
}
