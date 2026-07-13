'use client'

import { useState } from 'react'
import { PROVINCIAS } from '@/lib/format'
import { formatPrecio } from '@/lib/format'

interface Resultado {
  nombre: string
  precio: number
  tiempo_estimado: string
}

/**
 * Estimador de envío en la ficha: el cliente ingresa provincia + CP y ve el costo
 * y el tiempo antes de agregar al carrito. Reduce la duda #1 de la compra online.
 */
export default function EnvioEstimador({ precio }: { precio: number }) {
  const [provincia, setProvincia] = useState('')
  const [cp, setCp] = useState('')
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState('')

  const calcular = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!provincia) { setError('Elegí tu provincia.'); return }
    setCargando(true); setError(''); setResultado(null)
    try {
      const r = await fetch('/api/envio/cotizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provincia, codigo_postal: cp, subtotal: precio }),
      })
      const d = await r.json()
      if (!r.ok || d.error) { setError(d.error || 'No se pudo calcular.'); return }
      const op = d.opciones?.[0]
      if (op) setResultado({ nombre: op.nombre, precio: op.precio, tiempo_estimado: op.tiempo_estimado })
      else setError('No hay envío disponible para esa zona.')
    } catch {
      setError('Error de conexión. Probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="bg-brand-bg-soft rounded-2xl p-4">
      <p className="text-sm font-semibold text-brand-text mb-3">📦 Calculá tu envío</p>
      <form onSubmit={calcular} className="flex flex-col sm:flex-row gap-2">
        <select
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
          aria-label="Provincia"
          className="input-dark text-sm flex-1"
        >
          <option value="">Provincia</option>
          {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input
          type="text"
          inputMode="numeric"
          value={cp}
          onChange={(e) => setCp(e.target.value)}
          placeholder="Código postal"
          aria-label="Código postal"
          className="input-dark text-sm sm:w-32"
        />
        <button
          type="submit"
          disabled={cargando}
          className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          {cargando ? '...' : 'Calcular'}
        </button>
      </form>

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

      {resultado && (
        <div className="mt-3 flex items-center justify-between bg-brand-bg-card border border-brand-border rounded-xl px-3 py-2.5">
          <div>
            <p className="text-sm text-brand-text">{resultado.nombre}</p>
            <p className="text-xs text-brand-text-muted">{resultado.tiempo_estimado}</p>
          </div>
          <span className={`text-sm font-bold ${resultado.precio === 0 ? 'text-green-400' : 'text-brand-neon'}`}>
            {resultado.precio === 0 ? '¡Gratis!' : formatPrecio(resultado.precio)}
          </span>
        </div>
      )}
    </div>
  )
}
