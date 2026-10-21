import Link from 'next/link'
import CintaProductos from '@/components/CintaProductos'
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
        La cinta va de borde a borde, sin padding a los costados. Cuando el
        riel estaba quieto, el padding servía para alinear la primera ficha
        con el título; en una cinta que anda no hay primera ficha, y el
        padding sólo rompía la cuenta de la vuelta.

        La lista va TRIPLICADA y la cinta arranca en la copia del medio. Es lo
        que hace que el bucle no se vea: al llegar al principio de la tercera
        copia, CintaProductos vuelve al principio de la segunda, y como a los
        dos lados hay exactamente el mismo contenido, no hay nada que saltar.
        Las copias 2 y 3 van con aria-hidden, y CintaProductos les agrega
        `inert` al montar, así quien usa lector de pantalla o teclado recorre
        doce productos y no treinta y seis. El `inert` no va acá como prop
        porque React 18 no lo soporta: lo recibe como string vacío, lo trata
        como false y no lo aplica —en silencio—.

        El espacio entre fichas va como `mr-4` y no como `gap-4`: gap no pone
        margen después de la última, así que cada copia medía un espacio menos
        que la anterior y la vuelta caía corrida. Con margen propio, cada
        ficha mide siempre lo mismo.

        Sin `snap`: frenar en seco en cada ficha mientras la cinta anda se
        siente un tirón. El deslizamiento a mano queda libre, que es como se
        mira un estante.
      */}
      <CintaProductos>
        <ul className="flex w-max">
          {[0, 1, 2].map((copia) =>
            productos.map((producto) => (
              /* `flex` para que la ficha estire hasta el alto de la fila. En
                 una grilla eso pasa solo; acá, sin esto, la ficha que no
                 tiene el renglón de "envío gratis" queda más corta y los
                 botones de "+ Agregar" terminan cada uno a su altura. */
              <li
                key={`${copia}-${producto.id}`}
                className="mr-4 flex w-[190px] shrink-0 sm:w-[220px]"
                aria-hidden={copia > 0 || undefined}
              >
                <ProductCard
                  producto={producto}
                  blurDataURL={blurDe(mapaBlur, imagenDeProducto(producto))}
                />
              </li>
            )),
          )}
        </ul>
      </CintaProductos>

    </section>
  )
}
