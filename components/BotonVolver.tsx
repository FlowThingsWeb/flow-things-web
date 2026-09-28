'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

/**
 * El botón de volver del sitio.
 *
 * Existe por el webview de Instagram: son el 58% de las sesiones y ahí no hay
 * barra del navegador, así que no hay flecha de atrás. El que entra por un
 * aviso, cae en una ficha de producto y quiere ver otra cosa no tiene con qué,
 * y la miga de pan lo manda al catálogo entero, no a donde venía.
 *
 * Dos comportamientos según si hay a dónde volver DENTRO del sitio:
 *
 * - Si desde que cargó la página hubo alguna navegación nuestra, `back()` es
 *   seguro: el paso anterior del historial es una página de la tienda.
 * - Si no la hubo —entrar directo por un link de un aviso, de un mail o de
 *   Google—, `back()` sacaría al visitante del sitio, de vuelta al aviso. En
 *   ese caso el botón es un link al nivel de arriba.
 *
 * Se mira la navegación de esta carga y no `history.length`: el historial
 * cuenta también las páginas de antes de entrar acá, y en los webviews viene
 * inflado o en 1 sin relación con lo que pasó.
 */

/** A dónde vuelve cuando no hay historial propio: el nivel de arriba. */
export function destinoDeArriba(pathname: string): string {
  const partes = pathname.split('/').filter(Boolean)

  // /categoria/<cat>/<sub> sube a /categoria/<cat>; /categoria/<cat>, al catálogo.
  if (partes[0] === 'categoria') {
    return partes.length >= 3 ? `/categoria/${partes[1]}` : '/productos'
  }
  // La ficha sube al catálogo; /marcas/<marca>, al listado de marcas.
  if (partes[0] === 'productos' && partes.length >= 2) return '/productos'
  if (partes[0] === 'marcas' && partes.length >= 2) return '/marcas'
  if (partes[0] === 'cuenta' && partes.length >= 2) return '/cuenta'
  return '/'
}

/** Dónde no va: el inicio no tiene nivel de arriba, y el checkout no se interrumpe. */
const SIN_BOTON = ['/', '/carrito', '/exito', '/confirmar']

export default function BotonVolver() {
  const pathname = usePathname()
  const router = useRouter()
  const [hayHistorial, setHayHistorial] = useState(false)
  const anterior = useRef<string | null>(null)

  useEffect(() => {
    // El primer efecto es la carga de la página, no una navegación.
    if (anterior.current === null) {
      anterior.current = pathname
      return
    }
    if (anterior.current !== pathname) {
      anterior.current = pathname
      setHayHistorial(true)
    }
  }, [pathname])

  if (SIN_BOTON.includes(pathname)) return null

  const clases =
    'inline-flex items-center gap-1.5 text-sm text-brand-text-muted hover:text-brand-purple ' +
    'transition-colors py-1 -ml-1 px-1 rounded focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-brand-purple'

  const flecha = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      {hayHistorial ? (
        <button type="button" onClick={() => router.back()} className={clases}>
          {flecha}
          Volver
        </button>
      ) : (
        <Link href={destinoDeArriba(pathname)} className={clases}>
          {flecha}
          Volver
        </Link>
      )}
    </div>
  )
}
