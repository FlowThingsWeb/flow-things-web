'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const STORAGE_KEY = 'ft_popup_dismissed'
/** Días que el popup queda oculto después de cerrarlo. */
const DIAS_OCULTO = 7
const MS_OCULTO = DIAS_OCULTO * 24 * 60 * 60 * 1000

/**
 * El popup aparecía a los 2 segundos de cargar la página.
 *
 * Con eso, el visitante que llega de Instagram —el 29% de las visitas— toca
 * un link, espera a que cargue, y lo primero que ve es un formulario tapando
 * la pantalla entera antes que un solo producto. En Clarity, el 39,5% de las
 * sesiones son "retrocesos rápidos": entran y vuelven atrás enseguida.
 *
 * Ahora espera a que el visitante muestre interés. Se pide una de tres cosas,
 * la que pase primero, y nunca antes de los 8 segundos:
 *
 *   - recorrió la mitad de la página,
 *   - lleva 25 segundos adentro,
 *   - o el mouse se va hacia arriba, camino a cerrar la pestaña (sólo
 *     escritorio: en un teléfono no existe esa señal).
 *
 * La oferta es la misma; cambia cuándo se ofrece. A alguien que ya recorrió
 * medio catálogo un 10% le interesa. A alguien que todavía no vio nada, no.
 */
const MS_MINIMO = 8_000
const MS_MAXIMO = 25_000
/**
 * Cuánto hay que recorrer para que cuente como "la miró".
 *
 * La mitad de la página, pero con un tope de dos pantallas: el home mide
 * 6.600px en un teléfono, y pedir la mitad serían 3.300px de scroll, más de lo
 * que recorre el visitante promedio (54,8% según Clarity, y ése es el
 * promedio de todas las páginas, no del home). Con el tope, en una página
 * larga alcanza con pasar el hero y la primera fila de productos.
 */
const SCROLL_INTERES = 0.5
const SCROLL_TOPE_PANTALLAS = 2

/**
 * Dónde no interrumpir: el visitante ya está comprando.
 *
 * Un modal encima del carrito o del checkout no gana un registro, pierde una
 * venta — y son justo las pantallas donde menos gente llega.
 */
const RUTAS_SILENCIO = ['/carrito', '/checkout', '/confirmar', '/exito', '/cuenta']

/**
 * ¿Sigue vigente el "no me lo muestres" del visitante?
 * Guardamos el timestamp del descarte en vez de un flag permanente: si
 * alguien lo cierra sin prestar atención, vuelve a verlo a los 7 días en
 * lugar de perderlo para siempre.
 * Los valores viejos (se guardaba un '1') quedan vencidos y el popup se
 * vuelve a mostrar una vez, que es el comportamiento deseado.
 */
function descarteVigente(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return false
  const ts = Number(raw)
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts < MS_OCULTO
}

export default function RegistrationPopup() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  /** Pasaron los 8 segundos de gracia: ya se puede mostrar. */
  const listo = useRef(false)

  const enSilencio = RUTAS_SILENCIO.some(r => pathname.startsWith(r))

  useEffect(() => {
    if (loading || user || enSilencio) return
    if (descarteVigente()) return

    let vivo = true
    const mostrar = () => {
      if (!vivo || !listo.current) return
      vivo = false
      setVisible(true)
    }

    const gracia = setTimeout(() => { listo.current = true }, MS_MINIMO)
    const limite = setTimeout(() => { listo.current = true; mostrar() }, MS_MAXIMO)

    const alScrollear = () => {
      const alto = document.documentElement.scrollHeight - window.innerHeight
      if (alto <= 0) return
      const meta = Math.min(alto * SCROLL_INTERES, window.innerHeight * SCROLL_TOPE_PANTALLAS)
      if (window.scrollY >= meta) mostrar()
    }
    const alSalir = (e: MouseEvent) => {
      // Sólo cuando el puntero se va por arriba, que es el gesto de cerrar la
      // pestaña. Salir por los costados es mirar otra ventana, no irse.
      if (e.clientY <= 0) mostrar()
    }

    window.addEventListener('scroll', alScrollear, { passive: true })
    document.addEventListener('mouseout', alSalir)
    return () => {
      vivo = false
      clearTimeout(gracia)
      clearTimeout(limite)
      window.removeEventListener('scroll', alScrollear)
      document.removeEventListener('mouseout', alSalir)
    }
  }, [loading, user, enSilencio])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible || enSilencio) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={dismiss}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con gradiente */}
        <div className="bg-gradient-to-br from-brand-purple to-purple-800 px-6 pt-8 pb-6 text-center">
          <span className="text-5xl block mb-3">🎁</span>
          <p className="text-white/80 text-sm font-medium uppercase tracking-widest mb-1">Oferta exclusiva</p>
          <h2 className="text-white text-3xl font-extrabold leading-tight">
            10% OFF
          </h2>
          <p className="text-white/80 text-sm mt-1">en tu primera compra</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-center">
          <p className="text-brand-text text-sm mb-5 leading-relaxed">
            Registrate gratis y el descuento se aplica automáticamente al finalizar tu primera compra.
          </p>

          <Link
            href="/cuenta/registro"
            onClick={dismiss}
            className="block w-full bg-brand-purple hover:bg-brand-purple-light text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Quiero mi 10% de descuento
          </Link>

          <button
            onClick={dismiss}
            className="mt-3 text-xs text-brand-text-muted hover:text-brand-text transition-colors"
          >
            No, gracias
          </button>
        </div>

        {/* Botón cerrar */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
