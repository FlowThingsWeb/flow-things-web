'use client'

import { useState } from 'react'

/**
 * `url` es el prefijo del link de seguimiento y `concatena` dice si el código
 * va pegado al final. Con los que concatenan, el link se arma solo mientras se
 * tipea el código: antes había que acordarse de pegarlo a mano y el mail salía
 * con el link a la home del correo, donde el comprador no encuentra nada.
 *
 * Andreani cambió el formato: el viejo `/#!/informacion/rastreo/` ya no abre el
 * envío. Ahora es `https://www.andreani.com/envio/<código>`.
 */
const COURIERS = [
  { value: 'OCA', label: 'OCA', url: 'https://www.oca.com.ar/tracking?tipo=I&nropieza=', concatena: true },
  { value: 'Andreani', label: 'Andreani', url: 'https://www.andreani.com/envio/', concatena: true },
  { value: 'Correo Argentino', label: 'Correo Argentino', url: 'https://www.correoargentino.com.ar/formularios/ondp?id=', concatena: true },
  { value: 'Cabify Logistics', label: 'Cabify Logistics', url: 'https://cabifylogistics.com/ar/seguimiento-de-envios', concatena: false },
  { value: 'Cabify (app)', label: 'Cabify (app viaje)', url: '', concatena: false },
  { value: 'Retiro en local', label: 'Retiro en local', url: '', concatena: false },
  { value: 'Otro', label: 'Otro', url: '', concatena: false },
]

export default function DespacharForm({
  ordenId,
  emailComprador,
  yaEnviado,
}: {
  ordenId: string
  emailComprador?: string
  yaEnviado?: boolean
}) {
  const [courier, setCourier]         = useState('')
  const [trackingNum, setTrackingNum] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  /** Si el link se tocó a mano, el armado automático deja de pisarlo. */
  const [urlEditada, setUrlEditada]   = useState(false)
  const [sending, setSending]         = useState(false)
  const [msg, setMsg]                 = useState('')

  const selectedCourier = COURIERS.find(c => c.value === courier)

  /** Link completo para un courier y un código, si el courier concatena. */
  const armarUrl = (val: string, codigo: string) => {
    const c = COURIERS.find(c => c.value === val)
    if (!c?.url) return ''
    return c.concatena ? c.url + codigo.trim() : c.url
  }

  const handleCourierChange = (val: string) => {
    setCourier(val)
    setUrlEditada(false)
    setTrackingUrl(armarUrl(val, trackingNum))
  }

  const handleTrackingNumChange = (val: string) => {
    setTrackingNum(val)
    // El link sigue al código salvo que se lo haya escrito a mano.
    if (!urlEditada) setTrackingUrl(armarUrl(courier, val))
  }

  const handleSubmit = async () => {
    if (!courier || !trackingNum) return

    // Validar que tracking_url sea una URL real (https:// o vacío)
    if (trackingUrl && !/^https?:\/\//.test(trackingUrl)) {
      setMsg('❌ La URL de tracking debe empezar con https://')
      return
    }

    setSending(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/ordenes/despachar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordenId,
          courier,
          tracking_numero: trackingNum,
          tracking_url: trackingUrl || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconocido')
      setMsg('✅ Email enviado a ' + (emailComprador || 'el cliente'))
    } catch (e: unknown) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'Error'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
      <h2 className="font-semibold text-white text-sm uppercase tracking-wide mb-1">🚚 Marcar como despachado</h2>
      <p className="text-brand-text-muted text-xs mb-5">
        Se enviará el email de despacho con los datos de seguimiento a{' '}
        <span className="text-white">{emailComprador || 'el cliente'}</span>.
      </p>

      <div className="space-y-4">

        {/* Courier selector */}
        <div>
          <label className="block text-white text-sm font-medium mb-1.5">Empresa de envío</label>
          <select
            value={courier}
            onChange={e => handleCourierChange(e.target.value)}
            className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-purple"
          >
            <option value="">Seleccioná...</option>
            {COURIERS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Cabify note */}
        {courier === 'Cabify (app viaje)' && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 text-xs text-yellow-300 leading-relaxed">
            <strong>Nota sobre Cabify consumer:</strong> cuando pedís un envío desde la app de Cabify,
            podés compartir el link de seguimiento en vivo <em>mientras el viaje está activo</em>.
            Una vez entregado el paquete, ese link expira. Si usás Cabify para envíos frecuentes,
            considerá migrar a <strong>Cabify Logistics</strong> (B2B) que genera un código de tracking persistente
            en <a href="https://cabifylogistics.com/ar/seguimiento-de-envios" target="_blank" className="underline">cabifylogistics.com</a>.
          </div>
        )}

        {/* Tracking number */}
        <div>
          <label className="block text-white text-sm font-medium mb-1.5">
            {courier === 'Retiro en local' ? 'Comentario / instrucciones' : 'Número / código de seguimiento'}
          </label>
          <input
            value={trackingNum}
            onChange={e => handleTrackingNumChange(e.target.value)}
            placeholder={
              courier === 'Cabify (app viaje)'
                ? 'Ej: Tu pedido llega hoy entre las 15 y 18hs'
                : courier === 'Retiro en local'
                ? 'Ej: Pasá por Av. Gallardo 160, lunes a sábado 10-18hs'
                : 'Ej: 123456789'
            }
            className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-purple placeholder:text-brand-text-muted"
          />
        </div>

        {/* Tracking URL */}
        <div>
          <label className="block text-white text-sm font-medium mb-1.5">
            Link de seguimiento{' '}
            <span className="text-brand-text-muted font-normal">(opcional — aparece como botón en el email)</span>
          </label>
          <input
            value={trackingUrl}
            onChange={e => { setUrlEditada(true); setTrackingUrl(e.target.value) }}
            placeholder="https://..."
            className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-purple placeholder:text-brand-text-muted font-mono"
          />
          {selectedCourier?.concatena && (
            <p className="text-brand-text-muted text-xs mt-1">
              💡 El link se arma solo con el código que pongas arriba. Editalo si hace falta.
            </p>
          )}
          {selectedCourier?.url && !selectedCourier.concatena && (
            <p className="text-brand-text-muted text-xs mt-1">
              💡 Este correo no rastrea por código en la URL: el link va a su página de seguimiento.
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={sending || !courier || !trackingNum}
          className="w-full bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          {sending ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Enviando...</>
          ) : (
            yaEnviado ? '🔄 Re-enviar email de despacho' : '✉️ Enviar email de despacho al cliente'
          )}
        </button>

        {msg && (
          <p className={`text-sm font-medium text-center ${msg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
            {msg}
          </p>
        )}
      </div>
    </div>
  )
}
