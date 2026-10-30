import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getConfig } from '@/lib/config'
import { estadoCyber } from '@/lib/cyber'
import { sendTelegram } from '@/lib/telegram'

/**
 * Avisa por Telegram, al mediodía, que la promo está activa.
 *
 * La promo sale sola a las 00:00 y nadie la prende, así que nadie se entera
 * de que salió. Y lo que arranca solo puede no arrancar —una fecha mal
 * escrita, el interruptor que quedó apagado—.
 *
 * A las 12 y no a las 00:00 porque un mensaje a medianoche no lo lee nadie:
 * queda arriba de todo en el teléfono hasta la mañana y para entonces ya pasó
 * de ser una novedad a ser una notificación vieja. Al mediodía todavía queda
 * media jornada de venta para hacer algo si algo salió mal.
 *
 * El aviso dice además cuántos productos quedaron rebajados. Ese número es la
 * segunda forma de que la promo salga mal: el interruptor prendido y los
 * precios sin aplicar, que desde afuera se ve como una tienda con un cartel
 * de ofertas y ninguna oferta.
 *
 * Es el único aviso: una vez por promo. Se marca ANTES de mandar, no después,
 * porque un error de Telegram que dejara la marca sin escribir convertiría
 * esto en un mensaje cada cinco minutos para siempre. Perder el aviso es
 * molesto; que el canal quede inutilizable, peor.
 */

const CLAVE = 'cyber_avisado'

/**
 * Desde qué hora de Buenos Aires se avisa.
 *
 * Es "a partir de" y no "a las 12 en punto": si fuera una ventana cerrada y
 * el cron no corriera entre las 12:00 y las 12:59 —un deploy, GitHub lento—
 * el aviso no saldría nunca y el silencio se leería como "la promo anda
 * bien".
 */
const HORA_AVISO = 12

function horaEnBuenosAires(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(d),
  )
}

export async function avisarCyberArrancado(): Promise<{ avisado: boolean; motivo?: string }> {
  const cfg = await getConfig()
  const estado = estadoCyber(cfg)

  if (!estado.activo) return { avisado: false, motivo: 'apagada' }
  if (horaEnBuenosAires(new Date()) < HORA_AVISO) {
    return { avisado: false, motivo: 'todavía no son las 12' }
  }

  // Qué promo es ésta. Con la fecha adentro, la del año que viene vuelve a
  // avisar sin que haya que limpiar nada a mano.
  const marca = estado.desde ?? 'sin-fecha'
  if (cfg[CLAVE] === marca) return { avisado: false, motivo: 'ya avisado' }

  await supabaseAdmin
    .from('configuracion')
    .upsert({ clave: CLAVE, valor: marca }, { onConflict: 'clave' })
  revalidateTag('site-config')

  const { count } = await supabaseAdmin
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true)
    .not('precio_anterior', 'is', null)
    .gt('stock', 0)

  const rebajados = count ?? 0
  const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.flowthings.com.ar').replace(/\/$/, '')

  await sendTelegram(
    `⚡ <b>Las ofertas del Cyber están activas.</b>\n\n` +
      (rebajados > 0
        ? `${rebajados} producto(s) con precio rebajado.`
        : `⚠️ <b>Ningún producto tiene precio rebajado.</b> La promo está prendida pero la tienda no muestra ofertas: falta aplicar el descuento en /admin/cyber/precios.`) +
      `\n\n<a href="${url}/cyber">Ver la página</a>`,
  )

  return { avisado: true }
}
