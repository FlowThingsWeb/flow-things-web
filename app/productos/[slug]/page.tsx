'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/lib/store'
import { Producto } from '@/types'

function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default function ProductoDetallePage() {
  const { slug } = useParams()
  const [producto, setProducto] = useState<Producto | null>(null)
  const [loading, setLoading] = useState(true)
  const [imagenActiva, setImagenActiva] = useState(0)
  const [cantidad, setCantidad] = useState(1)
  const [agregado, setAgregado] = useState(false)
  const addItem = useCartStore((state) => state.addItem)

  useEffect(() => {
    async function fetchProducto() {
      const { data } = await supabase
        .from('productos')
        .select('*, categorias(id, nombre, slug)')
        .eq('slug', slug)
        .eq('activo', true)
        .single()

      if (!data) {
        setLoading(false)
        return
      }
      setProducto(data)
      setLoading(false)
    }
    fetchProducto()
  }, [slug])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center">
        <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!producto) return notFound()

  const todasLasImagenes = [
    ...(producto.imagen_url ? [producto.imagen_url] : []),
    ...producto.imagenes,
  ]

  const tieneDescuento =
    producto.precio_anterior && producto.precio_anterior > producto.precio

  function handleAgregar() {
    if (!producto) return
    for (let i = 0; i < cantidad; i++) {
      addItem(producto)
    }
    setAgregado(true)
    setTimeout(() => setAgregado(false), 2000)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-brand-text-muted mb-8">
        <Link href="/" className="hover:text-brand-purple transition-colors">Inicio</Link>
        <span>/</span>
        <Link href="/productos" className="hover:text-brand-purple transition-colors">Catálogo</Link>
        {producto.categorias && (
          <>
            <span>/</span>
            <Link
              href={`/productos?categoria=${(producto.categorias as any).slug}`}
              className="hover:text-brand-purple transition-colors"
            >
              {(producto.categorias as any).nombre}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-brand-text font-medium truncate">{producto.nombre}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Galería */}
        <div className="space-y-3">
          <div className="relative aspect-square bg-brand-bg-card border border-brand-border rounded-3xl overflow-hidden">
            {todasLasImagenes.length > 0 ? (
              <Image
                src={todasLasImagenes[imagenActiva]}
                alt={producto.nombre}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl">📦</div>
            )}
          </div>
          {todasLasImagenes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {todasLasImagenes.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImagenActiva(i)}
                  className={`relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-colors ${
                    i === imagenActiva
                      ? 'border-brand-purple'
                      : 'border-transparent hover:border-brand-purple/40'
                  }`}
                >
                  <Image
                    src={img}
                    alt={`Vista ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          {producto.categorias && (
            <Link
              href={`/productos?categoria=${(producto.categorias as any).slug}`}
              className="text-brand-purple text-sm font-medium hover:underline"
            >
              {(producto.categorias as any).nombre}
            </Link>
          )}

          <h1 className="text-3xl font-bold text-brand-text leading-tight">
            {producto.nombre}
          </h1>

          {/* Precio */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-brand-neon">
              {formatPrecio(producto.precio)}
            </span>
            {tieneDescuento && (
              <>
                <span className="text-brand-text-muted text-lg line-through">
                  {formatPrecio(producto.precio_anterior!)}
                </span>
                <span className="bg-brand-purple/20 text-brand-purple-light text-sm font-semibold px-2 py-1 rounded-lg">
                  {Math.round(
                    ((producto.precio_anterior! - producto.precio) / producto.precio_anterior!) * 100
                  )}% OFF
                </span>
              </>
            )}
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${producto.stock > 0 ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-brand-text-muted">
              {producto.stock > 5
                ? 'Disponible'
                : producto.stock > 0
                ? `Últimas ${producto.stock} unidades`
                : 'Sin stock'}
            </span>
          </div>

          {/* Descripción */}
          {producto.descripcion && (
            <div className="prose text-brand-text-muted text-sm leading-relaxed border-t border-brand-border pt-6">
              <p>{producto.descripcion}</p>
            </div>
          )}

          {/* Cantidad + Agregar */}
          {producto.stock > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <span className="text-sm text-brand-text-muted font-medium">Cantidad:</span>
                <div className="flex items-center gap-3 bg-brand-bg-soft border border-brand-border rounded-xl px-3 py-2">
                  <button
                    onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                    className="w-6 h-6 flex items-center justify-center text-brand-text-muted hover:text-brand-purple font-bold text-lg"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold text-brand-text">{cantidad}</span>
                  <button
                    onClick={() => setCantidad(Math.min(producto.stock, cantidad + 1))}
                    className="w-6 h-6 flex items-center justify-center text-brand-text-muted hover:text-brand-purple font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleAgregar}
                className={`w-full py-4 rounded-2xl font-semibold text-base transition-all ${
                  agregado
                    ? 'bg-green-500 text-white'
                    : 'bg-brand-purple hover:bg-brand-purple-dark text-white hover:shadow-soft'
                }`}
              >
                {agregado ? '✓ Agregado al carrito' : 'Agregar al carrito'}
              </button>
            </div>
          )}

          {/* Beneficios */}
          <div className="bg-brand-bg-soft rounded-2xl p-4 space-y-3 text-sm text-brand-text-muted">
            <div className="flex items-center gap-2">
              <span>🚚</span>
              <span>Envío a todo el país</span>
            </div>
            <div className="flex items-center gap-2">
              <span>💳</span>
              <span>Hasta 12 cuotas sin interés con Mercado Pago</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🔒</span>
              <span>Compra 100% segura</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
