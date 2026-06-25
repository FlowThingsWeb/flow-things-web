'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import PhoneInput from '@/components/PhoneInput'

function validarDNI(valor: string): boolean {
  const limpio = valor.replace(/\./g, '').trim()
  return /^\d{7,8}$/.test(limpio)
}

function validarFecha(fecha: string): string | null {
  if (!fecha) return null
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return 'Fecha inválida.'
  if (d > new Date()) return 'La fecha de nacimiento no puede ser en el futuro.'
  const hace120 = new Date()
  hace120.setFullYear(hace120.getFullYear() - 120)
  if (d < hace120) return 'Ingresá una fecha válida.'
  return null
}

function CumpleTooltip() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        className="w-4 h-4 rounded-full bg-brand-border text-brand-text-muted text-[10px] font-bold flex items-center justify-center hover:bg-brand-purple hover:text-white transition-colors"
        aria-label="¿Para qué usamos tu fecha de nacimiento?"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-30 w-64 bg-brand-bg-card border border-brand-border text-brand-text-muted text-xs rounded-xl px-3 py-2.5 shadow-lg leading-relaxed">
          🎂 ¡Te mandamos promociones especiales durante tu mes de cumpleaños!
        </div>
      )}
    </div>
  )
}

function CompletarPerfilForm() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/cuenta'

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    dni: '',
    fecha_nacimiento: '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/cuenta/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const nombreGoogle =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      ''
    setForm(f => ({ ...f, nombre: nombreGoogle }))

    supabase
      .from('perfiles')
      .select('nombre, telefono, dni, fecha_nacimiento')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm(f => ({
            nombre: data.nombre || f.nombre,
            telefono: data.telefono || '',
            dni: data.dni || '',
            fecha_nacimiento: data.fecha_nacimiento || '',
          }))
        }
      })
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }

    // Validar que teléfono tenga al menos área + número
    const telPartes = form.telefono.trim().split(' ').filter(Boolean)
    if (telPartes.length < 3) { setError('Ingresá el código de área y el número de teléfono.'); return }

    if (!form.dni.trim()) { setError('El DNI es obligatorio.'); return }
    if (!validarDNI(form.dni)) { setError('El DNI debe tener 7 u 8 dígitos numéricos.'); return }

    if (form.fecha_nacimiento) {
      const err = validarFecha(form.fecha_nacimiento)
      if (err) { setError(err); return }
    }

    setGuardando(true)

    const { error: err } = await supabase.from('perfiles').upsert({
      user_id: user!.id,
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim(),
      dni: form.dni.trim(),
      ...(form.fecha_nacimiento ? { fecha_nacimiento: form.fecha_nacimiento } : {}),
    }, { onConflict: 'user_id' })

    if (err) {
      setError('No se pudo guardar. Intentá de nuevo.')
      setGuardando(false)
      return
    }

    router.push(next)
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-brand-purple flex items-center justify-center text-white text-2xl mx-auto mb-4">
            📋
          </div>
          <h1 className="text-2xl font-bold text-brand-text">Completá tu perfil</h1>
          <p className="text-brand-text-muted text-sm mt-2">
            Necesitamos algunos datos para poder facturar tus compras.
          </p>
        </div>

        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Nombre */}
            <div>
              <label className="block text-xs text-brand-text-muted mb-1">
                Nombre completo <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="input-dark"
                placeholder="Juan Pérez"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                required
                autoFocus
              />
            </div>

            {/* Teléfono dividido */}
            <div>
              <label className="block text-xs text-brand-text-muted mb-1">
                Teléfono <span className="text-red-400">*</span>
              </label>
              <PhoneInput
                value={form.telefono}
                onChange={v => setForm(f => ({ ...f, telefono: v }))}
                required
              />
              <p className="text-[11px] text-brand-text-muted mt-1">
                Código de área sin el 0 (ej: 11 para CABA) · Número sin el 15
              </p>
            </div>

            {/* DNI */}
            <div>
              <label className="block text-xs text-brand-text-muted mb-1 flex items-center gap-1">
                DNI <span className="text-red-400">*</span>
                <span
                  title="Requerido por ARCA para la facturación electrónica."
                  className="ml-1 text-brand-text-muted cursor-help text-xs"
                >
                  ⓘ
                </span>
              </label>
              <input
                type="text"
                className="input-dark"
                placeholder="12345678"
                inputMode="numeric"
                maxLength={10}
                value={form.dni}
                onChange={e => setForm(f => ({ ...f, dni: e.target.value.replace(/\D/g, '') }))}
                required
              />
            </div>

            {/* Fecha de nacimiento */}
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <label className="text-xs text-brand-text-muted">
                  Fecha de nacimiento <span className="text-brand-text-muted">(opcional)</span>
                </label>
                <CumpleTooltip />
              </div>
              <input
                type="date"
                className="input-dark"
                max={new Date().toISOString().split('T')[0]}
                value={form.fecha_nacimiento}
                onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-brand-purple hover:bg-brand-purple-light text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-1"
            >
              {guardando ? 'Guardando...' : 'Continuar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-brand-text-muted mt-4">
          Tus datos son seguros y solo se usan para facturación.
        </p>
      </div>
    </div>
  )
}

export default function CompletarPerfilPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CompletarPerfilForm />
    </Suspense>
  )
}
