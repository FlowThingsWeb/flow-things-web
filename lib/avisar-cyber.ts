import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getConfig } from '@/lib/config'
import { estadoCyber } from '@/lib/cyber'
import { sendTelegram } from '@/lib/telegram'

/**
 * Avisa por Telegram cuando la promo arranca.
 *
 * La promo se programa y sale sola a las 00:00: nadie la prende, así que
 * nadie se entera de que salió. Y lo que arranca solo puede no arrancar —una
 * fecha mal escrita, el interruptor que quedó en apagado— y eso se descubre
 * a las once de la mañana, cuando ya se perdieron once horas del mejor día.
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

export async function avisarCyberArrancado(): Promise<{ avisado: boolean; motivo?: string }> {
  const cfg = await getConfig()
  const estado = estadoCyber(cfg)

  if (!estado.activo) return { avisado: false, motivo: 'apagada' }

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
    `⚡ <b>${estado.titulo}</b> arrancó en la tienda.\n\n` +
      (rebajados > 0
        ? `${rebajados} producto(s) con precio rebajado.`
        : `⚠️ <b>Ningún producto tiene precio rebajado.</b> La promo está prendida pero la tienda no muestra ofertas: falta aplicar el descuento en /admin/cyber/precios.`) +
      `\n\n<a href="${url}/cyber">Ver la página</a>`,
  )

  return { avisado: true }
}
