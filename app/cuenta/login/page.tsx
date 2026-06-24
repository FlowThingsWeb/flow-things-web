'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
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
              disabled={loading}
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
