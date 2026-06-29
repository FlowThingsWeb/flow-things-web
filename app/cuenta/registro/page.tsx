'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PhoneInput from '@/components/PhoneInput'

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

function validarDNI(dni: string): boolean {
  const limpio = (dni || '').replace(/\./g, '').trim()
  return /^\d{7,8}$/.test(limpio)
}

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


export default function RegistroPage() {
  const router = useRouter()
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    dni: '',
    fecha_nacimiento: '',
    password: '',
    passwordConfirm: '',
    direccion: '',
    ciudad: '',
    provincia: '',
    codigo_postal: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const registeredEmail = useRef('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

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

    if (form.dni && !validarDNI(form.dni)) {
      setError('El DNI debe tener 7 u 8 dígitos numéricos, sin puntos.')
      return
    }

    if (form.fecha_nacimiento) {
      const d = new Date(form.fecha_nacimiento)
      if (isNaN(d.getTime()) || d > new Date()) {
        setError('La fecha de nacimiento no puede ser en el futuro.')
        return
      }
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { nombre: form.nombre.trim(), apellido: form.apellido.trim() },
      },
    })

    if (signUpError) {
      const msg = signUpError.message
      setError(
        msg.includes('already registered') ? 'Ya existe una cuenta con ese email.' :
        msg.includes('rate limit') || msg.includes('email rate') ? 'Límite de emails alcanzado. Esperá unos minutos e intentá de nuevo.' :
        msg.includes('signup') && msg.includes('disabled') ? 'El registro está deshabilitado temporalmente.' :
        msg
      )
      setLoading(false)
      return
    }

    // Supabase devuelve éxito falso si el email ya existe (email enumeration protection)
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('Ya existe una cuenta con ese email.')
      setLoading(false)
      return
    }

    // Crear perfil en tabla perfiles
    if (data.user) {
      await supabase.from('perfiles').upsert({
        user_id: data.user.id,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || null,
        telefono: form.telefono.trim() || null,
        dni: form.dni.trim() || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
      })

      // Guardar dirección si fue completada
      if (form.direccion.trim() && form.ciudad.trim() && form.provincia) {
        await supabase.from('direcciones_guardadas').insert({
          user_id: data.user.id,
          etiqueta: 'Casa',
          direccion: form.direccion.trim(),
          ciudad: form.ciudad.trim(),
          provincia: form.provincia,
          codigo_postal: form.codigo_postal.trim(),
          es_principal: true,
        })
      }
    }

    if (data.session) {
      router.push('/cuenta')
      router.refresh()
    } else {
      registeredEmail.current = form.email.trim()
      setSuccess(true)
    }

    setLoading(false)
  }

  async function handleResend() {
    if (!registeredEmail.current) return
    setResendLoading(true)
    setResendMsg('')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: registeredEmail.current,
    })
    setResendLoading(false)
    if (error) {
      setResendMsg('No se pudo reenviar el email. Intentá de nuevo en unos minutos.')
    } else {
      setResendMsg('✓ Email reenviado. Revisá tu bandeja de entrada.')
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-bold text-white">
              Flow <span className="text-brand-purple">Things</span>
            </Link>
          </div>

          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-8 text-center">
            {/* Ícono animado */}
            <div className="w-16 h-16 rounded-full bg-brand-purple/15 border border-brand-purple/30 flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl">📧</span>
            </div>

            <h2 className="text-xl font-bold text-brand-text mb-2">¡Revisá tu email!</h2>
            <p className="text-brand-text-muted text-sm mb-1">
              Te enviamos un link de confirmación a:
            </p>
            <p className="text-brand-neon font-mono text-sm font-semibold mb-6 truncate">
              {registeredEmail.current}
            </p>

            {/* Pasos */}
            <div className="bg-brand-bg-soft border border-brand-border rounded-xl px-5 py-4 text-left mb-6 flex flex-col gap-3">
              {[
                ['1', 'Abrí tu email', 'Buscá un mensaje de Flow Things.'],
                ['2', 'Hacé clic en "Confirmar cuenta"', 'Vas a quedar logueado automáticamente.'],
                ['3', 'Si no llega en 5 min', 'Revisá la carpeta de spam o correo no deseado.'],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-brand-purple/20 text-brand-purple text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {num}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-brand-text">{title}</p>
                    <p className="text-xs text-brand-text-muted">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Botón reenviar */}
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="w-full border border-brand-border hover:border-brand-purple text-brand-text-muted hover:text-brand-text text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {resendLoading ? 'Reenviando...' : 'Reenviar email de confirmación'}
            </button>

            {resendMsg && (
              <p className={`text-xs mb-3 ${resendMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {resendMsg}
              </p>
            )}

            <Link href="/cuenta/login" className="text-brand-text-muted hover:text-brand-purple text-sm transition-colors">
              ← Volver al inicio de sesión
            </Link>
          </div>
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
        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoogle}
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
            <div className="grid grid-cols-2 gap-3">
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
                <label htmlFor="apellido" className="block text-sm font-medium text-brand-text-muted mb-1.5">
                  Apellido *
                </label>
                <input
                  id="apellido"
                  type="text"
                  required
                  className="input-dark"
                  placeholder="Tu apellido"
                  value={form.apellido}
                  onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                />
              </div>
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
              <label className="block text-sm font-medium text-brand-text-muted mb-1.5">
                Teléfono *
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

            <div>
              <label htmlFor="dni" className="block text-sm font-medium text-brand-text-muted mb-1.5">
                DNI *
              </label>
              <input
                id="dni"
                type="text"
                required
                className="input-dark"
                placeholder="12345678"
                inputMode="numeric"
                maxLength={10}
                value={form.dni}
                onChange={e => setForm(f => ({ ...f, dni: e.target.value.replace(/\D/g, '') }))}
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label htmlFor="fecha_nacimiento" className="text-sm font-medium text-brand-text-muted">
                  Fecha de nacimiento <span className="text-brand-text-light text-xs">(opcional)</span>
                </label>
                <CumpleTooltip />
              </div>
              <input
                id="fecha_nacimiento"
                type="date"
                className="input-dark"
                max={new Date().toISOString().split('T')[0]}
                value={form.fecha_nacimiento}
                onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))}
              />
            </div>

            {/* Dirección de entrega (opcional) */}
            <div className="border-t border-brand-border pt-4 mt-2">
              <p className="text-xs font-semibold text-brand-purple uppercase tracking-wide mb-3">
                Dirección de entrega <span className="text-brand-text-light font-normal normal-case">(opcional — podés agregarla después)</span>
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs text-brand-text-muted mb-1">Calle y número</label>
                  <input type="text" className="input-dark" placeholder="Av. Corrientes 1234" value={form.direccion}
                    onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-brand-text-muted mb-1">Ciudad</label>
                    <input type="text" className="input-dark" placeholder="Buenos Aires" value={form.ciudad}
                      onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-brand-text-muted mb-1">Código postal</label>
                    <input type="text" className="input-dark" placeholder="C1414" value={form.codigo_postal}
                      onChange={e => setForm(f => ({ ...f, codigo_postal: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-brand-text-muted mb-1">Provincia</label>
                  <select className="input-dark" value={form.provincia}
                    onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))}>
                    <option value="">Seleccioná tu provincia</option>
                    {['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
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
