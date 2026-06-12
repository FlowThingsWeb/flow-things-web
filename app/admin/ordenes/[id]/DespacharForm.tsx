'use client'

import { useState } from 'react'

const COURIERS = [
  { value: 'OCA', label: 'OCA', url: 'https://www.oca.com.ar/tracking?tipo=I&nropieza=' },
  { value: 'Andreani', label: 'Andreani', url: 'https://www.andreani.com/#!/informacion/rastreo/' },
  { value: 'Correo Argentino', label: 'Correo Argentino', url: 'https://www.correoargentino.com.ar/formularios/ondp?id=' },
  { value: 'Cabify Logistics', label: 'Cabify Logistics', url: 'https://cabifylogistics.com/ar/seguimiento-de-envios' },
  { value: 'Cabify (app)', label: 'Cabify (app viaje)', url: '' },
  { value: 'Retiro en local', label: 'Retiro en local', url: '' },
  { value: 'Otro', label: 'Otro', url: '' },
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
  const [sending, setSending]         = useState(false)
  const [msg, setMsg]                 = useState('')

  const selectedCourier = COURIERS.find(c => c.value === courier)

  const handleCourierChange = (val: string) => {
    setCourier(val)
    const c = COURIERS.find(c => c.value === val)
    // Pre-fill tracking URL with courier base URL
    if (c?.url) {
      setTrackingUrl(c.url)
    } else {
      setTrackingUrl('')
    }
  }

  const handleSubmit = async () => {
    if (!courier || !trackingNum) return
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
            onChange={e => setTrackingNum(e.target.value)}
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
            onChange={e => setTrackingUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-purple placeholder:text-brand-text-muted font-mono"
          />
          {selectedCourier?.url && courier !== 'Cabify (app viaje)' && (
            <p className="text-brand-text-muted text-xs mt-1">
              💡 Agregá el número al final de la URL para que el cliente pueda rastrear directamente.
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
