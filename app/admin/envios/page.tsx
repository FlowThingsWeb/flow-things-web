'use client'

import { useState, useEffect } from 'react'

function formatPrecio(val: string) {
  const n = Number(val)
  if (isNaN(n)) return val
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

interface ZonaConfig {
  precio: string
  gratis_desde: string
  tiempo: string
}

const DEFAULTS = {
  caba: { precio: '2500', gratis_desde: '40000', tiempo: '24-48 hs hábiles' },
  amba: { precio: '3500', gratis_desde: '60000', tiempo: '48-72 hs hábiles' },
  bsas: { precio: '5000', gratis_desde: '90000', tiempo: '3-5 días hábiles' },
  interior: { precio: '6000', gratis_desde: '120000', tiempo: '3-7 días hábiles' },
}

export default function EnviosAdminPage() {
  const [caba, setCaba] = useState<ZonaConfig>(DEFAULTS.caba)
  const [amba, setAmba] = useState<ZonaConfig>(DEFAULTS.amba)
  const [bsas, setBsas] = useState<ZonaConfig>(DEFAULTS.bsas)
  const [interior, setInterior] = useState<ZonaConfig>(DEFAULTS.interior)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(data => {
        const rows: { clave: string; valor: string }[] = data.data || []
        const cfg: Record<string, string> = Object.fromEntries(rows.map(r => [r.clave, r.valor]))
        setCaba({
          precio: cfg.envio_precio_caba || DEFAULTS.caba.precio,
          gratis_desde: cfg.envio_gratis_caba_desde || DEFAULTS.caba.gratis_desde,
          tiempo: cfg.envio_tiempo_caba || DEFAULTS.caba.tiempo,
        })
        // AMBA y Resto BA: si no tienen su propia config, heredan del valor viejo 'gba'.
        setAmba({
          precio: cfg.envio_precio_amba || cfg.envio_precio_gba || DEFAULTS.amba.precio,
          gratis_desde: cfg.envio_gratis_amba_desde || cfg.envio_gratis_gba_desde || DEFAULTS.amba.gratis_desde,
          tiempo: cfg.envio_tiempo_amba || cfg.envio_tiempo_gba || DEFAULTS.amba.tiempo,
        })
        setBsas({
          precio: cfg.envio_precio_bsas || cfg.envio_precio_gba || DEFAULTS.bsas.precio,
          gratis_desde: cfg.envio_gratis_bsas_desde || cfg.envio_gratis_gba_desde || DEFAULTS.bsas.gratis_desde,
          tiempo: cfg.envio_tiempo_bsas || DEFAULTS.bsas.tiempo,
        })
        setInterior({
          precio: cfg.envio_precio_interior || DEFAULTS.interior.precio,
          gratis_desde: cfg.envio_gratis_interior_desde || DEFAULTS.interior.gratis_desde,
          tiempo: cfg.envio_tiempo_interior || DEFAULTS.interior.tiempo,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const updates = {
        envio_precio_caba: caba.precio,
        envio_gratis_caba_desde: caba.gratis_desde,
        envio_tiempo_caba: caba.tiempo,
        envio_precio_amba: amba.precio,
        envio_gratis_amba_desde: amba.gratis_desde,
        envio_tiempo_amba: amba.tiempo,
        envio_precio_bsas: bsas.precio,
        envio_gratis_bsas_desde: bsas.gratis_desde,
        envio_tiempo_bsas: bsas.tiempo,
        envio_precio_interior: interior.precio,
        envio_gratis_interior_desde: interior.gratis_desde,
        envio_tiempo_interior: interior.tiempo,
      }

      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      if (!res.ok) throw new Error('Error al guardar')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Configuración de envíos</h1>
        <p className="text-brand-text-muted mt-1 text-sm">
          Definí el costo de envío y el mínimo para envío gratis por zona.
        </p>
      </div>

      <div className="space-y-6">
        {/* CABA */}
        <ZonaCard
          titulo="CABA"
          subtitulo="Ciudad Autónoma de Buenos Aires"
          emoji="🏙️"
          config={caba}
          onChange={setCaba}
        />

        {/* AMBA */}
        <ZonaCard
          titulo="AMBA"
          subtitulo="Conurbano bonaerense — 1er y 2do cordón (Gran Buenos Aires)"
          emoji="🏘️"
          config={amba}
          onChange={setAmba}
        />

        {/* Resto Buenos Aires */}
        <ZonaCard
          titulo="Resto de Buenos Aires"
          subtitulo="Provincia de Buenos Aires fuera del conurbano (La Plata, Mar del Plata, etc.)"
          emoji="🌾"
          config={bsas}
          onChange={setBsas}
        />

        {/* Interior */}
        <ZonaCard
          titulo="Resto del país"
          subtitulo="Todas las demás provincias"
          emoji="🗺️"
          config={interior}
          onChange={setInterior}
        />
      </div>

      {/* Nota */}
      <div className="mt-6 bg-brand-bg-soft border border-brand-border rounded-xl p-4">
        <p className="text-xs text-brand-text-muted">
          💡 <strong className="text-brand-text">Envío gratis:</strong> si el cliente supera el monto mínimo al momento de calcular el envío, el costo se muestra como $0. Poné <strong>0</strong> para desactivarlo.
        </p>
      </div>

      {/* Guardar */}
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-xl transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar cambios'
          )}
        </button>

        {saved && (
          <span className="text-green-400 text-sm font-medium flex items-center gap-1.5">
            ✅ Guardado correctamente
          </span>
        )}

        {error && (
          <span className="text-red-400 text-sm">{error}</span>
        )}
      </div>
    </div>
  )
}

function ZonaCard({
  titulo,
  subtitulo,
  emoji,
  config,
  onChange,
}: {
  titulo: string
  subtitulo: string
  emoji: string
  config: ZonaConfig
  onChange: (c: ZonaConfig) => void
}) {
  return (
    <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h2 className="font-semibold text-white">{titulo}</h2>
          <p className="text-xs text-brand-text-muted">{subtitulo}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
            Costo de envío ($)
          </label>
          <input
            type="number"
            min="0"
            value={config.precio}
            onChange={e => onChange({ ...config, precio: e.target.value })}
            className="input-dark w-full"
            placeholder="2500"
          />
          {config.precio && (
            <p className="text-xs text-brand-neon mt-1">{formatPrecio(config.precio)}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
            Envío gratis desde ($)
          </label>
          <input
            type="number"
            min="0"
            value={config.gratis_desde}
            onChange={e => onChange({ ...config, gratis_desde: e.target.value })}
            className="input-dark w-full"
            placeholder="40000"
          />
          {config.gratis_desde && Number(config.gratis_desde) > 0 && (
            <p className="text-xs text-green-400 mt-1">Gratis desde {formatPrecio(config.gratis_desde)}</p>
          )}
          {Number(config.gratis_desde) === 0 && (
            <p className="text-xs text-brand-text-light mt-1">Sin envío gratis</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
            Tiempo estimado
          </label>
          <input
            type="text"
            value={config.tiempo}
            onChange={e => onChange({ ...config, tiempo: e.target.value })}
            className="input-dark w-full"
            placeholder="24-48 hs hábiles"
          />
        </div>
      </div>
    </div>
  )
}
