import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, renderTemplate } from '@/lib/email'

// Datos de ejemplo para el email de prueba
const SAMPLE_VARS: Record<string, string> = {
  nombre: 'María García',
  orden_id: '12345',
  total: '$ 8.500,00',
  fecha: new Date().toLocaleDateString('es-AR'),
  productos: '• Muñeca articulada premium x1<br/>• LEGO City Set 60303 x2<br/>• Puzzle madera 100 piezas x1',
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { email?: string; asunto?: string; cuerpo?: string } = {}
  try { body = await req.json() } catch { /* empty body */ }

  const { email, asunto, cuerpo } = body

  if (!email) return NextResponse.json({ error: 'Falta el campo email' }, { status: 400 })
  if (!asunto || !cuerpo) return NextResponse.json({ error: 'Faltan asunto o cuerpo' }, { status: 400 })

  try {
    const cuerpoRendered = renderTemplate(cuerpo, SAMPLE_VARS)
    const asuntoRendered = renderTemplate(asunto, SAMPLE_VARS)

    await sendEmail({ to: email, asunto: asuntoRendered, cuerpo: cuerpoRendered })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[mailing-test]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
