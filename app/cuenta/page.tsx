'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import DireccionesManager from '@/components/DireccionesManager'

interface Perfil {
  nombre: string | null
  telefono: string | null
  primer_compra_usada: boolean
  dni: string | null
  fecha_nacimiento: string | null
}

interface Orden {
  id: string
  total: number
  estado: string
  created_at: string
  items: { nombre: string; cantidad: number; precio: number }[]
}

function formatPrecio(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  approved:   { label: 'Pagado',     color: 'text-green-400'  },
  pending:    { label: 'Pendiente',  color: 'text-yellow-400' },
  rejected:   { label: 'Rechazado', color: 'text-red-400'    },
  cancelled:  { label: 'Cancelado', color: 'text-gray-400'   },
  refunded:   { label: 'Reembolsado', color: 'text-blue-400' },
  dispatched: { label: 'Despachado', color: 'text-brand-purple' },
}

function validarDNI(dni: string): boolean {
  return /^\d{7,8}$/.test(dni.replace(/\./g, '').trim())
}

export default function CuentaPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [editando, setEditando] = useState(false)
  const [formPerfil, setFormPerfil] = useState({
    nombre: '',
    telefono: '',
    dni: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/cuenta/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    supabase
      .from('perfiles')
      .select('nombre, telefono, primer_compra_usada, dni, fecha_nacimiento')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setPerfil(data)
          setFormPerfil({
            nombre: data.nombre || '',
            telefono: data.telefono || '',
            dni: data.dni || '',
          })
          // Redirigir a completar perfil si faltan datos obligatorios
          if (!data.telefono || !data.dni) {
            router.replace('/cuenta/completar-perfil')
          }
        }
      })

    supabase
      .from('ordenes')
      .select('id, total, estado, created_at, items')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setOrdenes(data)
      })
  }, [user])

  async function handleGuardarPerfil(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    // Validar DNI si se ingresó
    const dniLimpio = formPerfil.dni.trim()
    if (dniLimpio && !validarDNI(dniLimpio)) {
      alert('El DNI debe tener 7 u 8 dígitos numéricos.')
      return
    }

    setGuardando(true)

    await supabase.from('perfiles').upsert({
      user_id: user.id,
      nombre: formPerfil.nombre.trim(),
      telefono: formPerfil.telefono.trim() || null,
      dni: dniLimpio || null,
    })

    setPerfil(p => p ? {
      ...p,
      nombre: formPerfil.nombre,
      telefono: formPerfil.telefono,
      dni: formPerfil.dni,
    } : p)
    setEditando(false)
    setGuardando(false)
    setGuardadoOk(true)
    setTimeout(() => setGuardadoOk(false), 3000)
  }

  async function handleSignOut() {
    await signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  const nombre = perfil?.nombre || user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario'
  const inicial = nombre.charAt(0).toUpperCase()

  const formatFecha = (iso: string | null) => {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="w-14 h-14 rounded-full bg-brand-purple flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {inicial}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand-text">{nombre}</h1>
          <p className="text-brand-text-muted text-sm">{user.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="ml-auto text-xs text-brand-text-muted hover:text-red-400 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Beneficios activos */}
      {perfil && !perfil.primer_compra_usada && (
        <div className="bg-brand-purple/10 border border-brand-purple/30 rounded-2xl px-5 py-4 mb-8 flex items-center gap-3">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="text-sm font-semibold text-brand-text">10% de descuento en tu primera compra</p>
            <p className="text-xs text-brand-text-muted">Se aplica automáticamente al finalizar tu compra.</p>
          </div>
          <Link
            href="/productos"
            className="ml-auto text-xs bg-brand-purple hover:bg-brand-purple-light text-white font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
          >
            Ir al catálogo
          </Link>
        </div>
      )}

      <div className="grid gap-6">
        {/* Perfil */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-brand-text">Mis datos</h2>
            {!editando && (
              <button
                onClick={() => setEditando(true)}
                className="text-xs text-brand-purple hover:text-brand-purple-light transition-colors"
              >
                Editar
              </button>
            )}
            {guardadoOk && <p className="text-xs text-green-400">¡Guardado!</p>}
          </div>

          {editando ? (
            <form onSubmit={handleGuardarPerfil} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-brand-text-muted mb-1">Nombre</label>
                <input
                  type="text"
                  className="input-dark"
                  value={formPerfil.nombre}
                  onChange={e => setFormPerfil(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-brand-text-muted mb-1">Teléfono</label>
                <input
                  type="tel"
                  className="input-dark"
                  placeholder="+54 9 11 1234-5678"
                  value={formPerfil.telefono}
                  onChange={e => setFormPerfil(f => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-brand-text-muted mb-1">DNI</label>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="12345678"
                  inputMode="numeric"
                  maxLength={10}
                  value={formPerfil.dni}
                  onChange={e => setFormPerfil(f => ({ ...f, dni: e.target.value.replace(/\D/g, '') }))}
                />
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  type="submit"
                  disabled={guardando}
                  className="bg-brand-purple hover:bg-brand-purple-light text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  className="text-sm text-brand-text-muted hover:text-brand-text transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex gap-3">
                <span className="text-brand-text-muted w-28 flex-shrink-0">Nombre</span>
                <span className="text-brand-text">{perfil?.nombre || '—'}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-brand-text-muted w-28 flex-shrink-0">Email</span>
                <span className="text-brand-text">{user.email}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-brand-text-muted w-28 flex-shrink-0">Teléfono</span>
                <span className="text-brand-text">{perfil?.telefono || '—'}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-brand-text-muted w-28 flex-shrink-0">DNI</span>
                <span className="text-brand-text">{perfil?.dni || '—'}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-brand-text-muted w-28 flex-shrink-0">Nacimiento</span>
                <span className="text-brand-text">{formatFecha(perfil?.fecha_nacimiento ?? null)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/cuenta/favoritos"
            className="bg-brand-bg-card border border-brand-border hover:border-brand-purple rounded-2xl p-5 flex items-center gap-3 transition-colors group"
          >
            <span className="text-2xl">❤️</span>
            <div>
              <p className="font-semibold text-sm text-brand-text group-hover:text-brand-purple transition-colors">Favoritos</p>
              <p className="text-xs text-brand-text-muted">Tus productos guardados</p>
            </div>
          </Link>
          <Link
            href="/productos"
            className="bg-brand-bg-card border border-brand-border hover:border-brand-purple rounded-2xl p-5 flex items-center gap-3 transition-colors group"
          >
            <span className="text-2xl">🛍️</span>
            <div>
              <p className="font-semibold text-sm text-brand-text group-hover:text-brand-purple transition-colors">Catálogo</p>
              <p className="text-xs text-brand-text-muted">Seguir comprando</p>
            </div>
          </Link>
        </div>

        {/* Direcciones guardadas */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <h2 className="font-semibold text-brand-text mb-5">Mis direcciones</h2>
          <DireccionesManager userId={user.id} />
        </div>

        {/* Historial de compras */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <h2 className="font-semibold text-brand-text mb-5">Mis compras</h2>
          {ordenes.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl block mb-2">🛒</span>
              <p className="text-brand-text-muted text-sm">Todavía no hiciste ninguna compra.</p>
              <Link href="/productos" className="text-brand-purple text-sm mt-2 inline-block hover:underline">
                Ver catálogo
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {ordenes.map(orden => {
                const estadoInfo = ESTADO_LABEL[orden.estado] ?? { label: orden.estado, color: 'text-brand-text-muted' }
                return (
                  <div key={orden.id} className="border border-brand-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-mono text-brand-text-muted">#{orden.id.slice(0, 8).toUpperCase()}</p>
                      <span className={`text-xs font-semibold ${estadoInfo.color}`}>{estadoInfo.label}</span>
                    </div>
                    <p className="text-sm text-brand-text-muted mb-1">
                      {new Date(orden.created_at).toLocaleDateString('es-AR')}
                    </p>
                    <p className="text-sm text-brand-text-muted line-clamp-1">
                      {(orden.items || []).map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')}
                    </p>
                    <p className="text-base font-bold text-brand-text mt-1">{formatPrecio(orden.total)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
