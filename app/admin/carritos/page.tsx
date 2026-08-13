'use client'

import { useEffect, useState } from 'react'

type Carrito = {
  user_id: string
  email: string
  nombre: string
  productos: { nombre: string; cantidad: number }[]
  total: number
  updated_at: string
  recordatorio_enviado: string | null
  ya_compro: boolean
}

function fmtPrecio(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function haceCuanto(iso: string) {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600_000)
  if (h < 1) return 'hace <1 h'
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

export default function CarritosAbandonadosPage() {
  const [carritos, setCarritos] = useState<Carrito[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState<string | null>(null)
  const [ocultarComprados, setOcultarComprados] = useState(true)

  async function cargar() {
    setCargando(true)
    try {
      const res = await fetch('/api/admin/carritos')
      const data = await res.json()
      setCarritos(data.data ?? [])
    } catch {
      setError('No se pudieron cargar los carritos.')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { cargar() }, [])

  async function enviar(c: Carrito) {
    if (!confirm(`¿Enviar recordatorio de carrito a ${c.email}?`)) return
    setEnviando(c.user_id)
    try {
      const res = await fetch('/api/admin/carritos/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: c.user_id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error || 'No se pudo enviar.'); return }
      await cargar()
    } finally {
      setEnviando(null)
    }
  }

  const visibles = ocultarComprados ? carritos.filter(c => !c.ya_compro) : carritos

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Carritos abandonados</h1>
          <p className="text-brand-text-muted mt-1 text-sm">
            Usuarios logueados con productos en el carrito que no finalizaron la compra.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-brand-text-muted cursor-pointer">
          <input type="checkbox" checked={ocultarComprados} onChange={e => setOcultarComprados(e.target.checked)} className="w-4 h-4 accent-brand-purple" />
          Ocultar los que ya compraron
        </label>
      </div>

      {cargando ? (
        <p className="text-sm text-brand-text-muted">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-border p-10 text-center text-brand-text-muted">
          🛒 No hay carritos abandonados por ahora.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibles.map(c => (
            <div key={c.user_id} className={`bg-brand-bg-card border rounded-2xl p-5 ${c.ya_compro ? 'border-green-500/30 opacity-70' : 'border-brand-border'}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{c.nombre || '(sin nombre)'}</p>
                  <p className="text-xs text-brand-text-muted truncate">{c.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-brand-neon font-bold">{fmtPrecio(c.total)}</p>
                  <p className="text-[11px] text-brand-text-muted">{haceCuanto(c.updated_at)}</p>
                </div>
              </div>

              <div className="text-sm text-brand-text-muted mb-3 space-y-0.5 max-h-32 overflow-y-auto">
                {c.productos.map((p, i) => (
                  <p key={i} className="truncate">• {p.cantidad}× {p.nombre}</p>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px]">
                  {c.ya_compro ? (
                    <span className="text-green-400">✓ Ya compró después</span>
                  ) : c.recordatorio_enviado ? (
                    <span className="text-brand-text-muted">Recordatorio enviado {fmtFecha(c.recordatorio_enviado)}</span>
                  ) : (
                    <span className="text-yellow-400">Sin recordatorio</span>
                  )}
                </div>
                <button
                  onClick={() => enviar(c)}
                  disabled={enviando === c.user_id}
                  className="text-sm font-semibold bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {enviando === c.user_id ? 'Enviando…' : c.recordatorio_enviado ? 'Reenviar mail' : 'Enviar mail'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-brand-text-muted mt-6">
        💡 Igual hay un envío <strong>automático</strong>: a cada carrito inactivo entre 1 h y 48 h se le manda el recordatorio una vez. Acá podés mandarlo (o reenviarlo) a mano.
      </p>
    </div>
  )
}
