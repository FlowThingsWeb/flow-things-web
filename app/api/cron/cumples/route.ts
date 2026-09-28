import { NextRequest, NextResponse } from 'next/server'
import { registrarLatido } from '@/lib/vigilar-crons'
import {
  actualizarUsos, cumpleanerosPendientes, enviarRegaloCumple,
  hoyEnArgentina, pctDeCumple, ultimoDiaDelMes, varianteDelDia,
} from '@/lib/cumples'

export const maxDuration = 60

/**
 * Cron: el regalo de cumpleaños.
 *
 * Corre todos los días y manda el código a quien cumple ESTE MES y todavía no
 * lo recibió este año. Diario y no mensual por dos motivos: quien completa su
 * perfil el día 12 con un cumpleaños de ese mismo mes lo recibe igual, y si un
 * día falla el cron no se pierde el mes entero.
 *
 * Que no se repita no depende de que el cron corra una sola vez: lo garantiza
 * el UNIQUE (user_id, anio) de `cumples_enviados`. Correrlo veinte veces en un
 * día manda lo mismo que correrlo una.
 *
 * Con ?dry=1 dice a quién le mandaría, sin crear ningún código ni mandar nada.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  await registrarLatido('cumples')

  const dry = new URL(request.url).searchParams.get('dry') === '1'
  const { anio, mes, dia } = hoyEnArgentina()
  // Cerca de fin de mes el mail cambia de tono y de porcentaje: al que lo
  // recibe el día 28 le quedan dos días, no se le puede prometer lo mismo que
  // al del día 1. Ver `varianteDelDia`.
  const variante = varianteDelDia(anio, mes, dia)
  const pct = await pctDeCumple(variante)

  let pendientes
  try {
    pendientes = await cumpleanerosPendientes(anio, mes)
  } catch (e) {
    // Sin el registro de lo ya enviado no se manda nada: ver el comentario en
    // `cumpleanerosPendientes`. Se contesta 500 para que el workflow quede en
    // rojo y se vea, en vez de figurar en verde sin haber hecho nada.
    const msg = e instanceof Error ? e.message : 'error desconocido'
    await registrarLatido('cumples', false, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (dry) {
    return NextResponse.json({
      simulacion: true,
      hoy_en_argentina: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      variante,
      descuento_pct: pct,
      vence: ultimoDiaDelMes(anio, mes),
      candidatos: pendientes.length,
      // Sin el email: alcanza el nombre para saber a quién le tocaría, y así
      // el log del cron no queda con direcciones de gente adentro.
      a_quienes: pendientes.map((p) => ({
        nombre: p.nombre,
        cumple: String(p.fecha_nacimiento).slice(5),
      })),
    })
  }

  const enviados: { nombre: string | null; codigo: string }[] = []
  const fallados: { nombre: string | null; error: string }[] = []

  for (const persona of pendientes) {
    const res = await enviarRegaloCumple(persona, pct, anio, mes, variante)
    if (res.ok && res.codigo) enviados.push({ nombre: persona.nombre, codigo: res.codigo })
    else fallados.push({ nombre: persona.nombre, error: res.error ?? 'desconocido' })
  }

  // De paso, marca los regalos de meses anteriores que se terminaron usando.
  const usados = await actualizarUsos()

  return NextResponse.json({
    mes: `${anio}-${String(mes).padStart(2, '0')}`,
    variante,
    descuento_pct: pct,
    vence: ultimoDiaDelMes(anio, mes),
    candidatos: pendientes.length,
    enviados: enviados.length,
    detalle: enviados,
    fallados,
    // Regalos ya mandados que aparecieron usados desde la última corrida.
    marcados_como_usados: usados,
  })
}
