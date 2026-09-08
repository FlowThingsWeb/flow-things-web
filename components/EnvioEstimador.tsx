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
 *
 * Con `NEXT_PUBLIC_GOOGLE_MAPS_KEY` configurada, además muestra el destino en un
 * mapa. Es la Embed API de Google: un iframe, sin librería ni JS de terceros, y
 * sin costo dentro de su cuota. Si la clave no está, el estimador funciona igual
 * y el mapa simplemente no aparece — el envío se cotiza contra nuestra propia
 * tabla de zonas, así que el mapa es confirmación visual, no parte del cálculo.
 */
export default function EnvioEstimador({ precio }: { precio: number }) {
  const [provincia, setProvincia] = useState('')
  const [cp, setCp] = useState('')
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState('')
  // Se congela al calcular: si el cliente después toca el select, el mapa no
  // tiene que saltar a otra provincia mientras sigue mostrando el precio vieja.
  const [destino, setDestino] = useState('')

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

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
      if (op) {
        setResultado({ nombre: op.nombre, precio: op.precio, tiempo_estimado: op.tiempo_estimado })
        // El CP manda cuando está: es más preciso que el centro de la provincia.
        setDestino([cp.trim(), provincia, 'Argentina'].filter(Boolean).join(', '))
      } else setError('No hay envío disponible para esa zona.')
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

      {resultado && mapsKey && destino && (
        <div className="mt-3 overflow-hidden rounded-xl border border-brand-border">
          <iframe
            title={`Mapa de ${destino}`}
            src={`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${encodeURIComponent(destino)}&zoom=11`}
            className="w-full h-40 block border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      )}

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
