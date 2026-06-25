'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function ResetForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  // Supabase redirige aquí con un token en el hash (#access_token=...)
  // onAuthStateChange lo detecta como 'PASSWORD_RECOVERY'
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('No se pudo actualizar la contraseña. El link puede haber expirado.')
    } else {
      setDone(true)
      setTimeout(() => router.push('/cuenta'), 3000)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="text-center">
        <span className="text-4xl block mb-4">✅</span>
        <h2 className="text-lg font-semibold text-white mb-2">Contraseña actualizada</h2>
        <p className="text-brand-text-muted text-sm">Redirigiendo a tu cuenta...</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-brand-text-muted text-sm">Verificando el link...</p>
        <p className="text-brand-text-muted text-xs mt-2">
          Si este mensaje no desaparece, el link puede haber expirado.{' '}
          <Link href="/cuenta/login" className="text-brand-purple hover:underline">Volver al login</Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <h2 className="text-lg font-semibold text-white mb-6 text-center">Nueva contraseña</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-brand-text-muted mb-1">Contraseña nueva</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="input-dark"
            placeholder="Mínimo 6 caracteres"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-text-muted mb-1">Repetir contraseña</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="input-dark"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-purple hover:bg-brand-purple-light disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {loading ? 'Guardando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-white">
            Flow <span className="text-brand-purple">Things</span>
          </Link>
        </div>
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-8">
          <Suspense fallback={
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
