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
  // Mínimos de cuotas sin interés (deben coincidir con el panel de MP).
  const [cuotas, setCuotas] = useState({ c2: '95000', c3: '115000', c6: '311000' })
  // Envío por cercanía (km) — reemplaza CABA/AMBA cuando está activo.
  const [km, setKm] = useState({
    activo: false,
    origen: '',
    base: '2000',
    por_km: '400',
    gratis_desde: '40000',
    radio_max: '20',
    nombre: 'Envío a domicilio',
    tiempo: 'Coordinamos el día de entrega',
  })
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
        // Cuotas sin interés: se guardan como JSON [{cuotas,min}].
        try {
          const planes = JSON.parse(cfg.cuotas_sin_interes || '[]') as { cuotas: number; min: number }[]
          const get = (n: number) => planes.find(p => Number(p.cuotas) === n)?.min
          setCuotas({
            c2: String(get(2) ?? 95000),
            c3: String(get(3) ?? 115000),
            c6: String(get(6) ?? 311000),
          })
        } catch { /* deja los defaults */ }
        setKm({
          activo: cfg.envio_km_activo === '1',
          origen: cfg.envio_km_origen ?? '',
          base: cfg.envio_km_base || '2000',
          por_km: cfg.envio_km_por_km || '400',
          gratis_desde: cfg.envio_km_gratis_desde || '40000',
          radio_max: cfg.envio_km_radio_max || '20',
          nombre: cfg.envio_km_nombre || 'Envío a domicilio',
          tiempo: cfg.envio_km_tiempo || 'Coordinamos el día de entrega',
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
        cuotas_sin_interes: JSON.stringify([
          { cuotas: 2, min: Number(cuotas.c2) || 0 },
          { cuotas: 3, min: Number(cuotas.c3) || 0 },
          { cuotas: 6, min: Number(cuotas.c6) || 0 },
        ]),
        envio_km_activo: km.activo ? '1' : '0',
        envio_km_origen: km.origen,
        envio_km_base: km.base,
        envio_km_por_km: km.por_km,
        envio_km_gratis_desde: km.gratis_desde,
        envio_km_radio_max: km.radio_max,
        envio_km_nombre: km.nombre,
        envio_km_tiempo: km.tiempo,
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

      {/* Envío por cercanía (km) — reemplaza CABA/AMBA */}
      <div className="mb-6 bg-brand-bg-card border border-brand-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📍</span>
            <div>
              <h2 className="font-semibold text-white">Envío por cercanía (por km)</h2>
              <p className="text-xs text-brand-text-muted">
                Cuando está activo, el envío a <strong>CABA y AMBA</strong> se cobra por
                distancia desde tu local (base + $/km). El resto del país sigue con las
                tarifas planas de abajo.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={km.activo}
              onChange={e => setKm({ ...km, activo: e.target.checked })}
              className="w-4 h-4 accent-brand-purple"
            />
            <span className="text-sm text-brand-text">{km.activo ? 'Activo' : 'Inactivo'}</span>
          </label>
        </div>

        <div className="mb-5 rounded-lg border border-yellow-600/30 bg-yellow-500/10 p-3">
          <p className="text-xs text-yellow-300/90">
            ⚠️ Requiere las API keys de Google Maps cargadas en Vercel
            (<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> y <code>GOOGLE_MAPS_API_KEY</code>).
            Si una dirección queda fuera del radio máximo o no se puede ubicar, se usa la
            tarifa plana de CABA/AMBA.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
              Dirección de tu local (origen)
            </label>
            <input
              type="text"
              value={km.origen}
              onChange={e => setKm({ ...km, origen: e.target.value })}
              className="input-dark w-full"
              placeholder="Federico Lacroze 3885, CABA"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
              Tarifa base ($)
            </label>
            <input type="number" min="0" value={km.base}
              onChange={e => setKm({ ...km, base: e.target.value })}
              className="input-dark w-full" placeholder="2000" />
            {km.base && <p className="text-xs text-brand-neon mt-1">{formatPrecio(km.base)}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
              Costo por km ($)
            </label>
            <input type="number" min="0" value={km.por_km}
              onChange={e => setKm({ ...km, por_km: e.target.value })}
              className="input-dark w-full" placeholder="400" />
            {km.por_km && <p className="text-xs text-brand-neon mt-1">{formatPrecio(km.por_km)} / km</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
              Envío gratis desde ($)
            </label>
            <input type="number" min="0" value={km.gratis_desde}
              onChange={e => setKm({ ...km, gratis_desde: e.target.value })}
              className="input-dark w-full" placeholder="40000" />
            {Number(km.gratis_desde) > 0
              ? <p className="text-xs text-green-400 mt-1">Gratis desde {formatPrecio(km.gratis_desde)}</p>
              : <p className="text-xs text-brand-text-light mt-1">Sin envío gratis</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
              Radio máximo (km)
            </label>
            <input type="number" min="0" value={km.radio_max}
              onChange={e => setKm({ ...km, radio_max: e.target.value })}
              className="input-dark w-full" placeholder="20" />
            <p className="text-xs text-brand-text-light mt-1">Más lejos → tarifa plana. 0 = sin límite.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
              Nombre mostrado
            </label>
            <input type="text" value={km.nombre}
              onChange={e => setKm({ ...km, nombre: e.target.value })}
              className="input-dark w-full" placeholder="Envío a domicilio" />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
              Tiempo estimado
            </label>
            <input type="text" value={km.tiempo}
              onChange={e => setKm({ ...km, tiempo: e.target.value })}
              className="input-dark w-full" placeholder="Coordinamos el día de entrega" />
          </div>
        </div>
        {km.base && km.por_km && (
          <p className="text-xs text-brand-text-muted mt-4">
            Ejemplo: una dirección a 6 km costaría{' '}
            <strong className="text-brand-text">
              {formatPrecio(String(Math.round((Number(km.base) + Number(km.por_km) * 6) / 100) * 100))}
            </strong>.
          </p>
        )}
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

      {/* Cuotas sin interés */}
      <div className="mt-8 bg-brand-bg-card border border-brand-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">💳</span>
          <div>
            <h2 className="font-semibold text-white">Cuotas sin interés</h2>
            <p className="text-xs text-brand-text-muted">
              Desde qué monto se ofrece cada plan sin interés. La web lo muestra en
              el producto y el carrito.
            </p>
          </div>
        </div>
        <div className="mb-5 rounded-lg border border-yellow-600/30 bg-yellow-500/10 p-3">
          <p className="text-xs text-yellow-300/90">
            ⚠️ Estos valores tienen que coincidir con los mínimos que cargaste en
            Mercado Pago (Costos y cuotas). Si los cambiás allá, actualizalos acá.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            ['2 cuotas sin interés desde ($)', 'c2', '95000'],
            ['3 cuotas sin interés desde ($)', 'c3', '115000'],
            ['6 cuotas sin interés desde ($)', 'c6', '311000'],
          ] as const).map(([label, key, ph]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-brand-text-muted mb-1.5">
                {label}
              </label>
              <input
                type="number"
                min="0"
                value={cuotas[key]}
                onChange={e => setCuotas({ ...cuotas, [key]: e.target.value })}
                className="input-dark w-full"
                placeholder={ph}
              />
              {cuotas[key] && Number(cuotas[key]) > 0 && (
                <p className="text-xs text-green-400 mt-1">
                  Desde {formatPrecio(cuotas[key])}
                </p>
              )}
            </div>
          ))}
        </div>
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
