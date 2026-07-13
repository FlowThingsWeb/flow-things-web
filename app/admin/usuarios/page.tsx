'use client'

import { useEffect, useState } from 'react'

interface Usuario {
  id: string
  email: string
  nombre?: string
  apellido?: string
  telefono?: string
  dni?: string
  created_at: string
  confirmed: boolean
  primer_compra_usada: boolean
}

interface DetalleUsuario {
  usuario: {
    id: string
    email: string
    confirmed: boolean
    created_at: string
    last_sign_in: string | null
    provider: string
  }
  perfil: {
    nombre: string | null
    apellido: string | null
    telefono: string | null
    dni: string | null
    fecha_nacimiento: string | null
    primer_compra_usada: boolean
  } | null
  ordenes: {
    id: string
    total: number
    estado: string
    created_at: string
    items: { nombre: string; cantidad: number; precio: number }[]
  }[]
}

interface BroadcastResult {
  enviados: number
  errores: number
  total: number
  mensaje?: string
}

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  approved:   { label: 'Pagado',      color: 'text-green-400' },
  pending:    { label: 'Pendiente',   color: 'text-yellow-400' },
  rejected:   { label: 'Rechazado',  color: 'text-red-400' },
  cancelled:  { label: 'Cancelado',  color: 'text-gray-400' },
  refunded:   { label: 'Reembolsado', color: 'text-blue-400' },
  dispatched: { label: 'Despachado', color: 'text-brand-purple' },
}

function formatPrecio(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR')
}

