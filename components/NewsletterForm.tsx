'use client'

import { useState } from 'react'

export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEstado('enviando'); setMsg('')
    try {
      const r = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await r.json()
      if (!r.ok) { setEstado('error'); setMsg(d.error || 'No se pudo suscribir.'); return }
      setEstado('ok')
      setMsg(d.yaSuscripto ? '¡Ya estabas suscripto! 🙌' : '¡Listo! Revisá tu email 🎁')
      setEmail('')
    } catch {
      setEstado('error'); setMsg('Error de conexión.')
    }
  }

  return (
    <div className="bg-brand-bg-soft border border-brand-border rounded-2xl p-6 mb-10">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <p className="font-semibold text-white text-sm">📬 Sumate y llevate 10% off</p>
          <p className="text-brand-text-muted text-xs mt-1">Dejanos tu email y te mandamos un cupón de bienvenida.</p>
        </div>
        {estado === 'ok' ? (
          <p className="text-green-400 text-sm font-medium">{msg}</p>
        ) : (
          <form onSubmit={enviar} className="flex gap-2 w-full md:w-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              aria-label="Tu email"
              className="input-dark text-sm flex-1 md:w-56"
            />
            <button
              type="submit"
              disabled={estado === 'enviando'}
              className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
            >
              {estado === 'enviando' ? '...' : 'Suscribirme'}
            </button>
          </form>
        )}
      </div>
      {estado === 'error' && <p className="text-red-400 text-xs mt-2">{msg}</p>}
    </div>
  )
}
