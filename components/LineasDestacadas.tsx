import Link from 'next/link'
import { getMarcas } from '@/lib/catalogo'
import { PIEZAS } from '@/lib/bannerLineas'

/**
 * Los cuatro mosaicos pegados abajo del banner.
 *
 * Van sin aire ni título entre medio: el banner termina y el color sigue. Son
 * la continuación de la pieza de arriba, no una sección nueva, y cada mosaico
 * usa el fondo de su propio banner para que al pasar de una pieza a otra haya
 * algo que se reconozca.
 *
 * Las líneas son las mismas del carrusel y salen de `PIEZAS`: se cambian en un
 * solo lugar y los mosaicos siguen. La cantidad de productos NO está escrita
 * acá —sale de `getMarcas()`, la misma consulta que ya usa el menú—, así que
 * si cargás productos nuevos el número sube solo.
 *
 * Una línea sin productos no se muestra: el mosaico prometería un listado
 * vacío.
 */
export default async function LineasDestacadas() {
  const marcas = await getMarcas()
  const porSlug = new Map(marcas.map((m) => [m.slug, m]))

  const total = marcas.reduce((n, m) => n + m.cantidad, 0)

  const mosaicos = PIEZAS.filter((p) => !p.desde)
    .map((p) => {
      const m = porSlug.get(p.id)
      if (!m || m.cantidad === 0) return null
      return { slug: p.id, nombre: m.nombre, fondo: p.fondo, cantidad: m.cantidad }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (mosaicos.length === 0) return null

  return (
    <section aria-label="Comprá por línea">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {mosaicos.map((m) => (
          <Link
            key={m.slug}
            href={`/marcas/${m.slug}`}
            style={{ background: m.fondo }}
            className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 px-4 py-8 text-center text-white transition-opacity hover:opacity-90 sm:min-h-[8.5rem]"
          >
            <span className="text-xl font-black leading-tight tracking-tight sm:text-2xl">
              {m.nombre}
            </span>
            <span className="text-sm font-semibold text-white/90">
              {m.cantidad} {m.cantidad === 1 ? 'producto' : 'productos'}
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/marcas"
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand-bg px-4 py-5 text-center transition-colors hover:bg-brand-bg-card"
      >
        <span className="text-lg font-extrabold text-white">
          Ver las {marcas.length} líneas
        </span>
        <span className="text-base font-semibold text-brand-neon">
          {total} productos →
        </span>
      </Link>
    </section>
  )
}
