'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Categoria = { id: string; nombre: string }

/**
 * Filtros del listado de productos del admin. Navega por query params
 * (?q=&categoria=&estado=&stock=) — el server component los lee y filtra.
 * La búsqueda tiene debounce para no navegar en cada tecla.
 */
export default function ProductosFiltros({
  categorias,
  total,
  mostrados,
}: {
  categorias: Categoria[]
  total: number
  mostrados: number
}) {
  const router = useRouter()
  const params = useSearchParams()

  const qActual = params.get('q') ?? ''
  const [q, setQ] = useState(qActual)

  // Si cambia la URL por fuera (ej. "Limpiar"), sincronizamos el input
  useEffect(() => { setQ(qActual) }, [qActual])

  function navegar(cambios: Record<string, string>) {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(cambios)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    router.push(`/admin/productos?${next.toString()}`)
  }

  // Debounce de la búsqueda
  useEffect(() => {
    if (q === qActual) return
    const t = setTimeout(() => navegar({ q }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const categoria = params.get('categoria') ?? ''
  const estado = params.get('estado') ?? ''
  const stock = params.get('stock') ?? ''
  const hayFiltros = Boolean(q || categoria || estado || stock)

  const selectCls =
    'bg-brand-bg border border-brand-border text-brand-text text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-purple'

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col lg:flex-row gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o SKU..."
          aria-label="Buscar productos"
          className="flex-1 bg-brand-bg border border-brand-border text-brand-text text-sm rounded-xl px-4 py-2.5 placeholder:text-brand-text-light focus:outline-none focus:border-brand-purple"
        />

        <select
          value={categoria}
          onChange={(e) => navegar({ categoria: e.target.value })}
          aria-label="Filtrar por categoría"
          className={selectCls}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>

        <select
          value={estado}
          onChange={(e) => navegar({ estado: e.target.value })}
          aria-label="Filtrar por estado"
          className={selectCls}
        >
          <option value="">Activos e inactivos</option>
          <option value="activo">Solo activos</option>
          <option value="inactivo">Solo inactivos</option>
        </select>

        <select
          value={stock}
          onChange={(e) => navegar({ stock: e.target.value })}
          aria-label="Filtrar por stock"
          className={selectCls}
        >
          <option value="">Cualquier stock</option>
          <option value="agotado">Agotados o con variante agotada</option>
          <option value="bajo">Stock bajo (1-4)</option>
          <option value="con">Con stock (5+)</option>
        </select>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-brand-text-muted">
          {hayFiltros
            ? `${mostrados} de ${total} producto${total !== 1 ? 's' : ''}`
            : `${total} producto${total !== 1 ? 's' : ''}`}
        </span>
        {hayFiltros && (
          <button
            onClick={() => router.push('/admin/productos')}
            className="text-brand-purple hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
