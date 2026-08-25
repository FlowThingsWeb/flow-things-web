'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCartStore } from '@/lib/store'
import { formatPrecio } from '@/lib/format'
import { trackAddToCart } from '@/lib/fbpixel'
import type { SlideCarrusel } from '@/lib/carruselHome'

const AUTOPLAY_MS = 6000

const ETIQUETAS: Record<SlideCarrusel['etiqueta'], { texto: string; clase: string }> = {
  oferta: {
    texto: 'OFERTA',
    clase: 'bg-brand-purple text-white',
  },
  destacado: {
    texto: '★ DESTACADO',
    clase: 'bg-brand-neon text-black',
  },
  novedad: {
    texto: 'NUEVO',
    clase: 'bg-brand-bg-soft text-brand-neon border border-brand-neon/40',
  },
}

/**
 * Carrusel de la home: un producto por slide, foto grande y el botón de
 * comprar bien a la vista.
 *
 * El desplazamiento es scroll nativo con scroll-snap en vez de transform:
 * así el swipe en celular lo maneja el navegador (con su inercia y su
 * elasticidad) y no hay que emular gestos a mano. Los botones y los puntos
 * solo hacen scrollTo.
 */
export default function HomeCarousel({
  slides,
  blurs = {},
}: {
  slides: SlideCarrusel[]
  /** Placeholder difuminado por id de producto (ver lib/blur.ts). */
  blurs?: Record<string, string>
}) {
  const pistaRef = useRef<HTMLDivElement>(null)
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)
  const addItem = useCartStore((s) => s.addItem)

  const irA = useCallback((i: number) => {
    const pista = pistaRef.current
    if (!pista) return
    const destino = Math.max(0, Math.min(i, slides.length - 1))
    pista.scrollTo({ left: destino * pista.clientWidth, behavior: 'smooth' })
  }, [slides.length])

  // El índice se deriva del scroll real, no al revés: así queda bien tanto si
  // el usuario arrastró con el dedo como si tocó una flecha.
  useEffect(() => {
    const pista = pistaRef.current
    if (!pista) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const ancho = pista.clientWidth
        if (ancho > 0) setIndice(Math.round(pista.scrollLeft / ancho))
      })
    }
    pista.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      pista.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  // Autoplay. Se frena mientras el mouse está encima, mientras hay foco de
  // teclado dentro, si la pestaña no está visible o si el sistema pide menos
  // movimiento.
  useEffect(() => {
    if (pausado || slides.length <= 1) return
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    const id = setInterval(() => {
      if (document.hidden) return
      const pista = pistaRef.current
      if (!pista) return
      const ancho = pista.clientWidth
      const actual = ancho > 0 ? Math.round(pista.scrollLeft / ancho) : 0
      const siguiente = actual >= slides.length - 1 ? 0 : actual + 1
      pista.scrollTo({ left: siguiente * ancho, behavior: 'smooth' })
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [pausado, slides.length])

  if (slides.length === 0) return null

  return (
    <section
      className="relative bg-gradient-brand border-b border-brand-border"
      aria-roledescription="carrusel"
      aria-label="Productos destacados"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={() => setPausado(false)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="relative">
          {/* Pista */}
          <div
            ref={pistaRef}
            className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {slides.map((slide, i) => (
              <Slide
                key={slide.producto.id}
                slide={slide}
                blurDataURL={blurs[slide.producto.id]}
                activo={i === indice}
                esPrimero={i === 0}
                onAgregar={() => {
                  const p = slide.producto
                  addItem(p)
                  trackAddToCart({ id: p.id, nombre: p.nombre, precio: p.precio })
                }}
              />
            ))}
          </div>

          {/* Flechas — desde sm, en celular se usa el dedo */}
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => irA(indice - 1)}
                disabled={indice === 0}
                aria-label="Producto anterior"
                className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-brand-bg-card/90 border border-brand-border text-white backdrop-blur hover:border-brand-purple hover:text-brand-neon disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <span aria-hidden="true" className="text-xl leading-none">‹</span>
              </button>
              <button
                type="button"
                onClick={() => irA(indice + 1)}
                disabled={indice === slides.length - 1}
                aria-label="Producto siguiente"
                className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-brand-bg-card/90 border border-brand-border text-white backdrop-blur hover:border-brand-purple hover:text-brand-neon disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <span aria-hidden="true" className="text-xl leading-none">›</span>
              </button>
            </>
          )}
        </div>

        {/* Puntos */}
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
            {slides.map((slide, i) => (
              <button
                key={slide.producto.id}
                type="button"
                onClick={() => irA(i)}
                aria-label={`Ir al producto ${i + 1} de ${slides.length}`}
                aria-current={i === indice}
                // El botón mide 24x24 (mínimo táctil accesible) aunque el
                // punto que se ve sea chico: antes el área tocable era de
                // 8x8 px y en celular era casi imposible acertarle.
                className="grid h-6 w-6 place-items-center"
              >
                <span
                  aria-hidden="true"
                  className={`block h-2 rounded-full transition-all ${
                    i === indice
                      ? 'w-6 bg-brand-neon'
                      : 'w-2 bg-brand-border hover:bg-brand-text-light'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Slide({
  slide,
  blurDataURL,
  activo,
  esPrimero,
  onAgregar,
}: {
  slide: SlideCarrusel
  blurDataURL?: string
  activo: boolean
  /** Solo la primera foto se precarga: es la que entra en el LCP. */
  esPrimero: boolean
  onAgregar: () => void
}) {
  const { producto, etiqueta, descuento } = slide
  const href = `/productos/${producto.slug}`

  // Misma cascada que ProductCard: hay productos que tienen la foto sólo en
  // sus variantes.
  const varianteConImagen = producto.variantes?.find(
    (v) => v.activo !== false && (v.imagen_url || v.imagenes?.[0]),
  )
  const imagenUrl =
    producto.imagen_url ||
    producto.imagenes?.[0] ||
    varianteConImagen?.imagen_url ||
    varianteConImagen?.imagenes?.[0] ||
    null

  const et = ETIQUETAS[etiqueta]

  return (
    <div
      className="min-w-full snap-center px-0 sm:px-14"
      aria-hidden={!activo}
      // Un slide fuera de pantalla no debe ser alcanzable con Tab: el foco
      // saltaría a algo que no se ve y el scroll pegaría un salto.
      {...(!activo ? { inert: '' as unknown as boolean } : {})}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center bg-brand-bg-card border border-brand-border rounded-3xl overflow-hidden p-4 sm:p-6 md:p-8">
        {/* Foto */}
        <Link
          href={href}
          tabIndex={activo ? undefined : -1}
          className="relative block aspect-square w-full rounded-2xl overflow-hidden bg-brand-bg-soft group"
        >
          {imagenUrl ? (
            <Image
              src={imagenUrl}
              alt={producto.nombre}
              fill
              priority={esPrimero}
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, 45vw"
              placeholder={blurDataURL ? 'blur' : 'empty'}
              blurDataURL={blurDataURL}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl">📦</span>
            </div>
          )}
          <span
            className={`absolute top-3 left-3 text-xs font-black px-3 py-1 rounded-full ${et.clase}`}
          >
            {et.texto}
          </span>
          {descuento !== null && (
            <span className="absolute top-3 right-3 bg-brand-neon text-black text-sm font-black px-3 py-1 rounded-full">
              -{descuento}%
            </span>
          )}
        </Link>

        {/* Info + CTA */}
        <div className="flex flex-col">
          <Link href={href} tabIndex={activo ? undefined : -1}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight hover:text-brand-neon transition-colors line-clamp-3">
              {producto.nombre}
            </h2>
          </Link>

          {producto.categorias?.nombre && (
            <p className="text-brand-text-muted text-sm mt-2">
              {producto.categorias.nombre}
            </p>
          )}

          <div className="mt-5 flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl sm:text-4xl font-bold text-brand-neon">
              {formatPrecio(producto.precio)}
            </span>
            {descuento !== null && (
              <span className="text-brand-text-muted text-lg line-through">
                {formatPrecio(producto.precio_anterior!)}
              </span>
            )}
          </div>
          <p className="text-brand-text-muted text-sm mt-1">
            Hasta 12 cuotas · Envío a todo el país
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onAgregar}
              tabIndex={activo ? undefined : -1}
              className="flex-1 bg-brand-purple hover:bg-brand-purple-light text-white font-bold text-base px-8 py-4 rounded-2xl transition-all hover:shadow-purple"
            >
              Comprar
            </button>
            <Link
              href={href}
              tabIndex={activo ? undefined : -1}
              className="flex-1 border border-brand-border hover:border-brand-neon text-white hover:text-brand-neon font-semibold text-base px-8 py-4 rounded-2xl transition-colors text-center"
            >
              Ver detalle
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
