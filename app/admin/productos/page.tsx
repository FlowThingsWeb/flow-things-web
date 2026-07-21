import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatPrecio } from '@/lib/format'
import ProductosFiltros from '@/components/admin/ProductosFiltros'

export const dynamic = 'force-dynamic'

type Filtros = {
  q?: string
  categoria?: string
  estado?: string
  stock?: string
}

async function getProductos(f: Filtros) {
  let query = supabaseAdmin
    .from('productos')
    .select('*, categorias(nombre), variantes(imagen_url, imagenes, activo)')

  const q = f.q?.trim()
  if (q) {
    // Escapamos comas y paréntesis: romperían la sintaxis del filtro .or()
    const safe = q.replace(/[,()]/g, ' ')
    query = query.or(`nombre.ilike.%${safe}%,sku.ilike.%${safe}%`)
  }
  if (f.categoria) query = query.eq('categoria_id', f.categoria)
  if (f.estado === 'activo') query = query.eq('activo', true)
  if (f.estado === 'inactivo') query = query.eq('activo', false)
  if (f.stock === 'agotado') query = query.lte('stock', 0)
  if (f.stock === 'bajo') query = query.gte('stock', 1).lte('stock', 4)
  if (f.stock === 'con') query = query.gte('stock', 5)

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) console.error('[admin/productos] error:', error.message, error.code)
  return data || []
}

/** Primera imagen disponible: producto o primera variante activa con imagen */
function resolverImagen(p: any): string | null {
  if (p.imagen_url) return p.imagen_url
  if (p.imagenes?.length) return p.imagenes[0]
  const variantes: any[] = p.variantes || []
  for (const v of variantes) {
    if (!v.activo) continue
    if (v.imagen_url) return v.imagen_url
    if (v.imagenes?.length) return v.imagenes[0]
  }
  return null
}

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: Promise<Filtros>
}) {
  const f = await searchParams

  const [productos, { count: total }, { data: categorias }] = await Promise.all([
    getProductos(f),
    supabaseAdmin.from('productos').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('categorias').select('id, nombre').order('nombre'),
  ])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Productos</h1>
          <p className="text-brand-text-muted text-sm mt-1">
            Buscá, filtrá y editá tu catálogo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/productos/importar"
            className="flex items-center gap-2 bg-brand-bg-soft border border-brand-border hover:border-brand-neon text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
          >
            <span>📊</span> Importar Excel
          </Link>
          <Link
            href="/admin/productos/nuevo"
            className="bg-brand-purple hover:bg-brand-purple-light text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            + Nuevo producto
          </Link>
        </div>
      </div>

      <ProductosFiltros
        categorias={categorias || []}
        total={total ?? 0}
        mostrados={productos.length}
      />

      <div className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden">
        {productos.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl block mb-3">🔍</span>
            <p className="text-brand-text-muted">
              No hay productos que coincidan con la búsqueda
            </p>
            <Link
              href="/admin/productos"
              className="text-brand-purple text-sm mt-2 inline-block hover:underline"
            >
              Ver todos
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Producto</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide hidden lg:table-cell">SKU</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide hidden md:table-cell">Categoría</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Precio</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide hidden sm:table-cell">Stock</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {productos.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-bg-soft/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-brand-bg flex-shrink-0">
                          {resolverImagen(p) ? (
                            <Image src={resolverImagen(p)!} alt={p.nombre} fill className="object-cover" sizes="40px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-brand-text text-sm line-clamp-1">{p.nombre}</p>
                          <p className="text-brand-text-light text-xs">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <span className="font-mono text-xs text-brand-neon">
                        {p.sku || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-sm text-brand-text-muted">
                        {(p.categorias as any)?.nombre || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold text-brand-text">
                        {formatPrecio(p.precio)}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className={`text-sm ${p.stock === 0 ? 'text-red-500' : p.stock < 5 ? 'text-yellow-500' : 'text-green-600'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${p.activo ? 'bg-green-400' : 'bg-gray-300'}`} />
                        <span className="text-xs text-brand-text-muted">
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        {/* Lo ocultó el sistema por quedarse sin stock: vuelve
                            solo cuando el CRM sincronice stock > 0. */}
                        {!p.activo && p.desactivado_por_stock && (
                          <span className="text-[10px] uppercase tracking-wide bg-brand-bg-soft border border-brand-border text-brand-text-light px-1.5 py-0.5 rounded">
                            sin stock
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/productos/nuevo?id=${p.id}`}
                        className="text-brand-purple hover:text-brand-purple-dark text-sm font-medium transition-colors"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
