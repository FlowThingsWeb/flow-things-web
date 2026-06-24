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

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    })

    if (error) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
      return
    }

    router.push('/cuenta')
    router.refresh()
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setOauthLoading(provider)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/cuenta`,
      },
    })

    if (error) {
      setError('No se pudo conectar con ' + (provider === 'google' ? 'Google' : 'Apple') + '. Intentá de nuevo.')
      setOauthLoading(null)
    }
    // Si no hay error, el browser redirige → no limpiamos el estado
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
          <div className="flex flex-col gap-3 mb-6">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
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

            <button
              type="button"
              onClick={() => handleOAuth('apple')}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors border border-gray-700"
            >
              {oauthLoading === 'apple' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <AppleIcon />
              )}
              Continuar con Apple
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

            <button
              type="submit"
              disabled={loading || !!oauthLoading}
              className="w-full bg-brand-purple hover:bg-brand-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
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
