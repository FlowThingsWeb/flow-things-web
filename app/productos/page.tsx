import { Suspense } from 'react'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import ProductCard from '@/components/ProductCard'
import { Producto, Variante } from '@/types'

interface PageProps {
  searchParams: Promise<{ categoria?: string; q?: string }>
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

  if (q) {
    query = query.ilike('nombre', `%${q}%`)
  }

  const { data } = await query
  let productos: Producto[] = data || []

  if (categoria) {
    productos = productos.filter(
      (p: Producto) => (p.categorias as any)?.slug === categoria
    )
  }

  // Expand: one card per active variant, or one card if no variants
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

  return items
}

async function getCategorias() {
  const { data } = await supabaseAdmin.from('categorias').select('*')
  return data || []
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
          {/* Buscador */}
          <form className="mb-6" method="GET">
            {params.categoria && (
              <input type="hidden" name="categoria" value={params.categoria} />
            )}
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-light"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                name="q"
                defaultValue={params.q}
                placeholder="Buscar productos..."
                className="input-dark pl-9"
              />
            </div>
          </form>

          {items.length === 0 ? (
            <div className="text-center py-20">
              <span className="text-5xl block mb-4">🔍</span>
              <p className="text-brand-text-muted">No encontramos productos para tu búsqueda</p>
              <a href="/productos" className="text-brand-purple text-sm mt-2 inline-block hover:underline">
                Ver todo el catálogo
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(({ producto, variante }) => (
                <ProductCard
                  key={variante ? `${producto.id}-${variante.id}` : producto.id}
                  producto={producto}
                  variante={variante}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
