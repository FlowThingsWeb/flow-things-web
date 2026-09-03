/**
 * Grilla del catálogo, compartida por /productos y /categoria/[slug].
 *
 * `basePath` es la ruta sobre la que se arman los links de paginación y orden:
 * `/productos` en el catálogo completo, `/categoria/jugueteria` en una
 * categoría. Así la URL con la palabra clave se mantiene al pasar de página,
 * en vez de rebotar al catálogo genérico.
 */
import Link from 'next/link'
import ProductCard from '@/components/ProductCard'
import SearchInput from '@/components/SearchInput'
import SortSelect from '@/components/SortSelect'
import FiltrosCatalogo, { linkCon } from '@/components/FiltrosCatalogo'
import { blurDe, imagenDeProducto, type MapaBlur } from '@/lib/blur'
import {
  PAGE_SIZE, aplicarFiltros, contarPor, ordenarYPaginar,
  type CatalogItem, type Categoria, type Filtros, type Subcategoria,
} from '@/lib/catalogo'

interface Props {
  /** Tarjetas de la categoría SIN filtrar: los contadores las necesitan. */
  items: CatalogItem[]
  categorias: Categoria[]
  /** Subcategorías de la categoría abierta. Vacío en el catálogo completo. */
  subcategorias?: Subcategoria[]
  ratings: Map<string, { promedio: number; cantidad: number }>
  mapaBlur: MapaBlur
  /** Slug de la categoría abierta, si hay una. */
  categoriaActiva?: string
  filtros?: Filtros
  orden?: string
  page?: string
  basePath: string
  titulo: string
  /** Texto introductorio de la categoría, arriba de la grilla. */
  intro?: string
}

