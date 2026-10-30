import type { Metadata } from 'next'
import Link from 'next/link'
import CatalogoView from '@/components/CatalogoView'
import { getMapaBlur } from '@/lib/blur'
import { getCategorias, getItemsDeCategoria, getRatings } from '@/lib/catalogo'
import { filtrosDe, type SearchParams } from '@/components/PaginaCategoria'
import { getConfig } from '@/lib/config'
import { estadoCyber } from '@/lib/cyber'
import { Lightning, Moped, CreditCard, Truck } from '@phosphor-icons/react/dist/ssr'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

/**
 * La página de las Ofertas Cyber.
 *
 * Es la grilla del catálogo filtrada a lo que está en oferta, con un encabezado
 * que dice por qué conviene comprar acá y no en otro lado. Los tres motivos no
 * son una lista de bondades genéricas: son los tres que esta tienda puede
 * cumplir y que la mayoría de las que compiten en Cyber no —llega hoy, cuotas
 * sin interés y envío gratis desde un monto que la mitad del catálogo alcanza.
 *
 * Con la promo apagada la página sigue existiendo y lo dice. Es mejor que un
 * 404 para el que llega desde un mail viejo o desde una captura compartida en
 * Instagram tres semanas después.
 */

export const revalidate = 60

interface PageProps {
  searchParams: Promise<SearchParams>
}

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getConfig()
  const cyber = estadoCyber(cfg)
  const titulo = `${cyber.titulo} — Flow Things`
  const desc =
    cyber.bajada ||
    'Ofertas en juguetería, librería y regalería. Envío en el día en CABA y alrededores.'

  return {
    title: titulo,
    description: desc,
    // Apagada no se indexa: una página que dice "no hay ofertas" posicionada
    // para "ofertas cyber" es peor que no estar.
    robots: cyber.activo ? undefined : { index: false, follow: true },
    alternates: { canonical: `${BASE}/cyber` },
    openGraph: {
      title: titulo,
      description: desc,
      url: `${BASE}/cyber`,
    },
  }
}

export default async function CyberPage({ searchParams }: PageProps) {
  const params = await searchParams
  const cfg = await getConfig()
  const cyber = estadoCyber(cfg)

  const [itemsBase, categorias, mapaBlur] = await Promise.all([
    getItemsDeCategoria(),
    getCategorias(),
    getMapaBlur(),
  ])

  /**
   * Sólo lo que tiene precio rebajado de verdad.
   *
   * Es el mismo criterio que usa el filtro "Sólo ofertas" del catálogo y que
   * el feed de Google para mandar `sale_price`: hay un precio anterior y es
   * más alto que el actual. Un producto sin eso no entra acá aunque la promo
   * esté prendida — la página no puede mostrar nada que no esté rebajado.
   */
  const enOferta = itemsBase.filter(
    (it) =>
      it.producto.precio_anterior != null &&
      it.producto.precio_anterior > it.producto.precio,
  )

  const ratings = await getRatings([...new Set(enOferta.map((i) => i.producto.id))])
  const umbral = Number(cfg.envio_cadeteria_gratis_desde || cfg.precio_umbral_envio_gratis) || 61000

  if (!cyber.activo || enOferta.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Las ofertas todavía no arrancaron
        </h1>
        <p className="mt-3 text-brand-text-muted">
          Por ahora no hay nada rebajado. Mientras tanto, el catálogo completo sigue con
          envío en el día en CABA y alrededores y 3 cuotas sin interés.
        </p>
        <Link
          href="/productos"
          className="mt-6 inline-block rounded-2xl bg-brand-purple px-6 py-3 font-semibold text-white"
        >
          Ver todos los productos
        </Link>
      </div>
    )
  }

  const descuentoMaximo = Math.max(
    ...enOferta.map((it) =>
      Math.round(
        ((it.producto.precio_anterior! - it.producto.precio) / it.producto.precio_anterior!) * 100,
      ),
    ),
  )

  return (
    <>
      <section className="border-b border-brand-border bg-gradient-to-b from-brand-purple/20 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-neon">
            <Lightning weight="fill" className="h-4 w-4" aria-hidden />
            {cyber.titulo}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-5xl">
            Hasta <span className="text-brand-neon">{descuentoMaximo}% OFF</span>
            <br className="hidden sm:block" /> en {enOferta.length} productos
          </h1>
          {cyber.bajada && (
            <p className="mt-3 max-w-2xl text-brand-text-muted">{cyber.bajada}</p>
          )}

          {/*
            Los tres motivos, y en este orden. El primero es el que casi nadie
            más puede decir en una semana en que todo el mundo promete
            descuentos: que llega hoy.
          */}
          {/*
            En teléfono van en una fila de tres y sin la explicación: apilados
            ocupaban media pantalla y empujaban el primer producto abajo del
            pliegue. En una semana de ofertas, lo que tiene que verse apenas
            entrás es un precio, no tres promesas.
          */}
          <ul className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { Icon: Moped, t: 'Llega hoy', d: 'En CABA y alrededores, comprando antes de las 13' },
              { Icon: CreditCard, t: '3 cuotas', d: 'Sin interés, con todas las tarjetas' },
              {
                Icon: Truck,
                t: 'Envío gratis',
                d: `Desde $${umbral.toLocaleString('es-AR')} a todo el país`,
              },
            ].map(({ Icon, t, d }) => (
              <li
                key={t}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-brand-border bg-brand-bg-card p-3 text-center sm:flex-row sm:items-start sm:gap-3 sm:p-4 sm:text-left"
              >
                <Icon weight="fill" className="h-5 w-5 shrink-0 text-brand-neon" aria-hidden />
                <span>
                  <span className="block text-xs font-semibold leading-tight text-white sm:text-sm">
                    {t}
                  </span>
                  <span className="hidden text-xs text-brand-text-muted sm:block">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CatalogoView
        items={enOferta}
        categorias={categorias}
        ratings={ratings}
        mapaBlur={mapaBlur}
        filtros={filtrosDe(params)}
        orden={params.orden}
        page={params.page}
        basePath="/cyber"
        titulo={`${enOferta.length} productos en oferta`}
      />
    </>
  )
}
