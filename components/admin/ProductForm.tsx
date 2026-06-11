'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Producto, Categoria } from '@/types'

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
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al subir imagen')
  return data.url as string
}

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

  // Extra gallery images (all except imagen_url)
  const [galeria, setGaleria] = useState<string[]>(producto?.imagenes || [])

  const [mainPreview,  setMainPreview]  = useState(producto?.imagen_url || '')
  const [uploadingMain,  setUploadingMain]  = useState(false)
  const [uploadingExtra, setUploadingExtra] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

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

  // Upload main image
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

  // Upload one or more extra gallery images
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

  const removeGaleriaImage = (idx: number) => {
    setGaleria(prev => prev.filter((_, i) => i !== idx))
  }

  // Move image left/right in gallery
  const moveImage = (idx: number, dir: -1 | 1) => {
    setGaleria(prev => {
      const arr = [...prev]
      const target = idx + dir
      if (target < 0 || target >= arr.length) return arr
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr
    })
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
          <h3 className="font-semibold text-white mb-4">Precio y stock</h3>
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

        {/* ── Galería de imágenes adicionales ── */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-white">Galería de imágenes</h3>
              <p className="text-xs text-brand-text-muted mt-0.5">
                Imágenes adicionales que aparecen en la página del producto · {galeria.length} imagen{galeria.length !== 1 ? 'es' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => extraInputRef.current?.click()}
              disabled={uploadingExtra}
              className="flex items-center gap-1.5 text-xs bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple border border-brand-purple/30 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {uploadingExtra ? (
                <>
                  <div className="w-3 h-3 border border-brand-purple border-t-transparent rounded-full animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>+ Agregar imágenes</>
              )}
            </button>
          </div>

          <input
            ref={extraInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleExtraUpload}
          />

          {galeria.length === 0 ? (
            <div
              className="border-2 border-dashed border-brand-border rounded-xl p-8 text-center cursor-pointer hover:border-brand-purple transition-colors"
              onClick={() => extraInputRef.current?.click()}
            >
              <p className="text-2xl mb-2">🖼️</p>
              <p className="text-sm text-brand-text-muted">Hacé clic para agregar imágenes de galería</p>
              <p className="text-xs text-brand-text-light mt-1">Podés seleccionar varias a la vez · JPG, PNG, WebP · Máx 5 MB c/u</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {galeria.map((url, idx) => (
                <div key={url + idx} className="relative group aspect-square rounded-xl overflow-hidden bg-brand-bg-soft border border-brand-border">
                  <Image
                    src={url}
                    alt={`Imagen ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                  {/* Overlay controls */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => removeGaleriaImage(idx)}
                      className="w-7 h-7 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center text-xs font-bold"
                      title="Eliminar"
                    >
                      ✕
                    </button>
                    {/* Reorder */}
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveImage(idx, -1)}
                        disabled={idx === 0}
                        className="w-6 h-6 bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white rounded-full flex items-center justify-center text-xs"
                        title="Mover izquierda"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(idx, 1)}
                        disabled={idx === galeria.length - 1}
                        className="w-6 h-6 bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white rounded-full flex items-center justify-center text-xs"
                        title="Mover derecha"
                      >
                        ›
                      </button>
                    </div>
                    <span className="text-[10px] text-white/70">{idx + 1}/{galeria.length}</span>
                  </div>
                </div>
              ))}

              {/* Add more button as grid cell */}
              <button
                type="button"
                onClick={() => extraInputRef.current?.click()}
                disabled={uploadingExtra}
                className="aspect-square rounded-xl border-2 border-dashed border-brand-border hover:border-brand-purple text-brand-text-muted hover:text-brand-purple transition-colors flex flex-col items-center justify-center gap-1 text-xs disabled:opacity-50"
              >
                {uploadingExtra ? (
                  <div className="w-4 h-4 border border-brand-purple border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="text-xl">+</span>
                    <span>Agregar</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Columna lateral ── */}
      <div className="space-y-6">

        {/* Imagen principal */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-1">Imagen principal</h3>
          <p className="text-xs text-brand-text-muted mb-4">La que aparece en el catálogo y como primera imagen del producto</p>

          <div
            className="relative aspect-square rounded-xl overflow-hidden bg-brand-bg-soft border-2 border-dashed border-brand-border cursor-pointer hover:border-brand-purple transition-colors mb-3"
            onClick={() => mainInputRef.current?.click()}
          >
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

          <button
            type="button"
            onClick={() => mainInputRef.current?.click()}
            className="w-full text-sm text-brand-purple border border-brand-purple/30 hover:bg-brand-purple/5 py-2 rounded-xl transition-colors"
          >
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
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
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
          <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || anyUploading}
          className="w-full bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando...
            </>
          ) : anyUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Subiendo imagen...
            </>
          ) : mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
