'use client'

import { useState, useEffect } from 'react'

interface CodigoDescuento {
  id: string
  codigo: string
  descripcion: string | null
  tipo: 'porcentaje' | 'monto_fijo'
  valor: number
  activo: boolean
  usos_maximos: number | null
  usos_actuales: number
  un_uso_por_usuario: boolean
  fecha_vencimiento: string | null
  created_at: string
}

function formatFecha(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formInicial = {
  codigo: '',
  descripcion: '',
  tipo: 'porcentaje' as 'porcentaje' | 'monto_fijo',
  valor: '',
  usos_maximos: '',
  un_uso_por_usuario: false,
  fecha_vencimiento: '',
}

export default function DescuentosPage() {
  const [codigos, setCodigos] = useState<CodigoDescuento[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(formInicial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Cupón post-compra (config editable)
  const [cuponPost, setCuponPost] = useState('')
  const [savingCupon, setSavingCupon] = useState(false)
  const [cuponMsg, setCuponMsg] = useState('')

  const cargar = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/descuentos')
    if (res.ok) setCodigos(await res.json())
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  // Cargar el código post-compra configurado
  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(d => {
        const cfg = Object.fromEntries((d.data || []).map((r: any) => [r.clave, r.valor]))
        setCuponPost(cfg.cupon_postcompra_codigo || '')
      })
      .catch(() => {})
  }, [])

  const guardarCuponPost = async () => {
    setSavingCupon(true); setCuponMsg('')
    try {
      await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { cupon_postcompra_codigo: cuponPost } }),
      })
      setCuponMsg('Guardado ✅')
    } catch {
      setCuponMsg('Error al guardar')
    } finally {
      setSavingCupon(false)
      setTimeout(() => setCuponMsg(''), 3000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const res = await fetch('/api/admin/descuentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: form.codigo,
        descripcion: form.descripcion || null,
        tipo: form.tipo,
        valor: parseFloat(form.valor),
        usos_maximos: form.usos_maximos ? parseInt(form.usos_maximos) : null,
        un_uso_por_usuario: form.un_uso_por_usuario,
        fecha_vencimiento: form.fecha_vencimiento || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al crear el código')
    } else {
      setSuccess(`Código "${data.codigo}" creado correctamente`)
      setForm(formInicial)
      await cargar()
    }

    setSaving(false)
    setTimeout(() => { setSuccess(''); setError('') }, 4000)
  }

  const toggleActivo = async (id: string, activo: boolean) => {
    await fetch('/api/admin/descuentos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo: !activo }),
    })
    await cargar()
  }

  const eliminar = async (id: string, codigo: string) => {
    if (!confirm(`¿Eliminar el código "${codigo}"?`)) return
    await fetch(`/api/admin/descuentos?id=${id}`, { method: 'DELETE' })
    await cargar()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Códigos de descuento</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          Creá y gestioná códigos de descuento para aplicar en la compra.
        </p>
      </div>

      {/* Cupón post-compra */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
        <h2 className="font-semibold text-white text-base">Cupón después de la compra</h2>
        <p className="text-brand-text-muted text-sm mt-1 mb-4">
          Se muestra en la pantalla de "¡Gracias por tu compra!" para incentivar la recompra. Elegí uno de tus códigos (o ninguno).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={cuponPost}
            onChange={e => setCuponPost(e.target.value)}
            className="input-dark w-full sm:w-64"
          >
            <option value="">— Ninguno (no mostrar) —</option>
            {cuponPost && !codigos.some(c => c.codigo === cuponPost) && (
              <option value={cuponPost}>{cuponPost}</option>
            )}
            {codigos.map(c => (
              <option key={c.id} value={c.codigo}>{c.codigo}{c.activo ? '' : ' (inactivo)'}</option>
            ))}
          </select>
          <button
            onClick={guardarCuponPost}
            disabled={savingCupon}
            className="bg-brand-purple hover:bg-brand-purple-light disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            {savingCupon ? 'Guardando...' : 'Guardar'}
          </button>
          {cuponMsg && <span className="text-sm text-green-400">{cuponMsg}</span>}
        </div>
        <p className="text-xs text-brand-text-light mt-2">
          Asegurate de que el código exista y esté activo para que el cliente pueda usarlo.
        </p>
      </div>

      {/* Formulario nuevo código */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-5 text-base">Nuevo código de descuento</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Código */}
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">Código *</label>
              <input
                type="text"
                required
                value={form.codigo}
                onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                placeholder="ej: VERANO20"
                maxLength={50}
                className="input-dark uppercase"
              />
              <p className="text-xs text-brand-text-light mt-1">El cliente debe escribirlo exactamente así.</p>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">Descripción (opcional)</label>
              <input
                type="text"
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
                placeholder="ej: Descuento de verano"
                className="input-dark"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">Tipo *</label>
              <select
                value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value as 'porcentaje' | 'monto_fijo' })}
                className="input-dark"
              >
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto_fijo">Monto fijo ($)</option>
              </select>
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">
                Valor * {form.tipo === 'porcentaje' ? '(%)' : '($ ARS)'}
              </label>
              <input
                type="number"
                required
                min="1"
                max={form.tipo === 'porcentaje' ? '100' : undefined}
                step="0.01"
                value={form.valor}
                onChange={e => setForm({ ...form, valor: e.target.value })}
                placeholder={form.tipo === 'porcentaje' ? 'ej: 15' : 'ej: 500'}
                className="input-dark"
              />
            </div>

            {/* Usos máximos */}
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">Usos máximos</label>
              <input
                type="number"
                min="1"
                value={form.usos_maximos}
                onChange={e => setForm({ ...form, usos_maximos: e.target.value })}
                placeholder="Dejar vacío = ilimitado"
                className="input-dark"
              />
            </div>

            {/* Fecha de vencimiento */}
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">Fecha de vencimiento</label>
              <input
                type="date"
                value={form.fecha_vencimiento}
                onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })}
                className="input-dark"
              />
              <p className="text-xs text-brand-text-light mt-1">Dejar vacío = sin vencimiento.</p>
            </div>
          </div>

          {/* 1 uso por usuario */}
          <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.un_uso_por_usuario}
                onChange={e => setForm({ ...form, un_uso_por_usuario: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${form.un_uso_por_usuario ? 'bg-brand-purple' : 'bg-brand-border'}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.un_uso_por_usuario ? 'translate-x-5' : ''}`} />
            </div>
            <div>
              <span className="text-sm font-medium text-brand-text">1 uso por usuario</span>
              <p className="text-xs text-brand-text-muted">Cada usuario solo puede usar este código una vez. Requiere iniciar sesión.</p>
            </div>
          </label>

          {error && (
            <div className="bg-red-900/30 border border-red-500/50 text-red-300 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-900/30 border border-green-500/50 text-green-300 rounded-xl px-4 py-3 text-sm">
              ✅ {success}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-brand-purple hover:bg-brand-purple-light disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creando...
              </>
            ) : (
              '+ Crear código'
            )}
          </button>
        </form>
      </div>

      {/* Lista de códigos */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-border">
          <h2 className="font-semibold text-white text-base">
            Códigos activos {codigos.length > 0 && `(${codigos.length})`}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-brand-text-muted text-sm">
            Cargando...
          </div>
        ) : codigos.length === 0 ? (
          <div className="text-center py-12 text-brand-text-muted text-sm">
            No hay códigos creados todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-bg-soft border-b border-brand-border">
                <tr>
                  <th className="text-left px-5 py-3 text-brand-text-muted font-medium">Código</th>
                  <th className="text-left px-5 py-3 text-brand-text-muted font-medium">Tipo</th>
                  <th className="text-left px-5 py-3 text-brand-text-muted font-medium">Valor</th>
                  <th className="text-left px-5 py-3 text-brand-text-muted font-medium">Usos</th>
                  <th className="text-left px-5 py-3 text-brand-text-muted font-medium">Restricción</th>
                  <th className="text-left px-5 py-3 text-brand-text-muted font-medium">Vence</th>
                  <th className="text-left px-5 py-3 text-brand-text-muted font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {codigos.map((c) => {
                  const vencido = c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date()
                  const agotado = c.usos_maximos !== null && c.usos_actuales >= c.usos_maximos

                  return (
                    <tr key={c.id} className="hover:bg-brand-bg-soft/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div>
                          <span className="font-mono font-bold text-brand-neon tracking-widest text-xs">
                            {c.codigo}
                          </span>
                          {c.descripcion && (
                            <p className="text-xs text-brand-text-muted mt-0.5">{c.descripcion}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-brand-text-muted">
                        {c.tipo === 'porcentaje' ? '% Porcentaje' : '$ Monto fijo'}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-white">
                        {c.tipo === 'porcentaje' ? `${c.valor}%` : `$${c.valor.toLocaleString('es-AR')}`}
                      </td>
                      <td className="px-5 py-3.5 text-brand-text-muted">
                        {c.usos_actuales}
                        {c.usos_maximos !== null && ` / ${c.usos_maximos}`}
                        {agotado && <span className="ml-1 text-red-400 text-xs">agotado</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {c.un_uso_por_usuario ? (
                          <span className="text-xs bg-brand-purple/20 text-brand-purple border border-brand-purple/30 px-2 py-0.5 rounded-full">
                            1 por usuario
                          </span>
                        ) : (
                          <span className="text-xs text-brand-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-brand-text-muted">
                        <span className={vencido ? 'text-red-400' : ''}>
                          {formatFecha(c.fecha_vencimiento)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => toggleActivo(c.id, c.activo)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                            c.activo
                              ? 'bg-green-900/40 text-green-300 border border-green-500/30 hover:bg-red-900/30 hover:text-red-300 hover:border-red-500/30'
                              : 'bg-brand-bg-soft text-brand-text-muted border border-brand-border hover:bg-green-900/30 hover:text-green-300 hover:border-green-500/30'
                          }`}
                        >
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => eliminar(c.id, c.codigo)}
                          className="text-brand-text-light hover:text-red-400 transition-colors text-xs"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
