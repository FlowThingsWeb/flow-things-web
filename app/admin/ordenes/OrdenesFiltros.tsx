'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

/**
 * Barra de filtros de Órdenes. Actualiza la URL (searchParams) que la página
 * server-component lee para filtrar. Preserva el filtro de estado activo.
 */
export default function OrdenesFiltros() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [desde, setDesde] = useState(searchParams.get('desde') || '')
  const [hasta, setHasta] = useState(searchParams.get('hasta') || '')

  const aplicar = (e?: React.FormEvent) => {
    e?.preventDefault()
    const params = new URLSearchParams()
    const estado = searchParams.get('estado')
    if (estado) params.set('estado', estado)
    if (q.trim()) params.set('q', q.trim())
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    router.push(`/admin/ordenes${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const limpiar = () => {
    setQ(''); setDesde(''); setHasta('')
    router.push('/admin/ordenes')
  }

  const hayFiltros = !!(q || desde || hasta || searchParams.get('estado'))

  return (
    <form onSubmit={aplicar} className="flex flex-wrap items-end gap-3 mb-6">
      <div className="flex-1 min-w-[200px]">
        <label htmlFor="q" className="block text-xs font-medium text-brand-text-muted mb-1">
          Buscar cliente / email
        </label>
        <input
          id="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre o email..."
          className="input-dark w-full text-sm"
        />
      </div>

      <div>
        <label htmlFor="desde" className="block text-xs font-medium text-brand-text-muted mb-1">Desde</label>
        <input
          id="desde"
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="input-dark text-sm"
        />
      </div>

      <div>
        <label htmlFor="hasta" className="block text-xs font-medium text-brand-text-muted mb-1">Hasta</label>
        <input
          id="hasta"
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="input-dark text-sm"
        />
      </div>

      <button
        type="submit"
        className="bg-brand-purple hover:bg-brand-purple-dark text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        Filtrar
      </button>

      {hayFiltros && (
        <button
          type="button"
          onClick={limpiar}
          className="text-brand-text-muted hover:text-white text-sm font-medium px-3 py-2 transition-colors"
        >
          Limpiar
        </button>
      )}
    </form>
  )
}
