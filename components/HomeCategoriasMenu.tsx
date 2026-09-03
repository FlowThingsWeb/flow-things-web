'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Categoria, Subcategoria } from '@/lib/catalogo'

/**
 * Barra de categorías arriba de todo en la home.
 *
 * Lo primero que ve alguien que entra es el carrusel: mercadería linda, pero
 * que no dice qué más hay. Esta barra pone el catálogo entero a un clic —"ah,
 * tienen peluches"— sin obligar a bajar hasta la grilla de categorías ni a
 * adivinar qué hay adentro de "Juguetería".
 *
 * Cada categoría es un link de verdad, no sólo un disparador del menú: el que
 * quiere ver toda la librería entra directo. El desplegable es para el que ya
 * sabe qué busca, y adentro repite "Ver todo" para el que lo abrió de curioso
 * y quiere el listado completo igual.
 */

type CategoriaConSubs = Categoria & { subcategorias: Subcategoria[]; icono: string }

export default function HomeCategoriasMenu({
  categorias,
  total,
}: {
  categorias: CategoriaConSubs[]
  total: number
}) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const cerrarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!abierta) return
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierta(null)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(null)
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierta])

  useEffect(() => () => {
    if (cerrarTimer.current) clearTimeout(cerrarTimer.current)
  }, [])

  // Un respiro al salir: sin esto, cruzar el hueco entre el botón y el panel
  // cierra el menú justo cuando la persona va a elegir.
  const abrir = (slug: string) => {
    if (cerrarTimer.current) clearTimeout(cerrarTimer.current)
    setAbierta(slug)
  }
  const programarCierre = () => {
    cerrarTimer.current = setTimeout(() => setAbierta(null), 120)
  }

  if (categorias.length === 0) return null

  return (
    <div
      ref={ref}
      /* `relative z-30`: el backdrop-blur crea un contexto de apilado propio,
         así que sin esto el desplegable queda por debajo del carrusel que
         viene justo abajo — se renderiza, pero no se ve. */
      className="relative z-30 border-b border-brand-border bg-brand-bg-card/60 backdrop-blur-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Sin scroll horizontal: `overflow-x-auto` recorta el desplegable,
            que cae por debajo de la barra. Con dos o tres categorías entra en
            una línea, y en pantallas chicas envuelve. */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 py-2">
          {categorias.map((cat) => {
            const estaAbierta = abierta === cat.slug
            return (
              <div
                key={cat.id}
                className="relative shrink-0"
                onMouseEnter={() => cat.subcategorias.length > 0 && abrir(cat.slug)}
                onMouseLeave={programarCierre}
              >
                <div
                  className={`flex items-center rounded-xl transition-colors ${
                    estaAbierta ? 'bg-brand-bg-soft' : 'hover:bg-brand-bg-soft'
                  }`}
                >
                  <Link
                    href={`/categoria/${cat.slug}`}
                    className="flex items-center gap-2 pl-3 pr-1 py-2 text-sm font-semibold text-brand-text hover:text-brand-neon transition-colors whitespace-nowrap"
                  >
                    <span aria-hidden="true">{cat.icono}</span>
                    {cat.nombre}
                  </Link>
                  {cat.subcategorias.length > 0 && (
                    <button
                      type="button"
                      aria-expanded={estaAbierta}
                      aria-haspopup="true"
                      aria-label={`Ver tipos de ${cat.nombre}`}
                      onClick={() => setAbierta(estaAbierta ? null : cat.slug)}
                      className="px-2 py-2 text-brand-text-muted hover:text-brand-neon transition-colors"
                    >
                      <svg
                        width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
                        className={`transition-transform ${estaAbierta ? 'rotate-180' : ''}`}
                      >
                        <path
                          d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
                          fill="none" strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {estaAbierta && (
                  <div
                    className="absolute left-0 top-full pt-2 z-40"
                    onMouseEnter={() => abrir(cat.slug)}
                    onMouseLeave={programarCierre}
                  >
                    <ul className="min-w-60 bg-brand-bg-card border border-brand-border rounded-xl shadow-xl py-2">
                      <li>
                        <Link
                          href={`/categoria/${cat.slug}`}
                          onClick={() => setAbierta(null)}
                          className="block px-4 py-2 text-sm font-semibold text-brand-neon hover:bg-brand-bg-soft transition-colors"
                        >
                          Ver todo {cat.nombre}
                        </Link>
                      </li>
                      <li className="border-t border-brand-border my-1" aria-hidden="true" />
                      {cat.subcategorias.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={`/categoria/${cat.slug}/${sub.slug}`}
                            onClick={() => setAbierta(null)}
                            className="block px-4 py-2 text-sm text-brand-text-muted hover:bg-brand-bg-soft hover:text-white transition-colors"
                          >
                            {sub.nombre}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}

          {/* Todo junto, al final: el que no sabe por dónde empezar entra acá. */}
          <Link
            href="/productos"
            className="shrink-0 ml-auto flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-brand-text-muted hover:text-brand-neon hover:bg-brand-bg-soft transition-colors whitespace-nowrap"
          >
            Ver todos los productos
            <span className="text-brand-text-light font-normal">{total}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
