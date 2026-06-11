'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface FilaPreview {
  nombre: string
  sku: string
  precio: number
  categoria: string
  variante_sku?: string
  atributos: Record<string, string>
  stock: number
  error?: string
}

interface ResultadoImport {
  insertados: number
  actualizados: number
  errores: { fila: number; mensaje: string }[]
}

export default function ImportarProductosPage() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<FilaPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [parseando, setParseando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImport | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // --- Descargar plantilla ---
  const descargarPlantilla = async () => {
    const res = await fetch('/api/admin/importar?template=1')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_productos_flow_things.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- Preview del archivo ---
  const handleArchivo = async (file: File) => {
    setArchivo(file)
    setResultado(null)
    setError('')
    setParseando(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('preview', '1')

    try {
      const res = await fetch('/api/admin/importar', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al leer el archivo'); return }
      setPreview(data.filas || [])
    } catch {
      setError('Error al leer el archivo')
    } finally {
      setParseando(false)
    }
  }

  // --- Importar ---
  const importar = async () => {
    if (!archivo) return
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', archivo)

    try {
      const res = await fetch('/api/admin/importar', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al importar'); return }
      setResultado(data)
      setPreview([])
      setArchivo(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/productos" className="text-brand-text-muted hover:text-white transition-colors">
          ← Productos
        </Link>
        <span className="text-brand-border">/</span>
        <h1 className="text-2xl font-bold text-white">Importación masiva</h1>
      </div>

      {/* Plantilla */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white mb-1">1. Descargá la plantilla</h2>
            <p className="text-brand-text-muted text-sm">
              Completá el Excel con tus productos. Un producto con variantes ocupa múltiples filas (una por combinación).
            </p>
            <div className="mt-3 text-xs text-brand-text-light space-y-1">
              <p>• <strong className="text-brand-text-muted">sku</strong> — código único del producto (requerido)</p>
              <p>• <strong className="text-brand-text-muted">variante_sku</strong> — SKU de la variante (requerido si hay variantes)</p>
              <p>• <strong className="text-brand-text-muted">atributo_1_tipo / valor</strong> — ej: Color / Rosa</p>
              <p>• <strong className="text-brand-text-muted">atributo_2_tipo / valor</strong> — ej: Talle / M (opcional)</p>
              <p>• Si un producto tiene variantes, el <strong className="text-brand-text-muted">stock</strong> va en cada fila de variante</p>
            </div>
          </div>
          <button
            onClick={descargarPlantilla}
            className="flex-shrink-0 flex items-center gap-2 bg-brand-bg-soft border border-brand-border hover:border-brand-neon text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <span>📥</span> Descargar plantilla
          </button>
        </div>
      </div>

      {/* Upload */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-white mb-4">2. Subí tu Excel completo</h2>

        <label
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors ${
            archivo ? 'border-brand-purple bg-brand-purple/5' : 'border-brand-border hover:border-brand-purple/50'
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) handleArchivo(f)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleArchivo(f)
            }}
          />
          {parseando ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              <p className="text-brand-text-muted text-sm">Leyendo archivo...</p>
            </div>
          ) : archivo ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-3xl">✅</span>
              <p className="text-white font-medium text-sm">{archivo.name}</p>
              <p className="text-brand-text-muted text-xs">{preview.length} filas detectadas</p>
              <p className="text-brand-purple text-xs mt-1">Clic para cambiar archivo</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-3xl">📊</span>
              <p className="text-white font-medium text-sm">Arrastrá tu Excel o hacé clic</p>
              <p className="text-brand-text-muted text-xs">.xlsx o .xls — máx 10MB</p>
            </div>
          )}
        </label>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between">
            <h2 className="font-semibold text-white">3. Revisá y confirmá</h2>
            <span className="text-brand-text-muted text-sm">{preview.length} filas</span>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-brand-bg-soft">
                <tr>
                  {['SKU', 'Nombre', 'Precio', 'Categoría', 'Variante SKU', 'Atributos', 'Stock'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-brand-text-muted font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {preview.map((fila, i) => (
                  <tr key={i} className={fila.error ? 'bg-red-900/20' : ''}>
                    <td className="px-4 py-2 text-brand-neon font-mono">{fila.sku}</td>
                    <td className="px-4 py-2 text-white max-w-xs truncate">{fila.nombre}</td>
                    <td className="px-4 py-2 text-white">${fila.precio?.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-2 text-brand-text-muted">{fila.categoria}</td>
                    <td className="px-4 py-2 text-brand-purple font-mono">{fila.variante_sku || '—'}</td>
                    <td className="px-4 py-2 text-brand-text-muted">
                      {Object.entries(fila.atributos || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-2 text-white">{fila.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="px-6 py-3 bg-red-900/30 border-t border-red-700 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="px-6 py-4 border-t border-brand-border">
            <button
              onClick={importar}
              disabled={loading}
              className="bg-brand-purple hover:bg-brand-purple-light disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importando...
                </>
              ) : (
                `Importar ${preview.length} filas`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">✅ Importación completada</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{resultado.insertados}</p>
              <p className="text-xs text-brand-text-muted mt-1">Productos nuevos</p>
            </div>
            <div className="bg-brand-purple/20 border border-brand-purple rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-brand-purple-light">{resultado.actualizados}</p>
              <p className="text-xs text-brand-text-muted mt-1">Actualizados</p>
            </div>
            {resultado.errores.length > 0 && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{resultado.errores.length}</p>
                <p className="text-xs text-brand-text-muted mt-1">Errores</p>
              </div>
            )}
          </div>
          {resultado.errores.length > 0 && (
            <div className="space-y-1">
              {resultado.errores.map((e, i) => (
                <p key={i} className="text-xs text-red-400">Fila {e.fila}: {e.mensaje}</p>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <Link
              href="/admin/productos"
              className="bg-brand-purple hover:bg-brand-purple-light text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
            >
              Ver productos →
            </Link>
            <button
              onClick={() => { setResultado(null); setArchivo(null); if (inputRef.current) inputRef.current.value = '' }}
              className="bg-brand-bg-soft border border-brand-border hover:border-brand-purple text-white text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              Importar otro archivo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
