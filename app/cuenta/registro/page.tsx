'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RegistroPage() {
  const router = useRouter()
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
