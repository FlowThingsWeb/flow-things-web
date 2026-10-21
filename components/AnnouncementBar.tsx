'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

function fmt(n: number) {
  return n.toLocaleString('es-AR')
}

/**
 * La barra de beneficios. Aparece cuando el banner ya NO está a la vista.
 *
 * Antes estaba siempre, arriba de todo. El problema no era el mensaje sino
 * decirlo dos veces en la misma pantalla: el banner de la home ya lleva
 * "3 cuotas sin interés · Envío gratis desde $61.000" debajo del botón, y la
 * barra lo repetía 400px más arriba. Dos veces lo mismo no refuerza, gasta.
 *
 * Ahora se turnan. Mientras el banner se ve, el mensaje lo da el banner; en
 * cuanto sale de la pantalla, entra la barra y lo sigue dando mientras el
 * visitante recorre el catálogo, que es cuando empieza a comparar precios y
 * el envío gratis pesa.
 *
 * En las páginas donde no hay banner —categoría, producto, carrito— se
 * muestra desde el principio: si no encuentra el `#banner-home`, no hay nada
 * con qué turnarse.
 *
 * El mínimo de 24 hs dice CABA y no AMBA a propósito. El cotizador le da 24
 * horas a todo lo que entra por kilómetros, que incluye parte del conurbano
 * —Martínez está a 14,7 km—, pero prometerle el día a "GBA" abarca Pilar y
 * Berazategui, que quedan fuera del radio y salen por correo. Se promete lo
 * que se cumple siempre.
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
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const banner = document.getElementById('banner-home')

    // Sin banner en esta página, la barra va siempre.
    if (!banner) {
      setVisible(true)
      return
    }

    /**
     * Se mira el banner, no la posición del scroll. Medir píxeles obliga a
     * saber cuánto mide el banner, que cambia con el ancho de la pantalla y
     * entre escritorio y teléfono; el observador se entera solo.
     */
    const obs = new IntersectionObserver(
      ([e]) => setVisible(!e.isIntersecting),
      { threshold: 0 },
    )
    obs.observe(banner)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      aria-hidden={!visible}
      className={`w-full overflow-hidden bg-brand-purple text-white transition-[max-height,opacity] duration-300 ${
        visible ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap px-4 py-2 text-xs font-medium">
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

        {/* Lo que de verdad no dice nadie más en el rubro. */}
        <span className="hidden md:inline">
          <span className="text-white/50">·</span> ⚡ <span className="font-bold">CABA en 24 hs</span>
        </span>

        {/* El registro sólo donde entra sin empujar lo de arriba a dos líneas. */}
        {ofrecerRegistro && (
          <span className="hidden lg:inline-flex items-center gap-2">
            <span className="text-white/50">·</span>
            🎁 <span className="font-bold">10% OFF</span> en tu primera compra
            <Link
              href="/cuenta/registro"
              className="rounded-full bg-white px-3 py-0.5 text-[11px] font-bold text-brand-purple transition-colors hover:bg-gray-100"
            >
              Registrarme
            </Link>
          </span>
        )}
      </div>
    </div>
  )
}
