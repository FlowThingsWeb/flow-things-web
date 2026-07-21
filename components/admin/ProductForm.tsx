'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Producto, Categoria, Variante } from '@/types'
import { comprimirImagen, formatBytes } from '@/lib/comprimir-imagen'

interface ProductFormProps {
  producto?: Producto
  categorias: Categoria[]
  mode: 'create' | 'edit'
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

async function uploadFile(file: File): Promise<string> {
  // Redimensionamos y pasamos a webp antes de subir: las fotos del celular
  // vienen en 4000px / varios MB y la web nunca las muestra a ese tamaño.
  // Si algo falla, comprimirImagen devuelve el original y seguimos igual.
  const { archivo, comprimido, bytesAntes, bytesDespues } = await comprimirImagen(file)
  if (comprimido) {
    console.info(
      `[upload] ${file.name}: ${formatBytes(bytesAntes)} → ${formatBytes(bytesDespues)}`,
    )
  }

  const formData = new FormData()
  formData.append('file', archivo)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al subir imagen')
  return data.url as string
}

// ── Formulario de una variante (nueva o edición) ──────────────────────────
interface VarianteFormData {
  atributos: Record<string, string>
  sku: string
  stock: string
  imagen_url: string
}

function VarianteForm({
  productoId,
  initial,
  onSave,
  onCancel,
}: {
  productoId: string
  initial?: Variante
  onSave: (v: Variante) => void
  onCancel: () => void
}) {
  const [atributos, setAtributos] = useState<{ key: string; val: string }[]>(
    initial
      ? Object.entries(initial.atributos).map(([key, val]) => ({ key, val }))
      : [{ key: 'Color', val: '' }]
  )
  const [sku,        setSku]       = useState(initial?.sku || '')
  const [stock,      setStock]     = useState(String(initial?.stock ?? 0))
  const [imagenUrl,  setImagenUrl]  = useState(initial?.imagen_url || '')
  const [imgPreview, setImgPreview] = useState(initial?.imagen_url || '')
  const [imagenes,   setImagenes]   = useState<string[]>(initial?.imagenes || [])
  const [uploading,  setUploading]  = useState(false)
  const [uploadingExtra, setUploadingExtra] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const fileRef      = useRef<HTMLInputElement>(null)
  const extraFileRef = useRef<HTMLInputElement>(null)

  const addAtributo = () => setAtributos(p => [...p, { key: '', val: '' }])
  const removeAtributo = (i: number) => setAtributos(p => p.filter((_, idx) => idx !== i))
  const updateAtributo = (i: number, field: 'key' | 'val', value: string) =>
    setAtributos(p => p.map((a, idx) => idx === i ? { ...a, [field]: value } : a))

  const handleImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setImgPreview(URL.createObjectURL(file))
    try {
      const url = await uploadFile(file)
      setImagenUrl(url)
      setImgPreview(url)
    } catch {
      setError('Error al subir imagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleExtraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingExtra(true)
    try {
      const urls = await Promise.all(files.map(uploadFile))
      setImagenes(prev => [...prev, ...urls])
    } catch {
      setError('Error al subir imagen')
    } finally {
      setUploadingExtra(false)
      e.target.value = ''
    }
  }

  const moveExtra = (idx: number, dir: -1 | 1) => {
    setImagenes(prev => {
      const arr = [...prev]
      const target = idx + dir
      if (target < 0 || target >= arr.length) return arr
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr
    })
  }

  const removeExtra = (idx: number) => {
    setImagenes(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    const validAttrs = atributos.filter(a => a.key.trim() && a.val.trim())
    if (!validAttrs.length) { setError('Agregá al menos un atributo'); return }

    setSaving(true)
    setError('')

    const payload = {
      producto_id: productoId,
      atributos: Object.fromEntries(validAttrs.map(a => [a.key.trim(), a.val.trim()])),
      sku: sku.trim() || null,
      stock: parseInt(stock) || 0,
      imagen_url: imagenUrl || null,
      imagenes,
      activo: true,
      ...(initial ? { id: initial.id } : {}),
    }

    try {
      const res = await fetch('/api/variantes', {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al guardar'); return }
      onSave(data.variante)
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-brand-bg border border-brand-purple/30 rounded-xl p-4 space-y-4">
      {/* Atributos */}
      <div>
        <p className="text-xs font-semibold text-brand-text-muted mb-2">Atributos (ej: Color / Talle)</p>
        <div className="space-y-2">
          {atributos.map((a, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                placeholder="Nombre (ej: Color)"
                value={a.key}
                onChange={e => updateAtributo(i, 'key', e.target.value)}
                className="input-dark flex-1 text-xs"
              />
              <span className="text-brand-text-muted">:</span>
              <input
                placeholder="Valor (ej: Rosa)"
                value={a.val}
                onChange={e => updateAtributo(i, 'val', e.target.value)}
                className="input-dark flex-1 text-xs"
              />
              {atributos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAtributo(i)}
                  className="text-brand-text-muted hover:text-red-400 text-sm w-6 flex-shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addAtributo}
            className="text-xs text-brand-purple hover:underline"
          >
            + Agregar otro atributo
          </button>
        </div>
      </div>

      {/* Stock / SKU */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1">Stock</label>
          <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)}
            className="input-dark text-sm" placeholder="0" />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-text-muted mb-1">SKU</label>
          <input type="text" value={sku} onChange={e => setSku(e.target.value)}
            className="input-dark font-mono text-xs" placeholder="COL-ROSA-M" />
        </div>
      </div>

      {/* Imagen de variante */}
      <div>
        <p className="text-xs font-semibold text-brand-text-muted mb-2">Foto de esta variante</p>
        <div className="flex gap-3 items-center">
          <div
            onClick={() => fileRef.current?.click()}
            className="relative w-16 h-16 rounded-xl overflow-hidden bg-brand-bg-soft border-2 border-dashed border-brand-border hover:border-brand-purple cursor-pointer flex-shrink-0 transition-colors"
          >
            {imgPreview ? (
              <Image src={imgPreview} alt="Variante" fill className="object-cover" sizes="64px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">📷</div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-xs text-brand-purple border border-brand-purple/30 hover:bg-brand-purple/5 px-3 py-1.5 rounded-lg transition-colors block">
              {imgPreview ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {imgPreview && (
              <button type="button" onClick={() => { setImagenUrl(''); setImgPreview('') }}
                className="text-xs text-brand-text-muted hover:text-red-400 px-3 py-1 block">
                Quitar foto
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImgUpload} />
        </div>
      </div>

      {/* Galería extra de la variante */}
      <div>
        <p className="text-xs font-semibold text-brand-text-muted mb-2">
          Fotos adicionales de esta variante
        </p>
        <div className="flex flex-wrap gap-2">
          {imagenes.map((img, idx) => (
            <div key={idx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-brand-border flex-shrink-0">
              <Image src={img} alt={`Extra ${idx + 1}`} fill className="object-cover" sizes="64px" />
              {/* Overlay con acciones */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5">
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveExtra(idx, -1)}
                    disabled={idx === 0}
                    className="w-5 h-5 rounded bg-white/20 hover:bg-white/40 text-white text-xs flex items-center justify-center disabled:opacity-30"
                  >‹</button>
                  <button
                    type="button"
                    onClick={() => moveExtra(idx, 1)}
                    disabled={idx === imagenes.length - 1}
                    className="w-5 h-5 rounded bg-white/20 hover:bg-white/40 text-white text-xs flex items-center justify-center disabled:opacity-30"
                  >›</button>
                </div>
                <button
                  type="button"
                  onClick={() => removeExtra(idx)}
                  className="w-5 h-5 rounded bg-red-500/70 hover:bg-red-500 text-white text-xs flex items-center justify-center"
                >✕</button>
              </div>
            </div>
          ))}

          {/* Botón agregar */}
          <button
            type="button"
            onClick={() => extraFileRef.current?.click()}
            disabled={uploadingExtra}
            className="w-16 h-16 rounded-xl border-2 border-dashed border-brand-border hover:border-brand-purple bg-brand-bg flex items-center justify-center text-brand-text-muted hover:text-brand-purple transition-colors flex-shrink-0 text-xl disabled:opacity-50"
          >
            {uploadingExtra ? (
              <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            ) : '+'}
          </button>
          <input
            ref={extraFileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleExtraUpload}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Acciones */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex-1 bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
        >
          {saving ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear variante'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-brand-text-muted border border-brand-border hover:border-brand-text-muted rounded-xl transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Tarjeta de variante existente ─────────────────────────────────────────
function VarianteCard({
  variante,
  onEdit,
  onDelete,
  onToggle,
}: {
  variante: Variante
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const label = Object.entries(variante.atributos).map(([k, v]) => `${k}: ${v}`).join(' · ')

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
      variante.activo
        ? 'bg-brand-bg-soft border-brand-border'
        : 'bg-brand-bg border-brand-border/50 opacity-60'
    }`}>
      {/* Imagen */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-brand-bg flex-shrink-0 border border-brand-border">
        {variante.imagen_url ? (
          <Image src={variante.imagen_url} alt={label} fill className="object-cover" sizes="48px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">🏷️</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-brand-text truncate">{label}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-brand-text-muted">Stock: <b className="text-white">{variante.stock}</b></span>
          {variante.sku && <span className="font-mono text-[10px] text-brand-neon">{variante.sku}</span>}
          {(variante.imagen_url || variante.imagenes?.length > 0) && (
            <span className="text-[10px] text-green-400">
              📷 {(variante.imagen_url ? 1 : 0) + (variante.imagenes?.length || 0)} foto{((variante.imagen_url ? 1 : 0) + (variante.imagenes?.length || 0)) !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onToggle} title={variante.activo ? 'Desactivar' : 'Activar'}
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
            variante.activo ? 'text-green-400 hover:bg-green-400/10' : 'text-brand-text-muted hover:bg-brand-border'
          }`}>
          {variante.activo ? '●' : '○'}
        </button>
        <button onClick={onEdit} title="Editar"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-brand-text-muted hover:text-brand-purple hover:bg-brand-purple/10 transition-colors">
          ✏️
        </button>
        <button onClick={onDelete} title="Eliminar"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-brand-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
          🗑
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function ProductForm({ producto, categorias, mode }: ProductFormProps) {
  const router = useRouter()
  const mainInputRef  = useRef<HTMLInputElement>(null)
  const extraInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nombre: producto?.nombre || '',
    slug: producto?.slug || '',
    sku: producto?.sku || '',
    descripcion: producto?.descripcion || '',
    precio: producto?.precio?.toString() || '',
    precio_anterior: producto?.precio_anterior?.toString() || '',
    stock: producto?.stock?.toString() || '0',
    categoria_id: producto?.categoria_id || '',
    activo: producto?.activo ?? true,
    destacado: producto?.destacado ?? false,
    imagen_url: producto?.imagen_url || '',
  })

  const [galeria, setGaleria] = useState<string[]>(producto?.imagenes || [])
  const [mainPreview,  setMainPreview]  = useState(producto?.imagen_url || '')
  const [uploadingMain,  setUploadingMain]  = useState(false)
  const [uploadingExtra, setUploadingExtra] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Variantes
  const [variantsList, setVariantsList] = useState<Variante[]>([])
  const [showNuevaVariante, setShowNuevaVariante] = useState(false)
  const [editingVarianteId, setEditingVarianteId] = useState<string | null>(null)

  // Cargar variantes existentes al editar
  useEffect(() => {
    if (producto?.id) {
      fetch(`/api/variantes?producto_id=${producto.id}`)
        .then(r => r.json())
        .then(d => setVariantsList(d.variantes || []))
        .catch(() => {})
    }
  }, [producto?.id])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'nombre' && mode === 'create' ? { slug: slugify(value) } : {}),
    }))
  }

  const handleMainUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingMain(true)
    setError('')
    setMainPreview(URL.createObjectURL(file))
    try {
      const url = await uploadFile(file)
      setForm(prev => ({ ...prev, imagen_url: url }))
      setMainPreview(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir imagen')
      setMainPreview(form.imagen_url)
    } finally {
      setUploadingMain(false)
      e.target.value = ''
    }
  }

  const handleExtraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingExtra(true)
    setError('')
    try {
      const urls = await Promise.all(files.map(uploadFile))
      setGaleria(prev => [...prev, ...urls])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir imagen')
    } finally {
      setUploadingExtra(false)
      e.target.value = ''
    }
  }

  const removeGaleriaImage = (idx: number) =>
    setGaleria(prev => prev.filter((_, i) => i !== idx))

  const moveImage = (idx: number, dir: -1 | 1) => {
    setGaleria(prev => {
      const arr = [...prev]
      const t = idx + dir
      if (t < 0 || t >= arr.length) return arr
      ;[arr[idx], arr[t]] = [arr[t], arr[idx]]
      return arr
    })
  }

  // Variante handlers
  const handleVarianteSaved = (v: Variante) => {
    setVariantsList(prev => {
      const existing = prev.findIndex(x => x.id === v.id)
      if (existing >= 0) {
        const arr = [...prev]
        arr[existing] = v
        return arr
      }
      return [...prev, v]
    })
    setShowNuevaVariante(false)
    setEditingVarianteId(null)
  }

  const handleDeleteVariante = async (id: string) => {
    if (!confirm('¿Eliminar esta variante?')) return
    await fetch(`/api/variantes?id=${id}`, { method: 'DELETE' })
    setVariantsList(prev => prev.filter(v => v.id !== id))
  }

  const handleToggleVariante = async (variante: Variante) => {
    const res = await fetch('/api/variantes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variante.id, activo: !variante.activo }),
    })
    const data = await res.json()
    if (res.ok) handleVarianteSaved(data.variante)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const body = {
        ...form,
        sku: form.sku.trim() || null,
        precio: parseFloat(form.precio),
        precio_anterior: form.precio_anterior ? parseFloat(form.precio_anterior) : null,
        stock: parseInt(form.stock),
        categoria_id: form.categoria_id || null,
        imagenes: galeria,
        ...(mode === 'edit' && producto ? { id: producto.id } : {}),
      }
      const res = await fetch('/api/productos', {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al guardar'); return }
      router.push('/admin/productos')
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const anyUploading = uploadingMain || uploadingExtra
  const productoId = producto?.id || ''

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* ── Columna principal ── */}
      <div className="lg:col-span-2 space-y-6">

        {/* Información */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-white">Información del producto</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">Nombre *</label>
              <input type="text" name="nombre" required value={form.nombre} onChange={handleChange}
                className="input-dark" placeholder="Lapicera Pilot G2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">SKU</label>
              <input type="text" name="sku" value={form.sku} onChange={handleChange}
                className="input-dark font-mono" placeholder="LAP-G2-001" />
              <p className="text-xs text-brand-text-light mt-1">Código único del producto</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-muted mb-1">Slug (URL)</label>
            <input type="text" name="slug" required value={form.slug} onChange={handleChange}
              className="input-dark font-mono text-xs" placeholder="lapicera-pilot-g2" />
            <p className="text-xs text-brand-text-light mt-1">URL: /productos/{form.slug}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-muted mb-1">Descripción</label>
            <textarea name="descripcion" value={form.descripcion} onChange={handleChange}
              rows={4} className="input-dark resize-none" placeholder="Describí el producto..." />
          </div>
        </div>

        {/* Precio y stock */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Precio y stock general</h3>
          <p className="text-xs text-brand-text-muted mb-4">
            Si el producto tiene variantes, el stock de cada variante es independiente. El stock general se usa solo si no hay variantes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">Precio (ARS) *</label>
              <input type="number" name="precio" required min="0" step="0.01"
                value={form.precio} onChange={handleChange} className="input-dark" placeholder="1500.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">Precio anterior</label>
              <input type="number" name="precio_anterior" min="0" step="0.01"
                value={form.precio_anterior} onChange={handleChange} className="input-dark" placeholder="2000.00" />
              <p className="text-xs text-brand-text-light mt-1">Para mostrar descuento</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">Stock *</label>
              <input type="number" name="stock" required min="0"
                value={form.stock} onChange={handleChange} className="input-dark" placeholder="50" />
            </div>
          </div>
        </div>

        {/* ── Galería de imágenes ── */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-white">Galería de imágenes</h3>
              <p className="text-xs text-brand-text-muted mt-0.5">
                Imágenes generales del producto · {galeria.length} adicional{galeria.length !== 1 ? 'es' : ''}
              </p>
            </div>
            <button type="button" onClick={() => extraInputRef.current?.click()}
              disabled={uploadingExtra}
              className="flex items-center gap-1.5 text-xs bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple border border-brand-purple/30 px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
              {uploadingExtra
                ? <><div className="w-3 h-3 border border-brand-purple border-t-transparent rounded-full animate-spin" />Subiendo...</>
                : <>+ Agregar imágenes</>}
            </button>
          </div>
          <input ref={extraInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleExtraUpload} />

          {galeria.length === 0 ? (
            <div className="border-2 border-dashed border-brand-border rounded-xl p-8 text-center cursor-pointer hover:border-brand-purple transition-colors"
              onClick={() => extraInputRef.current?.click()}>
              <p className="text-2xl mb-2">🖼️</p>
              <p className="text-sm text-brand-text-muted">Hacé clic para agregar imágenes de galería</p>
              <p className="text-xs text-brand-text-light mt-1">JPG, PNG, WebP · Máx 5 MB c/u</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {galeria.map((url, idx) => (
                <div key={url + idx} className="relative group aspect-square rounded-xl overflow-hidden bg-brand-bg-soft border border-brand-border">
                  <Image src={url} alt={`Imagen ${idx + 1}`} fill className="object-cover" sizes="120px" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    <button type="button" onClick={() => removeGaleriaImage(idx)}
                      className="w-7 h-7 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center text-xs font-bold">✕</button>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveImage(idx, -1)} disabled={idx === 0}
                        className="w-6 h-6 bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white rounded-full flex items-center justify-center text-xs">‹</button>
                      <button type="button" onClick={() => moveImage(idx, 1)} disabled={idx === galeria.length - 1}
                        className="w-6 h-6 bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white rounded-full flex items-center justify-center text-xs">›</button>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => extraInputRef.current?.click()}
                disabled={uploadingExtra}
                className="aspect-square rounded-xl border-2 border-dashed border-brand-border hover:border-brand-purple text-brand-text-muted hover:text-brand-purple transition-colors flex flex-col items-center justify-center gap-1 text-xs disabled:opacity-50">
                {uploadingExtra
                  ? <div className="w-4 h-4 border border-brand-purple border-t-transparent rounded-full animate-spin" />
                  : <><span className="text-xl">+</span><span>Agregar</span></>}
              </button>
            </div>
          )}
        </div>

        {/* ── Variantes ── */}
        {(mode === 'edit' && productoId) ? (
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white">Variantes</h3>
                <p className="text-xs text-brand-text-muted mt-0.5">
                  Cada variante puede tener su propia foto, stock y SKU
                </p>
              </div>
              {!showNuevaVariante && !editingVarianteId && (
                <button type="button" onClick={() => setShowNuevaVariante(true)}
                  className="flex items-center gap-1.5 text-xs bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple border border-brand-purple/30 px-3 py-2 rounded-xl transition-colors">
                  + Agregar variante
                </button>
              )}
            </div>

            <div className="space-y-2">
              {variantsList.map(v => (
                editingVarianteId === v.id ? (
                  <VarianteForm
                    key={v.id}
                    productoId={productoId}
                    initial={v}
                    onSave={handleVarianteSaved}
                    onCancel={() => setEditingVarianteId(null)}
                  />
                ) : (
                  <VarianteCard
                    key={v.id}
                    variante={v}
                    onEdit={() => { setEditingVarianteId(v.id); setShowNuevaVariante(false) }}
                    onDelete={() => handleDeleteVariante(v.id)}
                    onToggle={() => handleToggleVariante(v)}
                  />
                )
              ))}
            </div>

            {showNuevaVariante && (
              <div className="mt-3">
                <VarianteForm
                  productoId={productoId}
                  onSave={handleVarianteSaved}
                  onCancel={() => setShowNuevaVariante(false)}
                />
              </div>
            )}

            {variantsList.length === 0 && !showNuevaVariante && (
              <div className="border-2 border-dashed border-brand-border rounded-xl p-6 text-center mt-2 cursor-pointer hover:border-brand-purple transition-colors"
                onClick={() => setShowNuevaVariante(true)}>
                <p className="text-xl mb-1">🏷️</p>
                <p className="text-sm text-brand-text-muted">Sin variantes · Hacé clic para crear la primera</p>
                <p className="text-xs text-brand-text-light mt-1">Ej: Color Rosa / Talle M, Color Azul / Talle L</p>
              </div>
            )}
          </div>
        ) : mode === 'create' ? (
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-4">
            <p className="text-sm text-brand-text-muted text-center">
              💡 Guardá el producto primero, luego podés agregar variantes con foto desde la pantalla de edición.
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Columna lateral ── */}
      <div className="space-y-6">

        {/* Imagen principal */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-1">Imagen principal</h3>
          <p className="text-xs text-brand-text-muted mb-4">Se usa en el catálogo y como primera foto del producto</p>
          <div
            className="relative aspect-square rounded-xl overflow-hidden bg-brand-bg-soft border-2 border-dashed border-brand-border cursor-pointer hover:border-brand-purple transition-colors mb-3"
            onClick={() => mainInputRef.current?.click()}>
            {mainPreview ? (
              <Image src={mainPreview} alt="Preview" fill className="object-cover" sizes="240px" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-brand-text-muted">
                <span className="text-3xl">📷</span>
                <span className="text-xs text-center">Hacé clic para subir</span>
              </div>
            )}
            {uploadingMain && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <input ref={mainInputRef} type="file" accept="image/*" className="hidden" onChange={handleMainUpload} />
          <button type="button" onClick={() => mainInputRef.current?.click()}
            className="w-full text-sm text-brand-purple border border-brand-purple/30 hover:bg-brand-purple/5 py-2 rounded-xl transition-colors">
            {mainPreview ? 'Cambiar imagen principal' : 'Subir imagen principal'}
          </button>
        </div>

        {/* Categoría y estado */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-white">Organización</h3>
          <div>
            <label className="block text-sm font-medium text-brand-text-muted mb-1">Categoría</label>
            <select name="categoria_id" value={form.categoria_id} onChange={handleChange} className="input-dark">
              <option value="">Sin categoría</option>
              {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange}
              className="w-4 h-4 accent-brand-purple rounded" />
            <span className="text-sm text-brand-text">Producto activo (visible en tienda)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="destacado" checked={form.destacado} onChange={handleChange}
              className="w-4 h-4 accent-brand-purple rounded" />
            <span className="text-sm text-brand-text">Producto destacado (aparece en el home)</span>
          </label>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl p-3 text-sm">{error}</div>
        )}

        <button type="submit" disabled={saving || anyUploading}
          className="w-full bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...</>
          ) : anyUploading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Subiendo imagen...</>
          ) : mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
        </button>

        {mode === 'edit' && productoId && (
          <button
            type="button"
            className="w-full border border-red-700/50 text-red-400 hover:bg-red-900/20 py-2.5 rounded-xl text-sm transition-colors"
            onClick={async () => {
              const nombre = form.nombre || 'este producto'
              if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return
              const res = await fetch(`/api/productos?id=${productoId}`, { method: 'DELETE' })
              if (res.ok) {
                router.push('/admin/productos')
                router.refresh()
              } else {
                const d = await res.json()
                setError(d.error || 'Error al eliminar el producto')
              }
            }}
          >
            Eliminar producto
          </button>
        )}
      </div>
    </form>
  )
}
