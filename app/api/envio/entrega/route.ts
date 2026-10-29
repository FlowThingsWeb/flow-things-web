import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'
import { entregaCadeteria, parsearFeriados } from '@/lib/zonas-cadeteria'

/**
 * GET /api/envio/entrega
 *
 * Cuándo llega un pedido hecho ahora mismo, sin que el comprador cargue nada.
 *
 * Existe porque la ficha de producto se cachea 5 minutos (`revalidate = 300`).
 * Si el día de entrega se renderizara en el servidor junto con la página, un
 * HTML generado a las 12:58 seguiría diciendo "Llega hoy" a las 13:02, que es
 * exactamente el minuto en que deja de ser verdad. Esto se pide aparte y sin
 * caché, así que la promesa es siempre la de este segundo.
 *
 * No dice a qué zona cae la dirección —para eso está /api/envio/cotizar, que
 * necesita el código postal—. Dice el día, que es lo único que se puede
 * prometer sin saber dónde vive el que mira.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const cfg = await getConfig()

  // Apagado el servicio, no hay nada que prometer. El componente no dibuja
  // nada: es preferible no decir nada a decir "Llega hoy" y no llegar.
  if (cfg.envio_cadeteria_activo !== '1') {
    return NextResponse.json({ activo: false }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const entrega = entregaCadeteria({
    feriados: parsearFeriados(cfg.envio_cadeteria_feriados),
  })

  return NextResponse.json(
    {
      activo: true,
      hoy: entrega.hoy,
      etiqueta: entrega.etiqueta,
      fecha: entrega.fecha,
      cobertura: 'CABA y alrededores',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
