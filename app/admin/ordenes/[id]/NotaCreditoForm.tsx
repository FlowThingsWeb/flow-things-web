'use client'

import { useState } from 'react'

/**
 * Emitir la nota de crédito que anula la factura de esta orden.
 *
 * Pide confirmación escrita y no un simple click: emitir es irreversible —el
 * comprobante queda en AFIP— y no hay NC parcial, así que lo que sale es
 * siempre el total de la orden.
 */
export default function NotaCreditoForm({
  ordenId,
  emailComprador,
  total,
}: {
  ordenId: string
  emailComprador?: string
  total: string
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  const emitir = async () => {
    setSending(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/nota-credito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordenId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconocido')
      setMsg(
        data.emailEnviado
          ? `✅ Nota de crédito ${data.numero} emitida y enviada a ${emailComprador || 'el cliente'}. CAE ${data.cae}`
          : `⚠️ Nota de crédito ${data.numero} emitida (CAE ${data.cae}), pero el mail no salió: ${data.emailError}`,
      )
      setConfirmando(false)
      // La página es server-side: hay que recargarla para ver la NC guardada.
      setTimeout(() => window.location.reload(), 2500)
    } catch (e: unknown) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'Error'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-brand-bg-card border border-yellow-700/50 rounded-2xl p-6 mb-5">
      <h2 className="font-semibold text-yellow-400 text-sm uppercase tracking-wide mb-1">
        🧾 Emitir nota de crédito
      </h2>
      <p className="text-brand-text-muted text-xs mb-5">
        Anula la factura de esta orden por <span className="text-white">{total}</span> y le manda
        el PDF a <span className="text-white">{emailComprador || 'el cliente'}</span>. No devuelve
        plata: el reintegro se hace en Mercado Pago.
      </p>

      {!confirmando ? (
        <button
          onClick={() => setConfirmando(true)}
          className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          Emitir nota de crédito
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-yellow-300">
            Se emite contra AFIP por el <strong>total</strong> de la orden y es{' '}
            <strong>irreversible</strong>. ¿Confirmás?
          </p>
          <div className="flex gap-2">
            <button
              onClick={emitir}
              disabled={sending}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              {sending ? 'Emitiendo…' : 'Sí, emitir'}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              disabled={sending}
              className="border border-brand-border text-brand-text-muted hover:text-white text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {msg && <p className="mt-4 text-sm text-white">{msg}</p>}
    </div>
  )
}
