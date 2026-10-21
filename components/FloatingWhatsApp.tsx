'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Botón flotante de WhatsApp, fijo en toda la web pública.
 *
 * Estaba siempre puesto en la esquina, y una esquina fija tapa lo que haya
 * ahí: en el teléfono se comía el "137 productos" de la ficha de Juguetería y
 * el "15 productos" del mosaico de Style 4 Ever. Un botón de consulta no
 * puede costar un dato de venta.
 *
 * Ahora:
 *
 *   - No aparece hasta pasada la primera pantalla. Arriba de todo está el
 *     banner, y ahí nadie quiere preguntar nada todavía.
 *   - Se esconde mientras la persona baja: si está recorriendo, está mirando
 *     mercadería, y el botón no tiene por qué estar encima.
 *   - Vuelve ni bien sube o deja de desplazar. Subir suele ser buscar algo que
 *     se pasó, y frenar es haberse detenido en algo: los dos momentos en que
 *     una consulta tiene sentido.
 *
 * Mientras está escondido queda `pointer-events-none`, así tampoco intercepta
 * toques sobre lo que esté debajo.
 */

/** Cuánto hay que bajar para que el botón exista. Una pantalla de teléfono. */
const ALTO_MINIMO = 700
/** Desplazamiento mínimo para considerar que cambió de dirección. Evita que
 *  el rebote del scroll en iOS lo haga parpadear. */
const UMBRAL = 12
/** Cuánto esperar quieto antes de que vuelva. */
const MS_QUIETO = 500

export default function FloatingWhatsApp({ telefono }: { telefono?: string }) {
  const num = (telefono || '').replace(/\D/g, '')
  const [visible, setVisible] = useState(false)
  const ultimaY = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!num) return

    /*
      Listener de scroll pasivo, no una animación por frame: sólo compara la
      posición con la anterior y toca el estado cuando el booleano cambia de
      verdad. Son dos o tres renders por recorrido, no uno por cuadro.
    */
    const alDesplazar = () => {
      const y = window.scrollY
      const dy = y - ultimaY.current

      if (Math.abs(dy) > UMBRAL) {
        setVisible(y > ALTO_MINIMO && dy < 0)
        ultimaY.current = y
      }

      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        setVisible(window.scrollY > ALTO_MINIMO)
      }, MS_QUIETO)
    }

    ultimaY.current = window.scrollY
    alDesplazar()
    window.addEventListener('scroll', alDesplazar, { passive: true })
    return () => {
      window.removeEventListener('scroll', alDesplazar)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [num])

  if (!num) return null

  const href = `https://wa.me/${num}?text=${encodeURIComponent('Hola! Quería hacer una consulta.')}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultar por WhatsApp"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-green-500 shadow-lg ring-1 ring-black/10 transition-all duration-300 hover:bg-green-400 sm:h-14 sm:w-14 ${
        visible
          ? 'translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-4 scale-90 opacity-0'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white sm:h-7 sm:w-7">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </a>
  )
}
