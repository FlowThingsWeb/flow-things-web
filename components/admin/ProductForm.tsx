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

export default function ProductForm({ producto, categorias, mode }: ProductFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(producto?.imagen_url || '')

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'nombre' && mode === 'create'
        ? { slug: slugify(value) }
        : {}),
    }))
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const previewUrl = URL.createObjectURL(file)
      setPreview(previewUrl)

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al subir imagen')
        setPreview(form.imagen_url)
        return
      }

      setForm((prev) => ({ ...prev, imagen_url: data.url }))
    } catch {
      setError('Error al subir la imagen')
    } finally {
      setUploading(false)
    }
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
        ...(mode === 'edit' && producto ? { id: producto.id } : {}),
      }

      const res = await fetch('/api/productos', {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al guardar')
        return
      }

      router.push('/admin/productos')
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Columna principal */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-white">Información del producto</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">
                Nombre *
              </label>
              <input
                type="text"
                name="nombre"
                required
                value={form.nombre}
                onChange={handleChange}
                className="input-dark"
                placeholder="Lapicera Pilot G2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">
                SKU
              </label>
              <input
                type="text"
                name="sku"
                value={form.sku}
                onChange={handleChange}
                className="input-dark font-mono"
                placeholder="LAP-G2-001"
              />
              <p className="text-xs text-brand-text-light mt-1">Código único del producto</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-text-muted mb-1">
              Slug (URL)
            </label>
            <input
              type="text"
              name="slug"
              required
              value={form.slug}
              onChange={handleChange}
              className="input-dark font-mono text-xs"
              placeholder="lapicera-pilot-g2"
            />
            <p className="text-xs text-brand-text-light mt-1">
              URL: /productos/{form.slug}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-text-muted mb-1">
              Descripción
            </label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows={4}
              className="input-dark resize-none"
              placeholder="Describí el producto..."
            />
          </div>
        </div>

        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Precio y stock</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">
                Precio (ARS) *
              </label>
              <input
                type="number"
                name="precio"
                required
                min="0"
                step="0.01"
                value={form.precio}
                onChange={handleChange}
                className="input-dark"
                placeholder="1500.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">
                Precio anterior
              </label>
              <input
                type="number"
                name="precio_anterior"
                min="0"
                step="0.01"
                value={form.precio_anterior}
                onChange={handleChange}
                className="input-dark"
                placeholder="2000.00"
              />
              <p className="text-xs text-brand-text-light mt-1">Para mostrar descuento</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-muted mb-1">
                Stock *
              </label>
              <input
                type="number"
                name="stock"
                required
                min="0"
                value={form.stock}
                onChange={handleChange}
                className="input-dark"
                placeholder="50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Columna lateral */}
      <div className="space-y-6">
        {/* Imagen */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Imagen</h3>
          <div
            className="relative aspect-square rounded-xl overflow-hidden bg-brand-bg-soft border-2 border-dashed border-brand-border cursor-pointer hover:border-brand-purple transition-colors mb-3"
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-cover"
                sizes="240px"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-brand-text-muted">
                <span className="text-3xl">📷</span>
                <span className="text-xs text-center">Hacé clic para subir imagen</span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full text-sm text-brand-purple border border-brand-purple/30 hover:bg-brand-purple/5 py-2 rounded-xl transition-colors"
          >
            {preview ? 'Cambiar imagen' : 'Subir imagen'}
          </button>
        </div>

        {/* Categoría y estado */}
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-white">Organización</h3>

          <div>
            <label className="block text-sm font-medium text-brand-text-muted mb-1">
              Categoría
            </label>
            <select
              name="categoria_id"
              value={form.categoria_id}
              onChange={handleChange}
              className="input-dark"
            >
              <option value="">Sin categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="activo"
              checked={form.activo}
              onChange={handleChange}
              className="w-4 h-4 accent-brand-purple rounded"
            />
            <span className="text-sm text-brand-text">Producto activo (visible en tienda)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="destacado"
              checked={form.destacado}
              onChange={handleChange}
              className="w-4 h-4 accent-brand-purple rounded"
            />
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
          disabled={saving || uploading}
          className="w-full bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando...
            </>
          ) : mode === 'create' ? (
            'Crear producto'
          ) : (
            'Guardar cambios'
          )}
        </button>
      </div>

      <style jsx>{`
        .input-admin {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid #e8e4de;
          background-color: #f2efe9;
          font-size: 0.875rem;
          color: #2a2a2a;
        }
        .input-admin:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(139, 124, 246, 0.3);
        }
      `}</style>
    </form>
  )
}