export default function CatalogoView({
  items, categorias, subcategorias = [], ratings, mapaBlur,
  categoriaActiva, filtros = {}, orden, page, basePath, titulo, intro,
}: Props) {
  const filtrados = aplicarFiltros(items, filtros)
  const { ordenados, visibles, totalPaginas, paginaActual } = ordenarYPaginar(filtrados, orden, page)

  // Los contadores salen de la lista completa, no de la filtrada: cada opción
  // dice cuántos daría si se la eligiera.
  const conteoSub = contarPor(items, filtros, 'sub')
  const conteoMarca = contarPor(items, filtros, 'marca')

  /**
   * Ruta sobre la que se arman los links de filtro.
   *
   * No es `basePath`: en /productos?categoria=jugueteria el basePath es
   * "/productos", y ahí un link de subcategoría daría "/productos/peluches",
   * que es la ruta de una FICHA de producto. Los filtros siempre apuntan a la
   * ruta de la categoría, que además es la que Google indexa.
   */
  const rutaFiltros = categoriaActiva ? `/categoria/${categoriaActiva}` : basePath

  const linkPagina = (p: number) => {
    const base = linkCon(rutaFiltros, filtros, orden, {})
    if (p <= 1) return base
    return `${base}${base.includes('?') ? '&' : '?'}page=${p}`
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text">{titulo}</h1>
        <p className="text-brand-text-muted mt-1">
          {filtrados.length} artículo{filtrados.length !== 1 ? 's' : ''}
          {filtrados.length !== items.length && (
            <span className="text-brand-text-light"> de {items.length}</span>
          )}
        </p>
        {intro && (
          <p className="text-brand-text-muted mt-4 max-w-3xl leading-relaxed">{intro}</p>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filtros */}
        <aside className="lg:w-64 flex-shrink-0 space-y-4">
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-5">
            <h2 className="font-semibold text-white text-sm mb-4">Categorías</h2>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/productos"
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    !categoriaActiva
                      ? 'bg-brand-purple text-white font-medium'
                      : 'text-brand-text-muted hover:bg-brand-bg-soft hover:text-white'
                  }`}
                >
                  Todos
                </Link>
              </li>
              {categorias.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/categoria/${cat.slug}`}
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                      categoriaActiva === cat.slug
                        ? 'bg-brand-purple text-white font-medium'
                        : 'text-brand-text-muted hover:bg-brand-bg-soft hover:text-white'
                    }`}
                  >
                    {cat.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* En el celular los filtros van plegados: si ocupan la pantalla
              entera, hay que hacer scroll hasta el final para ver el primer
              producto. En desktop entran al lado de la grilla. */}
          {/* Los filtros van siempre, no sólo dentro de una categoría: en
              /marcas/craze y en el catálogo completo sirven igual. Cada grupo
              se esconde solo cuando no tiene nada que ofrecer — la marca no
              aparece si todo es de la misma marca, el tipo de producto no
              aparece si no hay subcategorías. */}
          {(
            <>
              <details className="lg:hidden bg-brand-bg-card border border-brand-border rounded-2xl">
                <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-white select-none">
                  Filtrar {filtrados.length !== items.length && (
                    <span className="text-brand-purple font-normal">
                      · {filtrados.length} de {items.length}
                    </span>
                  )}
                </summary>
                <div className="px-2 pb-2">
                  <FiltrosCatalogo
                    basePath={rutaFiltros}
                    subcategorias={subcategorias}
                    conteoSub={conteoSub}
                    conteoMarca={conteoMarca}
                    filtros={filtros}
                    orden={orden}
                  />
                </div>
              </details>
              <div className="hidden lg:block">
                <FiltrosCatalogo
                  basePath={rutaFiltros}
                  subcategorias={subcategorias}
                  conteoSub={conteoSub}
                  conteoMarca={conteoMarca}
                  filtros={filtros}
                  orden={orden}
                />
              </div>
            </>
          )}
        </aside>

        {/* Grid de productos */}
        <div className="flex-1">
          <SearchInput categoria={categoriaActiva} />

          {ordenados.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-6">
              <p className="text-sm text-brand-text-muted whitespace-nowrap">
                Mostrando {(paginaActual - 1) * PAGE_SIZE + 1}–
                {Math.min(paginaActual * PAGE_SIZE, ordenados.length)} de {ordenados.length}
              </p>
              <SortSelect basePath={basePath} />
            </div>
          )}

          {filtrados.length === 0 ? (
            <div className="text-center py-20">
              <span className="text-5xl block mb-4">🔍</span>
              <p className="text-brand-text-muted">No encontramos productos para tu búsqueda</p>
              {/* Con filtros puestos, lo útil es sacarlos — no mandar a la
                  persona al catálogo entero y que empiece de cero. */}
              {items.length > 0 ? (
                <Link
                  href={linkCon(rutaFiltros, { q: filtros.q }, orden, { sub: null })}
                  className="text-brand-purple text-sm mt-2 inline-block hover:underline"
                >
                  Ver los {items.length} de esta categoría
                </Link>
              ) : (
                <Link href="/productos" className="text-brand-purple text-sm mt-2 inline-block hover:underline">
                  Ver todos los productos
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibles.map(({ producto, variante }, i) => (
                  <ProductCard
                    key={variante ? `${producto.id}-${variante.id}` : producto.id}
                    producto={producto}
                    variante={variante}
                    rating={ratings.get(producto.id) ?? null}
                    // Primera fila en desktop, dos en mobile: se ven al entrar.
                    prioridad={i < 4}
                    blurDataURL={blurDe(mapaBlur, imagenDeProducto(producto, variante))}
                  />
                ))}
              </div>

              {/* Paginación */}
              {totalPaginas > 1 && (
                <nav className="flex items-center justify-center gap-2 mt-10" aria-label="Paginación">
                  {paginaActual > 1 && (
                    <Link
                      href={linkPagina(paginaActual - 1)}
                      className="px-4 py-2 rounded-xl border border-brand-border text-brand-text-muted hover:text-white hover:border-brand-purple transition-colors text-sm"
                    >
                      ← Anterior
                    </Link>
                  )}

                  {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - paginaActual) <= 1)
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center gap-2">
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="text-brand-text-light px-1">…</span>
                        )}
                        <Link
                          href={linkPagina(p)}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                            p === paginaActual
                              ? 'bg-brand-purple text-white'
                              : 'border border-brand-border text-brand-text-muted hover:text-white hover:border-brand-purple'
                          }`}
                        >
                          {p}
                        </Link>
                      </span>
                    ))}

                  {paginaActual < totalPaginas && (
                    <Link
                      href={linkPagina(paginaActual + 1)}
                      className="px-4 py-2 rounded-xl border border-brand-border text-brand-text-muted hover:text-white hover:border-brand-purple transition-colors text-sm"
                    >
                      Siguiente →
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
