import { Suspense } from 'react'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import ProductCard from '@/components/ProductCard'
import SearchInput from '@/components/SearchInput'
import SortSelect from '@/components/SortSelect'
import Link from 'next/link'
import { Producto, Variante } from '@/types'
import { CATEGORIAS_PAUSADAS } from '@/lib/categoriasPausadas'

const PAGE_SIZE = 24

interface PageProps {
  searchParams: Promise<{ categoria?: string; q?: string; orden?: string; page?: string }>
}

export type CatalogItem = {
  producto: Producto
  variante: Variante | null
}


async function getProductos(categoria?: string, q?: string): Promise<CatalogItem[]> {
  let query = supabaseAdmin
    .from('productos')
    .select('*, categorias(id, nombre, slug), variantes(*)')
    .eq('activo', true)
    .order('created_at', { ascending: false })

  const { data } = await query
  let productos: Producto[] = data || []

  // Excluir categorías pausadas
  productos = productos.filter(
    (p: Producto) => !CATEGORIAS_PAUSADAS.includes((p.categorias as any)?.slug)
  )

  if (categoria) {
    productos = productos.filter(
      (p: Producto) => (p.categorias as any)?.slug === categoria
    )
  }

  // Expand first: one card per active variant, or one card if no variants
  const items: CatalogItem[] = []
  for (const producto of productos) {
    const variantesActivas: Variante[] = ((producto.variantes || []) as Variante[]).filter(v => v.activo)
    if (variantesActivas.length > 0) {
      for (const variante of variantesActivas) {
        items.push({ producto, variante })
      }
    } else {
      items.push({ producto, variante: null })
    }
  }

  // Filter each card individually — a variant card only matches if THAT variant has the term
  if (q?.trim()) {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return items.filter(({ producto, variante }) => {
      const haystack = [
        producto.nombre,
        producto.descripcion ?? '',
        // Only this specific variant's attributes, not all variants of the product
        ...(variante ? Object.values(variante.atributos) : []),
      ].join(' ').toLowerCase()
      return words.every(w => haystack.includes(w))
    })
  }

  return items
}

async function getCategorias() {
  const { data } = await supabaseAdmin.from('categorias').select('*')
  return (data || []).filter((c: any) => !CATEGORIAS_PAUSADAS.includes(c.slug))
}

export default async function ProductosPage({ searchParams }: PageProps) {
  const params = await searchParams
  const [items, categorias] = await Promise.all([
    getProductos(params.categoria, params.q),
    getCategorias(),
  ])

  const categoriaActiva = categorias.find(
    (c) => c.slug === params.categoria
  )

  // ─── Ordenar ─────────────────────────────────────────────────────────────
  // 'nuevo' respeta el orden de la query (created_at desc). El resto reordena.
  const orden = params.orden || 'nuevo'
  const ordenados = [...items]
  if (orden === 'precio-asc') ordenados.sort((a, b) => a.producto.precio - b.producto.precio)
  else if (orden === 'precio-desc') ordenados.sort((a, b) => b.producto.precio - a.producto.precio)
  else if (orden === 'nombre') ordenados.sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, 'es'))

  // ─── Paginar ─────────────────────────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE))
  const paginaActual = Math.min(Math.max(1, parseInt(params.page || '1', 10) || 1), totalPaginas)
  const visibles = ordenados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE)

  // Link de paginación preservando categoria / q / orden
  const linkPagina = (p: number) => {
    const sp = new URLSearchParams()
    if (params.categoria) sp.set('categoria', params.categoria)
    if (params.q) sp.set('q', params.q)
    if (params.orden) sp.set('orden', params.orden)
    if (p > 1) sp.set('page', String(p))
    return `/productos${sp.toString() ? `?${sp.toString()}` : ''}`
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text">
          {categoriaActiva ? categoriaActiva.nombre : 'Todo el catálogo'}
        </h1>
        <p className="text-brand-text-muted mt-1">
          {items.length} artículo{items.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filtros */}
        <aside className="lg:w-56 flex-shrink-0">
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-5">
            <h3 className="font-semibold text-white text-sm mb-4">Categorías</h3>
            <ul className="space-y-1">
              <li>
                <a
                  href="/productos"
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    !params.categoria
                      ? 'bg-brand-purple text-white font-medium'
                      : 'text-brand-text-muted hover:bg-brand-bg-soft hover:text-white'
                  }`}
                >
                  Todos
                </a>
              </li>
              {categorias.map((cat) => (
                <li key={cat.id}>
                  <a
                    href={`/productos?categoria=${cat.slug}`}
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                      params.categoria === cat.slug
                        ? 'bg-brand-purple text-white font-medium'
                        : 'text-brand-text-muted hover:bg-brand-bg-soft hover:text-white'
                    }`}
                  >
                    {cat.nombre}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Grid de productos */}
        <div className="flex-1">
          <SearchInput categoria={params.categoria} />

          {ordenados.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-6">
              <p className="text-sm text-brand-text-muted whitespace-nowrap">
                Mostrando {(paginaActual - 1) * PAGE_SIZE + 1}–
                {Math.min(paginaActual * PAGE_SIZE, ordenados.length)} de {ordenados.length}
              </p>
              <SortSelect />
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-center py-20">
              <span className="text-5xl block mb-4">🔍</span>
              <p className="text-brand-text-muted">No encontramos productos para tu búsqueda</p>
              <a href="/productos" className="text-brand-purple text-sm mt-2 inline-block hover:underline">
                Ver todo el catálogo
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibles.map(({ producto, variante }) => (
                  <ProductCard
                    key={variante ? `${producto.id}-${variante.id}` : producto.id}
                    producto={producto}
                    variante={variante}
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
