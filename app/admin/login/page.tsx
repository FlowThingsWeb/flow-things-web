'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const conflict = searchParams.get('conflict') === '1'

  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')

  // Si hay conflicto pero la cookie de usuario ya se limpió (ej: recarga tras sign-out),
  // redirigir al login limpio
  useEffect(() => {
    if (!conflict) return
    // Verificar si realmente sigue habiendo sesión
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/admin/login')
      }
    })
  }, [conflict, router])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.replace('/admin/login')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Credenciales incorrectas')
        return
      }

      router.push('/admin')
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-purple flex items-center justify-center mx-auto mb-3 shadow-purple animate-neon-pulse">
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <h1 className="text-xl font-bold text-white">Flow Things</h1>
          <p className="text-brand-text-muted text-sm mt-1">Panel de administración</p>
        </div>

        {/* Conflicto: hay sesión de usuario activa */}
        {conflict ? (
          <div className="bg-brand-bg-card border border-yellow-600/40 rounded-3xl p-8 text-center">
            <span className="text-4xl block mb-4">⚠️</span>
            <h2 className="text-base font-semibold text-white mb-2">
              Sesión de usuario activa
            </h2>
            <p className="text-brand-text-muted text-sm mb-6 leading-relaxed">
              El panel de administración es independiente de tu cuenta de usuario.
              Cerrá la sesión para poder ingresar como admin.
            </p>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {signingOut ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Cerrando sesión...
                </>
              ) : (
                'Cerrar sesión de usuario'
              )}
            </button>
            <a
              href="/"
              className="block mt-3 text-xs text-brand-text-muted hover:text-brand-text transition-colors"
            >
              Volver al inicio
            </a>
          </div>
        ) : (
          /* Formulario normal de admin */
          <div className="bg-brand-bg-card border border-brand-border rounded-3xl p-8">
            <h2 className="text-lg font-semibold text-white mb-6 text-center">Iniciar sesión</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-text-muted mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input-dark"
                  placeholder="admin@flowthings.com.ar"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-text-muted mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="input-dark"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl p-3 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  'Ingresar'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  )
}
