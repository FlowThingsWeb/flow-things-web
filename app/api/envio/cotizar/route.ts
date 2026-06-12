import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'

// Provincias que pertenecen a GBA / Buenos Aires provincia
const PROVINCIAS_GBA = ['Buenos Aires']
const PROVINCIAS_CABA = ['CABA']

function getZona(provincia: string): 'caba' | 'gba' | 'interior' {
  if (PROVINCIAS_CABA.includes(provincia)) return 'caba'
  if (PROVINCIAS_GBA.includes(provincia)) return 'gba'
  return 'interior'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provincia, subtotal = 0 } = body ?? {}

    if (!provincia) {
      return NextResponse.json({ error: 'Provincia requerida' }, { status: 400 })
    }

    const cfg = await getConfig()
    const zona = getZona(provincia)

    const precios = {
      caba: {
        precio: Number(cfg.envio_precio_caba) || 2500,
        gratis_desde: Number(cfg.envio_gratis_caba_desde) || 40000,
        tiempo: cfg.envio_tiempo_caba || '24-48 hs hábiles',
        nombre: 'Envío a CABA',
        id: 'caba',
      },
      gba: {
        precio: Number(cfg.envio_precio_gba) || 3500,
        gratis_desde: Number(cfg.envio_gratis_gba_desde) || 60000,
        tiempo: cfg.envio_tiempo_gba || '48-72 hs hábiles',
        nombre: 'Envío GBA / Provincia de Buenos Aires',
        id: 'gba',
      },
      interior: {
        precio: Number(cfg.envio_precio_interior) || 6000,
        gratis_desde: Number(cfg.envio_gratis_interior_desde) || 120000,
        tiempo: cfg.envio_tiempo_interior || '3-7 días hábiles',
        nombre: 'Envío al interior del país',
        id: 'interior',
      },
    }

    const opcion = precios[zona]
    const esGratis = subtotal > 0 && subtotal >= opcion.gratis_desde
    const precioFinal = esGratis ? 0 : opcion.precio

    return NextResponse.json({
      opciones: [
        {
          id: opcion.id,
          nombre: opcion.nombre,
          modalidad: 'standard',
          precio: precioFinal,
          moneda: 'ARS',
          descripcion: esGratis ? '¡Envío gratis por superar el mínimo!' : null,
          tiempo_estimado: opcion.tiempo,
        },
      ],
    })
  } catch (err: any) {
    console.error('[cotizar]', err.message)
    return NextResponse.json(
      { error: 'No se pudo calcular el envío.' },
      { status: 500 }
    )
  }
}
