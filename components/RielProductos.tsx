import Link from 'next/link'
import ProductCard from '@/components/ProductCard'
import { Producto } from '@/types'
import { blurDe, imagenDeProducto } from '@/lib/blur'

/**
 * Una fila de productos que se desliza, en vez de otra grilla.
 *
 * La home tenía "Productos destacados" y "Recién llegados" una debajo de la
 * otra, las dos como grilla de cuatro columnas: dieciséis fichas idénticas
 * seguidas. El visitante que bajaba no sabía que había empezado otra sección,
 * porque no cambiaba nada más que el título.
 *
 * Las dos secciones no piden lo mismo. "Destacados" es para decidir: se mira
 * entera y se compara. "Recién llegados" es para pasear: lo que importa es
 * que haya cosas nuevas, no cuáles son exactamente. Un riel hace eso en un
 * tercio del alto, y en un teléfono —el 82% del tráfico— deslizar al costado
 * es más barato que recorrer ocho fichas hacia abajo.
 *
 * Es CSS puro: `snap-x` para que frene en cada ficha y el ancho fijo para que
 * la última asome por el borde. Una ficha cortada a la derecha es lo que
 * avisa que hay más; sin eso, el riel se lee como una fila que termina ahí.
 */
export default function RielProductos({
  titulo,
  bajada,
  productos,
  verMasHref,
  verMasTexto = 'Ver más',
  mapaBlur,
}: {
  titulo: string
  bajada?: string
  productos: Producto[]
  verMasHref: string
  verMasTexto?: string
  mapaBlur: Record<string, string>
}) {
  if (productos.length === 0) return null

  return (
    <section className="pb-16">
      <div className="mx-auto mb-6 flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold text-brand-text">{titulo}</h2>
          {bajada && (
            <p className="mt-1 text-sm text-brand-text-muted">{bajada}</p>
          )}
        </div>
        <Link
          href={verMasHref}
          className="shrink-0 rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-brand-neon hover:text-brand-neon"
        >
          {verMasTexto}
        </Link>
      </div>

      {/*
        El riel sangra hasta el borde de la pantalla a propósito: dentro del
        contenedor centrado, la ficha cortada quedaba detrás del margen y
        parecía un error de maquetado en vez de una invitación a deslizar.
        El padding de los costados lo pone el propio riel, para que la primera
        ficha arranque alineada con el título.
      */}
      <div className="scrollbar-hide snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        <ul className="mx-auto flex w-max max-w-7xl gap-4 px-4 sm:px-6 lg:px-8">
          {productos.map((producto) => (
            /* `flex` para que la ficha estire hasta el alto de la fila. En
               una grilla eso pasa solo; acá, sin esto, la ficha que no tiene
               el renglón de "envío gratis" queda más corta y los botones de
               "+ Agregar" terminan cada uno a su altura. */
            <li
              key={producto.id}
              className="flex w-[190px] shrink-0 snap-start sm:w-[220px]"
            >
              <ProductCard
                producto={producto}
                blurDataURL={blurDe(mapaBlur, imagenDeProducto(producto))}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
