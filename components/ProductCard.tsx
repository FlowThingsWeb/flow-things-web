'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Producto } from '@/types'
import { useCartStore } from '@/lib/store'

interface ProductCardProps {
  producto: Producto
}

function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default function ProductCard({ producto }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem)

  const tieneDescuento =
    producto.precio_anterior && producto.precio_anterior > producto.precio
  const descuento = tieneDescuento
    ? Math.round(
        ((producto.precio_anterior! - producto.precio) / producto.precio_anterior!) * 100
      )
    : null

  return (
    <div className="group relative bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden hover:border-brand-purple hover:shadow-card-hover transition-all duration-300 flex flex-col">
      {/* Imagen */}
      <Link href={`/productos/${producto.slug}`} className="block relative overflow-hidden aspect-square bg-brand-bg-soft">
        {producto.imagen_url ? (
          <Image
            src={producto.imagen_url}
            alt={producto.nombre}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">📦</span>
          </div>
        )}
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {producto.destacado && (
            <span className="bg-brand-neon text-black text-xs font-black px-2 py-1 rounded-full">
              ★ DESTACADO
            </span>
          )}
          {descuento && (
            <span className="bg-brand-purple text-white text-xs font-semibold px-2 py-1 rounded-full">
              -{descuento}%
            </span>
          )}
        </div>
        {producto.stock === 0 && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <span className="bg-brand-bg-card text-brand-text-muted text-sm font-semibold px-3 py-1 rounded-full border border-brand-border">
              Sin stock
            </span>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/productos/${producto.slug}`}>
          <h3 className="font-medium text-brand-text text-sm leading-snug group-hover:text-brand-neon transition-colors line-clamp-2">
            {producto.nombre}
          </h3>
        </Link>

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div>
            <p className="font-bold text-brand-neon text-base">
              {formatPrecio(producto.precio)}
            </p>
            {tieneDescuento && (
              <p className="text-brand-text-light text-xs line-through">
                {formatPrecio(producto.precio_anterior!)}
              </p>
            )}
          </div>

          <button
            onClick={() => addItem(producto)}
            disabled={producto.stock === 0}
            className="bg-brand-purple hover:bg-brand-purple-light disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
          >
            {producto.stock === 0 ? 'Agotado' : '+ Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}
