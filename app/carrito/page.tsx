'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/store'
import { DatosComprador } from '@/types'

function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(precio)
}

const formInicial: DatosComprador = {
  nombre: '',
  email: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  provincia: '',
  codigo_postal: '',
}

interface DescuentoAplicado {
  codigo: string
  tipo: 'porcentaje' | 'monto_fijo'
  valor: number
  descuento_monto: number
  mensaje: string
}

export default function CarritoPage() {
  const router = useRouter()
  const { items, removeItem, updateCantidad, total, clearCart } = useCartStore()
  const [form, setForm] = useState<DatosComprador>(formInicial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Descuento
  const [codigoInput, setCodigoInput] = useState('')
  const [descuento, setDescuento] = useState<DescuentoAplicado | null>(null)
  const [descuentoError, setDescuentoError] = useState('')
  const [validandoCodigo, setValidandoCodigo] = useState(false)

  const subtotal = total()
  const totalFinal = Math.max(0, subtotal - (descuento?.descuento_monto ?? 0))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const aplicarCodigo = async () => {
    if (!codigoInput.trim()) return
    setDescuentoError('')
    setDescuento(null)
    setValidandoCodigo(true)

    try {
      const res = await fetch('/api/descuentos/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigoInput.trim(), subtotal }),
      })
      const data = await res.json()

      if (data.valido) {
        setDescuento({
          codigo: data.codigo,
          tipo: data.tipo,
          valor: data.valor,
          descuento_monto: data.descuento_monto,
          mensaje: data.mensaje,
        })
      } else {
        setDescuentoError(data.mensaje || 'No existe un código de descuento así.')
      }
    } catch {
      setDescuentoError('No se pudo verificar el código. Intentá de nuevo.')
    } finally {
      setValidandoCodigo(false)
    }
  }

  const quitarDescuento = () => {
    setDescuento(null)
    setCodigoInput('')
    setDescuentoError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (items.length === 0) return

    setLoading(true)

    try {
      const orderItems = items.map(({ producto, cantidad }) => ({
        id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad,
        imagen_url: producto.imagen_url,
      }))

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems,
          comprador: form,
          codigo_descuento: descuento?.codigo ?? null,
          descuento_monto: descuento?.descuento_monto ?? 0,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al procesar el pedido')
        return
      }

      clearCart()
      window.location.href = data.initPoint
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <span className="text-6xl block mb-4">🛒</span>
        <h1 className="text-2xl font-bold text-brand-text mb-2">Tu carrito está vacío</h1>
        <p className="text-brand-text-muted mb-8">¡Explorá nuestros productos y encontrá algo que te guste!</p>
        <Link
          href="/productos"
          className="bg-brand-purple hover:bg-brand-purple-dark text-white font-semibold px-8 py-3 rounded-2xl transition-colors"
        >
          Ir al catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-brand-text mb-8">Finalizar compra</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-white mb-4">Datos de contacto</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-brand-text-muted mb-1">Nombre completo *</label>
                <input
                  type="text"
                  name="nombre"
                  required
                  value={form.nombre}
                  onChange={handleChange}
                  className="input-dark"
                  placeholder="Juan García"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-text-muted mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="input-dark"
                  placeholder="juan@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-text-muted mb-1">Teléfono *</label>
                <input
                  type="tel"
                  name="telefono"
                  required
                  value={form.telefono}
                  onChange={handleChange}
                  className="input-dark"
                  placeholder="11 1234-5678"
                />
              </div>
            </div>

            <h2 className="font-semibold text-brand-text pt-2">Dirección de envío</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-brand-text-muted mb-1">Calle y número *</label>
                <input
                  type="text"
                  name="direccion"
                  required
                  value={form.direccion}
                  onChange={handleChange}
                  className="input-dark"
                  placeholder="Av. Corrientes 1234, Piso 2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-text-muted mb-1">Ciudad *</label>
                <input
                  type="text"
                  name="ciudad"
                  required
                  value={form.ciudad}
                  onChange={handleChange}
                  className="input-dark"
                  placeholder="Buenos Aires"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-text-muted mb-1">Código postal *</label>
                <input
                  type="text"
                  name="codigo_postal"
                  required
                  value={form.codigo_postal}
                  onChange={handleChange}
                  className="input-dark"
                  placeholder="C1414"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-brand-text-muted mb-1">Provincia *</label>
                <select
                  name="provincia"
                  required
                  value={form.provincia}
                  onChange={handleChange}
                  className="input-dark"
                >
                  <option value="">Seleccioná tu provincia</option>
                  {['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Código de descuento */}
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-4">¿Tenés un código de descuento?</h2>

            {descuento ? (
              /* Descuento aplicado */
              <div className="flex items-center justify-between bg-green-900/25 border border-green-500/40 rounded-xl px-4 py-3">
                <div>
                  <p className="text-green-300 font-semibold text-sm">✅ {descuento.mensaje}</p>
                  <p className="text-green-400/70 text-xs mt-0.5 font-mono tracking-widest">{descuento.codigo}</p>
                </div>
                <button
                  type="button"
                  onClick={quitarDescuento}
                  className="text-brand-text-light hover:text-red-400 text-xs transition-colors ml-4 shrink-0"
                >
                  Quitar
                </button>
              </div>
            ) : (
              /* Input para ingresar código */
              <div className="flex gap-2">
                <input
                  type="text"
                  value={codigoInput}
                  onChange={e => {
                    setCodigoInput(e.target.value.toUpperCase())
                    setDescuentoError('')
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aplicarCodigo() } }}
                  placeholder="Ingresá tu código"
                  maxLength={50}
                  className="input-dark flex-1 uppercase tracking-widest font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={aplicarCodigo}
                  disabled={validandoCodigo || !codigoInput.trim()}
                  className="bg-brand-purple hover:bg-brand-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-xl transition-colors text-sm whitespace-nowrap"
                >
                  {validandoCodigo ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Aplicar'
                  )}
                </button>
              </div>
            )}

            {descuentoError && (
              <p className="text-red-400 text-sm mt-3 flex items-center gap-1.5">
                <span>⚠</span> {descuentoError}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-all hover:shadow-soft text-base flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              `Pagar ${formatPrecio(totalFinal)} con Mercado Pago`
            )}
          </button>

          <p className="text-center text-xs text-brand-text-light">
            Serás redirigido a Mercado Pago para completar el pago de forma segura
          </p>
        </form>

        {/* Resumen del pedido */}
        <div className="space-y-4">
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-4">Resumen del pedido</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {items.map(({ producto, cantidad }) => (
                <div key={producto.id} className="flex gap-3 items-center">
                  <div className="relative w-12 h-12 bg-brand-bg-soft rounded-lg overflow-hidden flex-shrink-0">
                    {producto.imagen_url ? (
                      <Image
                        src={producto.imagen_url}
                        alt={producto.nombre}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-text line-clamp-1">{producto.nombre}</p>
                    <p className="text-xs text-brand-text-muted">x{cantidad}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-brand-text whitespace-nowrap">
                      {formatPrecio(producto.precio * cantidad)}
                    </span>
                    <button
                      onClick={() => removeItem(producto.id)}
                      className="text-brand-text-light hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-brand-border mt-4 pt-4 space-y-2">
              {/* Subtotal */}
              <div className="flex justify-between items-center text-sm text-brand-text-muted">
                <span>Subtotal</span>
                <span>{formatPrecio(subtotal)}</span>
              </div>

              {/* Descuento */}
              {descuento && (
                <div className="flex justify-between items-center text-sm text-green-400">
                  <span className="flex items-center gap-1">
                    🏷️ Descuento
                    <span className="text-xs font-mono text-green-500/70 ml-1">({descuento.codigo})</span>
                  </span>
                  <span className="font-semibold">− {formatPrecio(descuento.descuento_monto)}</span>
                </div>
              )}

              {/* Total final */}
              <div className="flex justify-between items-center pt-2 border-t border-brand-border">
                <span className="font-semibold text-brand-text">Total</span>
                <span className="font-bold text-xl text-brand-text">
                  {formatPrecio(totalFinal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
