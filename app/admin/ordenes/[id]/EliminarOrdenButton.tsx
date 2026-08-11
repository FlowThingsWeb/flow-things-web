'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Elimina una orden pendiente. Solo se muestra cuando estado === 'pending'. */
export default function EliminarOrdenButton({ id }: { id: string }) {
  const router = useRouter()
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState('')

  async function eliminar() {
    if (!confirm('¿Eliminar esta orden pendiente? No se puede deshacer.')) return
    setBorrando(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/ordenes/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'No se pudo eliminar.')
        setBorrando(false)
        return
      }
      router.push('/admin/ordenes')
      router.refresh()
    } catch {
      setError('Error de conexión.')
      setBorrando(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={eliminar}
        disabled={borrando}
        className="text-sm font-medium text-red-400 hover:text-white hover:bg-red-600 border border-red-500/40 hover:border-red-600 px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
      >
        {borrando ? 'Eliminando…' : '🗑️ Eliminar orden pendiente'}
      </button>
      {error && <span className="text-red-400 text-sm">{error}</span>}
    </div>
  )
}
