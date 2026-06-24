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

export default function RegistroPage() {
  const router = useRouter()
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    password: '',
    passwordConfirm: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (form.password !== form.passwordConfirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { nombre: form.nombre.trim() },
      },
    })

    if (signUpError) {
      setError(signUpError.message.includes('already registered')
        ? 'Ya existe una cuenta con ese email.'
        : 'Ocurrió un error al registrarte. Intentá de nuevo.')
      setLoading(false)
      return
    }

    // Crear perfil en tabla perfiles
    if (data.user) {
      await supabase.from('perfiles').upsert({
        user_id: data.user.id,
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null,
      })
    }

    // Si Supabase no requiere confirmación de email, el usuario queda logueado
    if (data.session) {
      router.push('/cuenta')
      router.refresh()
    } else {
      // Si requiere confirmación, mostramos mensaje
      setSuccess(true)
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <span className="text-5xl block mb-4">📧</span>
          <h2 className="text-xl font-bold text-brand-text mb-2">¡Casi listo!</h2>
          <p className="text-brand-text-muted text-sm mb-6">
            Te enviamos un email para confirmar tu cuenta. Revisá tu bandeja de entrada.
          </p>
          <Link href="/cuenta/login" className="text-brand-purple hover:underline text-sm">
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-white">
            Flow <span className="text-brand-purple">Things</span>
          </Link>
          <p className="text-brand-text-muted text-sm mt-2">Creá tu cuenta y sumá beneficios</p>
        </div>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3 mb-6">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={!!oauthLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 font-semibold py-3 rounded-xl transition-colors border border-gray-200"
          >
            {oauthLoading === 'google' ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Registrarme con Google
          </button>

          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            disabled={!!oauthLoading}
            className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors border border-gray-700"
          >
            {oauthLoading === 'apple' ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <AppleIcon />
            )}
            Registrarme con Apple
          </button>
        </div>

        {/* Divisor */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-brand-border" />
          <span className="text-xs text-brand-text-muted">o con email</span>
          <div className="flex-1 h-px bg-brand-border" />
        </div>

        {/* Beneficios */}
        <div className="bg-brand-bg-soft border border-brand-border rounded-xl px-5 py-4 mb-6 flex flex-col gap-2">
          <p className="text-xs font-semibold text-brand-purple uppercase tracking-wide mb-1">Ventajas de registrarte</p>
          {[
            '🎁 10% de descuento en tu primera compra',
            '❤️ Guardá tus productos favoritos',
            '🛒 Tu carrito se guarda automáticamente',
            '📬 Descuentos y promociones exclusivas',
          ].map(b => (
            <p key={b} className="text-xs text-brand-text-muted">{b}</p>
          ))}
        </div>

        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-brand-text-muted mb-1.5">
                Nombre *
              </label>
              <input
                id="nombre"
                type="text"
                required
                className="input-dark"
                placeholder="Tu nombre"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-brand-text-muted mb-1.5">
                Email *
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
              <label htmlFor="telefono" className="block text-sm font-medium text-brand-text-muted mb-1.5">
                Teléfono <span className="text-brand-text-light text-xs">(opcional)</span>
              </label>
              <input
                id="telefono"
                type="tel"
                className="input-dark"
                placeholder="+54 9 11 1234-5678"
                value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-brand-text-muted mb-1.5">
                Contraseña *
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                className="input-dark"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-brand-text-muted mb-1.5">
                Repetí la contraseña *
              </label>
              <input
                id="passwordConfirm"
                type="password"
                required
                autoComplete="new-password"
                className="input-dark"
                placeholder="••••••••"
                value={form.passwordConfirm}
                onChange={e => setForm(f => ({ ...f, passwordConfirm: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-purple hover:bg-brand-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors mt-1"
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-brand-text-muted mt-6">
            ¿Ya tenés cuenta?{' '}
            <Link href="/cuenta/login" className="text-brand-purple hover:text-brand-purple-light font-medium transition-colors">
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
