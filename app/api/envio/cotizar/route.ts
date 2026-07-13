import { NextRequest, NextResponse } from 'next/server'
import { calcularEnvio } from '@/lib/envio'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provincia, subtotal = 0, codigo_postal } = body ?? {}

    if (!provincia) {
      return NextResponse.json({ error: 'Provincia requerida' }, { status: 400 })
    }

    const opcion = await calcularEnvio(provincia, subtotal, codigo_postal)
    if (!opcion) {
      return NextResponse.json({ error: 'No se pudo calcular el envío.' }, { status: 500 })
    }

    return NextResponse.json({ opciones: [{ ...opcion, modalidad: 'standard', moneda: 'ARS' }] })
  } catch (err: any) {
    console.error('[cotizar]', err.message)
    return NextResponse.json({ error: 'No se pudo calcular el envío.' }, { status: 500 })
  }
}
