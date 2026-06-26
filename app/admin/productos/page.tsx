import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

async function getProductos() {
  const { data, error } = await supabaseAdmin
    .from('productos')
    .select('*, categorias(nombre), variantes(imagen_url, imagenes, activo)')
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

function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default async function AdminProductosPage() {
  const productos = await getProductos()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Productos</h1>
          <p className="text-brand-text-muted text-sm mt-1">
            {productos.length} producto{productos.length !== 1 ? 's' : ''}
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

      <div className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden">
        {productos.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl block mb-3">📦</span>
            <p className="text-brand-text-muted">No hay productos cargados</p>
            <Link
              href="/admin/productos/nuevo"
              className="text-brand-purple text-sm mt-2 inline-block hover:underline"
            >
              Crear el primero
            </Link>
          </div>
        ) : (
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
                      <span className="text-xs text-brand-text-muted">{p.activo ? 'Activo' : 'Inactivo'}</span>
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
        )}
      </div>
    </div>
  )
}
