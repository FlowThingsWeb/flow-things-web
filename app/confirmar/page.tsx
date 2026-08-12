'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

/**
 * Página pública para reenviar el email de confirmación. El usuario que no
 * confirmó su cuenta ingresa su email y le mandamos un nuevo link (vía
 * Supabase auth.resend). Se enlaza desde la difusión de recordatorio.
 */
export default function ConfirmarPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  async function reenviar(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!value || !value.includes('@')) {
      setMsg({ ok: false, texto: 'Ingresá un email válido.' })
      return
    }
    setLoading(true)
    setMsg(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email: value })
    setLoading(false)
    if (error) {
      // Si ya está confirmada, Supabase devuelve error — lo tratamos amable.
      setMsg({
        ok: false,
        texto:
          'No pudimos reenviar el link. Puede que tu cuenta ya esté confirmada (probá iniciar sesión) o que haya que esperar unos minutos.',
      })
    } else {
      setMsg({ ok: true, texto: '✓ ¡Listo! Te enviamos un nuevo link de confirmación. Revisá tu bandeja de entrada (y el spam).' })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-brand-bg">
      <div className="w-full max-w-md bg-brand-bg-card border border-brand-border rounded-2xl p-8">
        <div className="text-center mb-6">
          <span className="text-4xl">🎁</span>
          <h1 className="text-2xl font-bold text-white mt-3">Confirmá tu email</h1>
          <p className="text-brand-text-muted text-sm mt-2">
            Confirmá tu cuenta para activar tu <strong className="text-brand-neon">10% OFF</strong> de bienvenida.
            Ingresá tu email y te reenviamos el link.
          </p>
        </div>

        <form onSubmit={reenviar} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-brand-text-muted mb-1.5">Tu email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark w-full"
              placeholder="tucorreo@ejemplo.com"
              autoComplete="email"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            {loading ? 'Reenviando…' : 'Reenviar link de confirmación'}
          </button>
        </form>

        {msg && (
          <p className={`text-sm mt-4 text-center ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.texto}</p>
        )}

        <div className="mt-6 text-center">
          <Link href="/cuenta/login" className="text-xs text-brand-text-muted hover:text-white">
            ¿Ya confirmaste? Iniciá sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