function formatFechaHora(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || ''

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<DetalleUsuario | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [vistaActiva, setVistaActiva] = useState<'detalle' | 'broadcast'>('detalle')

  // Broadcast
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'con_compras' | 'sin_compras'>('todos')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<BroadcastResult | null>(null)
  const [broadcastError, setBroadcastError] = useState('')

  useEffect(() => {
    fetch('/api/admin/usuarios', { headers: { 'x-admin-secret': ADMIN_SECRET } })
      .then(r => r.json())
      .then(data => {
        setUsuarios(data.usuarios || [])
        setCargando(false)
      })
      .catch(() => { setError('Error al cargar usuarios.'); setCargando(false) })
  }, [])

  async function seleccionarUsuario(id: string) {
    if (usuarioSeleccionado === id) {
      setUsuarioSeleccionado(null)
      setDetalle(null)
      return
    }
    setUsuarioSeleccionado(id)
    setDetalle(null)
    setCargandoDetalle(true)
    setVistaActiva('detalle')
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, { headers: { 'x-admin-secret': ADMIN_SECRET } })
      const data = await res.json()
      setDetalle(data)
    } catch {
      // silencioso
    } finally {
      setCargandoDetalle(false)
    }
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault()
    setBroadcastError('')
    setResultado(null)
    setEnviando(true)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
        body: JSON.stringify({ asunto, cuerpo, filtro }),
      })
      const data = await res.json()
      if (!res.ok) setBroadcastError(data.error || 'Error al enviar.')
      else {
        setResultado(data)
        if (data.enviados > 0) { setAsunto(''); setCuerpo('') }
      }
    } catch {
      setBroadcastError('Error de conexión.')
    } finally {
      setEnviando(false)
    }
  }

  const usuariosFiltrados = usuarios.filter(u =>
    busqueda === '' ||
    u.email.toLowerCase().includes(busqueda.toLowerCase()) ||
    (u.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Usuarios</h1>
          <p className="text-brand-text-muted text-sm mt-1">Clientes registrados en la tienda</p>
        </div>
        <button
          onClick={() => { setUsuarioSeleccionado(null); setDetalle(null); setVistaActiva('broadcast') }}
          className="text-sm bg-brand-purple hover:bg-brand-purple-light text-white font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          📬 Enviar difusión
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Lista */}
        <div className="lg:col-span-2">
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-brand-border">
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="input-dark text-sm py-1.5"
              />
            </div>

            {cargando ? (
              <div className="p-12 text-center">
                <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : error ? (
              <div className="p-8 text-center"><p className="text-red-400 text-sm">{error}</p></div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="p-8 text-center"><p className="text-brand-text-muted text-sm">Sin resultados</p></div>
            ) : (
              <>
                <div className="px-4 py-2 border-b border-brand-border">
                  <p className="text-xs text-brand-text-muted">{usuariosFiltrados.length} usuario{usuariosFiltrados.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="divide-y divide-brand-border max-h-[70vh] overflow-y-auto">
                  {usuariosFiltrados.map(u => (
                    <button
                      key={u.id}
                      onClick={() => seleccionarUsuario(u.id)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-brand-bg-soft ${usuarioSeleccionado === u.id ? 'bg-brand-purple/10 border-l-2 border-brand-purple' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-purple/20 flex items-center justify-center text-brand-purple text-sm font-bold flex-shrink-0">
                        {(u.nombre || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {u.nombre && <p className="text-sm font-medium text-brand-text truncate">{u.nombre}{u.apellido ? ` ${u.apellido}` : ''}</p>}
                        <p className="text-xs text-brand-text-muted truncate">{u.email}</p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        {!u.confirmed && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">Sin confirmar</span>}
                        {!u.primer_compra_usada && <span className="text-[10px] text-brand-purple">1ra compra</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="lg:col-span-3">
          {/* Detalle de usuario */}
          {(usuarioSeleccionado || vistaActiva === 'detalle') && usuarioSeleccionado && (
            <div className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden">
              {cargandoDetalle ? (
                <div className="p-12 text-center">
                  <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : detalle ? (
                <div>
                  {/* Header usuario */}
                  <div className="px-6 py-5 border-b border-brand-border flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-brand-purple/20 flex items-center justify-center text-brand-purple text-lg font-bold flex-shrink-0">
                      {(detalle.perfil?.nombre || detalle.usuario.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-brand-text">
                        {detalle.perfil?.nombre
                          ? `${detalle.perfil.nombre}${detalle.perfil.apellido ? ` ${detalle.perfil.apellido}` : ''}`
                          : detalle.usuario.email}
                      </p>
                      <p className="text-sm text-brand-text-muted">{detalle.usuario.email}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${detalle.usuario.confirmed ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {detalle.usuario.confirmed ? '✓ Confirmado' : '⏳ Sin confirmar'}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-brand-bg-soft text-brand-text-muted font-medium capitalize">
                        {detalle.usuario.provider}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 flex flex-col gap-6">
                    {/* Datos personales */}
                    <div>
                      <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide mb-3">Datos personales</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        {[
                          ['Nombre', detalle.perfil?.nombre || '—'],
                          ['Apellido', detalle.perfil?.apellido || '—'],
                          ['Teléfono', detalle.perfil?.telefono || '—'],
                          ['DNI', detalle.perfil?.dni || '—'],
                          ['Nacimiento', formatFecha(detalle.perfil?.fecha_nacimiento ?? null)],
                          ['Registrado', formatFecha(detalle.usuario.created_at)],
                          ['Último acceso', formatFechaHora(detalle.usuario.last_sign_in)],
                          ['1ra compra', detalle.perfil?.primer_compra_usada ? 'Usada' : 'Disponible'],
                        ].map(([label, value]) => (
                          <div key={label} className="flex gap-2">
                            <span className="text-brand-text-muted w-28 flex-shrink-0">{label}</span>
                            <span className={`text-brand-text truncate ${label === '1ra compra' && value === 'Disponible' ? 'text-brand-purple' : ''}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Historial de compras */}
                    <div>
                      <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide mb-3">
                        Compras ({detalle.ordenes.length})
                      </p>
                      {detalle.ordenes.length === 0 ? (
                        <p className="text-sm text-brand-text-muted">Sin compras aún.</p>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                          {detalle.ordenes.map(orden => {
                            const estadoInfo = ESTADO_LABEL[orden.estado] ?? { label: orden.estado, color: 'text-brand-text-muted' }
                            return (
                              <div key={orden.id} className="bg-brand-bg-soft border border-brand-border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-xs font-mono text-brand-text-muted">#{orden.id.slice(0, 8).toUpperCase()}</p>
                                  <span className={`text-xs font-semibold ${estadoInfo.color}`}>{estadoInfo.label}</span>
                                </div>
                                <p className="text-xs text-brand-text-muted mb-1">{formatFechaHora(orden.created_at)}</p>
                                <p className="text-xs text-brand-text-muted line-clamp-1 mb-1.5">
                                  {(orden.items || []).map(i => `${i.cantidad}x ${i.nombre}`).join(', ')}
                                </p>
                                <p className="text-sm font-bold text-brand-text">{formatPrecio(orden.total)}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Broadcast */}
          {(!usuarioSeleccionado || vistaActiva === 'broadcast') && (
            <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-brand-text">📬 Enviar difusión</h2>
                {usuarioSeleccionado && (
                  <button onClick={() => setVistaActiva('detalle')} className="text-xs text-brand-text-muted hover:text-brand-text transition-colors">
                    ← Volver al detalle
                  </button>
                )}
              </div>
              <form onSubmit={handleBroadcast} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-text-muted mb-1.5 uppercase tracking-wide">Destinatarios</label>
                  <select value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)} className="input-dark">
                    <option value="todos">Todos los usuarios</option>
                    <option value="con_compras">Solo usuarios con compras</option>
                    <option value="sin_compras">Solo usuarios sin compras</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text-muted mb-1.5 uppercase tracking-wide">Asunto</label>
                  <input type="text" required value={asunto} onChange={e => setAsunto(e.target.value)} className="input-dark" placeholder="Ej: ¡Nuevos productos disponibles!" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text-muted mb-1.5 uppercase tracking-wide">Mensaje</label>
                  <textarea required value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={8} className="input-dark resize-y" placeholder="Podés usar HTML para dar formato al email..." />
                </div>
                {broadcastError && <p className="text-red-400 text-sm">{broadcastError}</p>}
                {resultado && (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                    {resultado.mensaje ? (
                      <p className="text-yellow-400 text-sm">{resultado.mensaje}</p>
                    ) : (
                      <>
                        <p className="text-green-400 font-semibold text-sm">✅ {resultado.enviados} email{resultado.enviados !== 1 ? 's' : ''} enviado{resultado.enviados !== 1 ? 's' : ''}</p>
                        {resultado.errores > 0 && <p className="text-red-400 text-xs mt-1">{resultado.errores} con error</p>}
                      </>
                    )}
                  </div>
                )}
                <button type="submit" disabled={enviando} className="bg-brand-purple hover:bg-brand-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
                  {enviando ? 'Enviando...' : 'Enviar difusión'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
