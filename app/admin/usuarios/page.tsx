'use client'

import { useEffect, useState } from 'react'

interface Usuario {
  id: string
  email: string
  nombre?: string
  telefono?: string
  created_at: string
  confirmed: boolean
  primer_compra_usada: boolean
}

interface BroadcastResult {
  enviados: number
  errores: number
  total: number
  mensaje?: string
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Broadcast
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'con_compras' | 'sin_compras'>('todos')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<BroadcastResult | null>(null)
  const [broadcastError, setBroadcastError] = useState('')

  useEffect(() => {
    fetch('/api/admin/usuarios', {
      headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || '' },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setUsuarios(data.usuarios || [])
        }
        setCargando(false)
      })
      .catch(() => {
        setError('Error al cargar usuarios.')
        setCargando(false)
      })
  }, [])

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault()
    setBroadcastError('')
    setResultado(null)
    setEnviando(true)

    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || '',
        },
        body: JSON.stringify({ asunto, cuerpo, filtro }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBroadcastError(data.error || 'Error al enviar.')
      } else {
        setResultado(data)
        if (data.enviados > 0) {
          setAsunto('')
          setCuerpo('')
        }
      }
    } catch {
      setBroadcastError('Error de conexión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-text">Usuarios</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          Clientes registrados en la tienda
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Lista de usuarios */}
        <div>
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden">
            {cargando ? (
              <div className="p-12 text-center">
                <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : error ? (
              <div className="p-12 text-center">
                <p className="text-red-400 text-sm">{error}</p>
                <p className="text-brand-text-muted text-xs mt-2">
                  Creá la ruta <code className="bg-brand-bg-soft px-1 rounded">/api/admin/usuarios</code> para listar usuarios.
                </p>
              </div>
            ) : usuarios.length === 0 ? (
              <div className="p-12 text-center">
                <span className="text-4xl block mb-3">👥</span>
                <p className="text-brand-text-muted">Aún no hay usuarios registrados</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-brand-border">
                  <p className="text-xs text-brand-text-muted font-semibold uppercase tracking-wide">
                    {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="divide-y divide-brand-border max-h-[600px] overflow-y-auto">
                  {usuarios.map(u => (
                    <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-purple/20 flex items-center justify-center text-brand-purple text-sm font-bold flex-shrink-0">
                        {(u.nombre || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {u.nombre && <p className="text-sm font-medium text-brand-text truncate">{u.nombre}</p>}
                        <p className="text-xs text-brand-text-muted truncate">{u.email}</p>
                        {u.telefono && <p className="text-xs text-brand-text-light">{u.telefono}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-brand-text-muted">
                          {new Date(u.created_at).toLocaleDateString('es-AR')}
                        </p>
                        {!u.primer_compra_usada && (
                          <span className="text-xs text-brand-purple">Primera compra disponible</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Broadcast */}
        <div>
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
            <h2 className="font-semibold text-brand-text mb-5">📬 Enviar difusión</h2>
            <form onSubmit={handleBroadcast} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-text-muted mb-1.5 uppercase tracking-wide">
                  Destinatarios
                </label>
                <select
                  value={filtro}
                  onChange={e => setFiltro(e.target.value as typeof filtro)}
                  className="input-dark"
                >
                  <option value="todos">Todos los usuarios</option>
                  <option value="con_compras">Solo usuarios con compras</option>
                  <option value="sin_compras">Solo usuarios sin compras</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-muted mb-1.5 uppercase tracking-wide">
                  Asunto
                </label>
                <input
                  type="text"
                  required
                  value={asunto}
                  onChange={e => setAsunto(e.target.value)}
                  className="input-dark"
                  placeholder="Ej: ¡Nuevos productos disponibles!"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-muted mb-1.5 uppercase tracking-wide">
                  Mensaje
                </label>
                <textarea
                  required
                  value={cuerpo}
                  onChange={e => setCuerpo(e.target.value)}
                  rows={8}
                  className="input-dark resize-y"
                  placeholder="Podés usar HTML para dar formato al email..."
                />
              </div>

              {broadcastError && (
                <p className="text-red-400 text-sm">{broadcastError}</p>
              )}

              {resultado && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                  {resultado.mensaje ? (
                    <p className="text-yellow-400 text-sm">{resultado.mensaje}</p>
                  ) : (
                    <>
                      <p className="text-green-400 font-semibold text-sm">
                        ✅ {resultado.enviados} email{resultado.enviados !== 1 ? 's' : ''} enviado{resultado.enviados !== 1 ? 's' : ''}
                      </p>
                      {resultado.errores > 0 && (
                        <p className="text-red-400 text-xs mt-1">{resultado.errores} con error</p>
                      )}
                    </>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="bg-brand-purple hover:bg-brand-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {enviando ? 'Enviando...' : 'Enviar difusión'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
