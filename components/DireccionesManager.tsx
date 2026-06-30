'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface Direccion {
  id: string
  etiqueta: string
  direccion: string
  piso: string | null
  departamento: string | null
  ciudad: string
  provincia: string
  codigo_postal: string
  es_principal: boolean
}

const PROVINCIAS = ['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán']

const formVacio = { etiqueta: 'Casa', direccion: '', piso: '', departamento: '', ciudad: '', provincia: '', codigo_postal: '' }

interface Props {
  userId: string
  onSelect?: (dir: Direccion) => void   // modo selector (checkout)
  seleccionadaId?: string
  compact?: boolean
}

export default function DireccionesManager({ userId, onSelect, seleccionadaId, compact = false }: Props) {
  const [direcciones, setDirecciones] = useState<Direccion[]>([])
  const [agregando, setAgregando] = useState(false)
  const [form, setForm] = useState(formVacio)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDirecciones()
  }, [userId])

  async function cargarDirecciones() {
    const { data, error: loadErr } = await supabase
      .from('direcciones_guardadas')
      .select('*')
      .eq('user_id', userId)
      .order('es_principal', { ascending: false })
      .order('created_at', { ascending: true })
    if (loadErr) console.error('[direcciones] load error:', loadErr)
    if (data) setDirecciones(data)
  }

  async function guardarDireccion(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.direccion.trim() || !form.ciudad.trim() || !form.provincia) {
      setError('Completá calle, ciudad y provincia.')
      return
    }
    setGuardando(true)
    const esPrimera = direcciones.length === 0
    const { error: err } = await supabase.from('direcciones_guardadas').insert({
      user_id: userId,
      etiqueta: form.etiqueta.trim() || 'Casa',
      direccion: form.direccion.trim(),
      piso: form.piso.trim() || null,
      departamento: form.departamento.trim() || null,
      ciudad: form.ciudad.trim(),
      provincia: form.provincia,
      codigo_postal: form.codigo_postal.trim(),
      es_principal: esPrimera,
    })
    if (err) { console.error('[direcciones] insert error:', err); setError(`Error: ${err.message}`); setGuardando(false); return }
    await cargarDirecciones()
    setForm(formVacio)
    setAgregando(false)
    setGuardando(false)
  }

  async function eliminar(id: string) {
    await supabase.from('direcciones_guardadas').delete().eq('id', id)
    setDirecciones(d => d.filter(x => x.id !== id))
  }

  async function marcarPrincipal(id: string) {
    await supabase.from('direcciones_guardadas').update({ es_principal: false }).eq('user_id', userId)
    await supabase.from('direcciones_guardadas').update({ es_principal: true }).eq('id', id)
    setDirecciones(d => d.map(x => ({ ...x, es_principal: x.id === id })))
  }

  return (
    <div className="space-y-3">
      {/* Lista de direcciones */}
      {direcciones.length > 0 && (
        <div className="space-y-2">
          {direcciones.map(dir => (
            <div
              key={dir.id}
              onClick={() => onSelect?.(dir)}
              className={[
                'rounded-xl border p-3 transition-all text-sm',
                onSelect ? 'cursor-pointer' : '',
                seleccionadaId === dir.id
                  ? 'border-brand-purple bg-brand-purple/10'
                  : 'border-brand-border bg-brand-bg-soft hover:border-brand-purple/50',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-brand-text text-xs">{dir.etiqueta}</span>
                    {dir.es_principal && (
                      <span className="text-[10px] bg-brand-purple/20 text-brand-purple px-1.5 py-0.5 rounded-full font-medium">Principal</span>
                    )}
                  </div>
                  <p className="text-brand-text-muted text-xs leading-relaxed">
                    {dir.direccion}
                    {(dir.piso || dir.departamento) && (
                      <span> · {[dir.piso && `Piso ${dir.piso}`, dir.departamento && `Dpto. ${dir.departamento}`].filter(Boolean).join(', ')}</span>
                    )}
                    {' · '}{dir.ciudad}, {dir.provincia}
                    {dir.codigo_postal ? ` (${dir.codigo_postal})` : ''}
                  </p>
                </div>
                {!compact && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!dir.es_principal && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); marcarPrincipal(dir.id) }}
                        className="text-[10px] text-brand-text-muted hover:text-brand-purple transition-colors whitespace-nowrap"
                        title="Marcar como principal"
                      >
                        ★ Principal
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); eliminar(dir.id) }}
                      className="text-[10px] text-brand-text-light hover:text-red-400 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario agregar */}
      {agregando ? (
        <form onSubmit={guardarDireccion} className="border border-brand-border rounded-xl p-4 space-y-3 bg-brand-bg-soft">
          <p className="text-xs font-semibold text-brand-text">Nueva dirección</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-brand-text-muted mb-1">Etiqueta</label>
              <select
                className="input-dark text-sm"
                value={form.etiqueta}
                onChange={e => setForm(f => ({ ...f, etiqueta: e.target.value }))}
              >
                {['Casa', 'Trabajo', 'Otro'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-brand-text-muted mb-1">Código postal</label>
              <input type="text" className="input-dark text-sm" placeholder="C1414" value={form.codigo_postal}
                onChange={e => setForm(f => ({ ...f, codigo_postal: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-brand-text-muted mb-1">Calle y número *</label>
            <input type="text" required className="input-dark text-sm" placeholder="Av. Corrientes 1234" value={form.direccion}
              onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-brand-text-muted mb-1">Piso <span className="text-brand-text-light">(opcional)</span></label>
              <input type="text" className="input-dark text-sm" placeholder="3" value={form.piso}
                onChange={e => setForm(f => ({ ...f, piso: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-brand-text-muted mb-1">Departamento <span className="text-brand-text-light">(opcional)</span></label>
              <input type="text" className="input-dark text-sm" placeholder="B" value={form.departamento}
                onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-brand-text-muted mb-1">Ciudad *</label>
              <input type="text" required className="input-dark text-sm" placeholder="Buenos Aires" value={form.ciudad}
                onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-brand-text-muted mb-1">Provincia *</label>
              <select required className="input-dark text-sm" value={form.provincia}
                onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))}>
                <option value="">Elegir...</option>
                {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={guardando}
              className="bg-brand-purple hover:bg-brand-purple-light text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={() => { setAgregando(false); setForm(formVacio); setError('') }}
              className="text-xs text-brand-text-muted hover:text-brand-text transition-colors px-3 py-2">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAgregando(true)}
          className="w-full border border-dashed border-brand-border hover:border-brand-purple text-brand-text-muted hover:text-brand-purple text-xs font-medium py-2.5 rounded-xl transition-colors"
        >
          + Agregar dirección
        </button>
      )}
    </div>
  )
}
