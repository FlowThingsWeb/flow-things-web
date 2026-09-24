'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

function fmt(n: number) {
  return n.toLocaleString('es-AR')
}

/**
 * La barra de arriba de todo: envío gratis, cuotas y el 10% del registro.
 *
 * Antes decía tres umbrales distintos —CABA, AMBA e interior— porque la tienda
 * cobraba tres tarifas. Ahora es un solo monto para todo el país.
 *
 * Y antes eran DOS barras, una arriba de la otra: ésta y la del registro. En
 * un teléfono de 812px de alto las dos juntas se comían 130px —más del 15% de
 * la pantalla— antes de que apareciera el logo, y el mensaje del 10% además lo
 * repetía el popup encima de todo. El visitante de Instagram veía tres veces
 * la misma oferta y ningún producto.
 *
 * Ahora es una sola línea. En pantalla chica queda el beneficio que decide una
 * compra —envío y cuotas—, en el texto más corto que entra sin cortarse; el
 * registro aparece a partir de `sm`, donde sobra lugar. En un teléfono la
 * oferta del 10% sigue llegando por el popup, que ahora espera a que el
 * visitante muestre interés.
 *
 * No dice cuánto sale el envío por debajo del umbral a propósito: acá el
 * mensaje es el beneficio, y el costo lo muestra el checkout cuando el
 * comprador pone su dirección, que es cuando el número es real.
 */
export default function AnnouncementBar({
  gratisDesde = 61000,
  cuotas = 3,
}: {
  /** Monto desde el que el envío es gratis. */
  gratisDesde?: number
  /** Cuotas sin interés vigentes. */
  cuotas?: number
}) {
  const { user, loading } = useAuth()
  const ofrecerRegistro = !loading && !user

  return (
    <div className="w-full bg-brand-purple text-white text-xs font-medium py-2 px-4">
      <div className="flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden">
        {gratisDesde > 0 && (
          <span>
            🚚 <span className="font-bold">Envío gratis</span>
            <span className="hidden sm:inline"> a todo el país</span> desde ${fmt(gratisDesde)}
          </span>
        )}

        {cuotas > 0 && (
          <span>
            <span className="text-white/50">·</span> 💳 <span className="font-bold">{cuotas} cuotas</span>
            <span className="hidden sm:inline"> sin interés</span>
          </span>
        )}

        {/* El registro sólo donde entra sin empujar lo de arriba a dos líneas. */}
        {ofrecerRegistro && (
          <span className="hidden sm:inline-flex items-center gap-2">
            <span className="text-white/50">·</span>
            🎁 <span className="font-bold">10% OFF</span> en tu primera compra
            <Link
              href="/cuenta/registro"
              className="bg-white text-brand-purple text-[11px] font-bold px-3 py-0.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              Registrarme
            </Link>
          </span>
        )}
      </div>
    </div>
  )
}
