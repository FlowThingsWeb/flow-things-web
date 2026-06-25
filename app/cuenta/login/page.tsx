'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}


export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleForgotPassword() {
    if (!form.email.trim()) {
      setError('Escribí tu email arriba y luego hacé clic en "Olvidé mi contraseña".')
      return
    }
    setResetLoading(true)
    setError('')
    await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: `${window.location.origin}/cuenta/reset-password`,
    })
    // Siempre mostrar éxito para no revelar si el email existe
    setResetSent(true)
    setResetLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('email not confirmed')) {
        setError('Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada.')
      } else if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password')) {
        setError('Email o contraseña incorrectos.')
      } else if (msg.includes('too many requests')) {
        setError('Demasiados intentos. Esperá unos minutos antes de volver a intentar.')
      } else {
        setError('No se pudo iniciar sesión. Intentá de nuevo.')
      }
      setLoading(false)
      return
    }

    router.push('/cuenta')
    router.refresh()
  }

  async function handleGoogle() {
    setOauthLoading('google')
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/cuenta`,
      },
    })

    if (error) {
      setError('No se pudo conectar con Google. Intentá de nuevo.')
      setOauthLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Logo / título */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-white">
            Flow <span className="text-brand-purple">Things</span>
          </Link>
          <p className="text-brand-text-muted text-sm mt-2">Iniciá sesión en tu cuenta</p>
        </div>

        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-8">
          {/* OAuth buttons */}
          <div className="mb-6">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 font-semibold py-3 rounded-xl transition-colors border border-gray-200"
            >
              {oauthLoading === 'google' ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continuar con Google
            </button>
          </div>

          {/* Divisor */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="text-xs text-brand-text-muted">o con email</span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          {/* Form email/password */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-brand-text-muted mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input-dark"
                placeholder="tu@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-brand-text-muted mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="input-dark"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            {resetSent && (
              <p className="text-green-400 text-sm text-center bg-green-900/20 border border-green-500/30 rounded-xl px-3 py-2">
                📧 Si ese email existe, te enviamos el link para restablecer tu contraseña.
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !!oauthLoading}
              className="w-full bg-brand-purple hover:bg-brand-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading || loading}
              className="w-full text-brand-text-muted hover:text-brand-text text-sm transition-colors disabled:opacity-50"
            >
              {resetLoading ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
            </button>
          </form>

          <p className="text-center text-sm text-brand-text-muted mt-6">
            ¿No tenés cuenta?{' '}
            <Link href="/cuenta/registro" className="text-brand-purple hover:text-brand-purple-light font-medium transition-colors">
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
