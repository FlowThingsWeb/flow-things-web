'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'


/** Lo mínimo para armar una opción del desplegable. */
export type ItemMenu = { id: string; nombre: string; slug: string }

/**
 * Item del menú con su desplegable.
 *
 * Lo usan las categorías con sus tipos de producto y Marcas con sus marcas:
 * en los dos casos es un link que ya sirve solo más una lista de hijos que
 * cuelgan de la misma ruta.
 *
 * El link de arriba sigue siendo un link: se puede entrar a "Juguetería" sin
 * elegir un tipo, que es lo que hace la mayoría. El desplegable es un atajo
 * para quien ya sabe que busca peluches.
 *
 * Abre con hover en desktop y con click en todos lados. El click importa: en
 * touch no hay hover, y con teclado el hover no existe — sin él, el segundo
 * nivel sería inalcanzable para quien navega con tab.
 */
export default function NavCategoria({
  href,
  label,
  nombre,
  items,
  verTodo = 'Ver todo',
}: {
  href: string
  label: React.ReactNode
  /**
   * El nombre en texto plano, sólo para el lector de pantalla.
   *
   * `label` es JSX —lleva el texto editable del panel de administración—, así
   * que no sirve para el aria-label: los tres botones terminaban diciendo
   * "Ver tipos de la categoría", tres veces lo mismo y sin decir de cuál.
   */
  nombre: string
  items: ItemMenu[]
  /** Texto del link final del panel. */
  verTodo?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cerrarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cerrar al hacer click afuera o con Escape.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  useEffect(() => () => {
    if (cerrarTimer.current) clearTimeout(cerrarTimer.current)
  }, [])

  if (items.length === 0) {
    return (
      <Link
        href={href}
        className="text-sm font-medium text-brand-text-muted hover:text-white transition-colors"
      >
        {label}
      </Link>
    )
  }

  // Un respiro al salir: sin esto, cruzar el hueco de 8px entre el título y el
  // panel cierra el menú justo cuando la persona va a elegir.
  const programarCierre = () => {
    cerrarTimer.current = setTimeout(() => setAbierto(false), 120)
  }
  const cancelarCierre = () => {
    if (cerrarTimer.current) clearTimeout(cerrarTimer.current)
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => {
        cancelarCierre()
        setAbierto(true)
      }}
      onMouseLeave={programarCierre}
    >
      <div className="flex items-center gap-1">
        <Link
          href={href}
          className="text-sm font-medium text-brand-text-muted hover:text-white transition-colors"
        >
          {label}
        </Link>
        <button
          type="button"
          aria-expanded={abierto}
          aria-haspopup="true"
          aria-label={`Ver ${nombre}`}
          onClick={() => setAbierto((v) => !v)}
          className="p-1 -m-1 text-brand-text-muted hover:text-white transition-colors"
        >
          <svg
            width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
            className={`transition-transform ${abierto ? 'rotate-180' : ''}`}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {abierto && (
        <div
          className="absolute left-0 top-full pt-2 z-50"
          onMouseEnter={cancelarCierre}
          onMouseLeave={programarCierre}
        >
          <ul className="min-w-56 bg-brand-bg-card border border-brand-border rounded-xl shadow-xl py-2">
            {items.map((s) => (
              <li key={s.id}>
                <Link
                  href={`${href}/${s.slug}`}
                  onClick={() => setAbierto(false)}
                  className="block px-4 py-2 text-sm text-brand-text-muted hover:bg-brand-bg-soft hover:text-white transition-colors"
                >
                  {s.nombre}
                </Link>
              </li>
            ))}
            <li className="border-t border-brand-border mt-2 pt-2">
              <Link
                href={href}
                onClick={() => setAbierto(false)}
                className="block px-4 py-2 text-sm text-brand-purple hover:bg-brand-bg-soft transition-colors"
              >
                {verTodo}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
