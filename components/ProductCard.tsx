'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Producto, Variante } from '@/types'
import { useCartStore } from '@/lib/store'
import FavoritoButton from '@/components/FavoritoButton'
import Stars from '@/components/Stars'
import { formatPrecio } from '@/lib/format'

interface ProductCardProps {
  producto: Producto
  variante?: Variante | null
  rating?: { promedio: number; cantidad: number } | null
}

export default function ProductCard({ producto, variante, rating }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem)

  // Primera variante activa que tenga alguna imagen. Sirve de red de
  // seguridad para productos que no cargaron imagen principal y tienen las
  // fotos sólo en sus variantes (si no, la card salía con el 📦).
  const varianteConImagen = producto.variantes?.find(
    (v) => v.activo !== false && (v.imagen_url || v.imagenes?.[0]),
  )

  // Imagen en cascada: variante propia → galería variante → imagen producto
  // → galería producto → imagen de alguna variante del producto
  const imagenUrl =
    variante?.imagen_url ||
    variante?.imagenes?.[0] ||
    producto.imagen_url ||
    producto.imagenes?.[0] ||
    varianteConImagen?.imagen_url ||
    varianteConImagen?.imagenes?.[0] ||
    null
  const stockVal   = variante ? variante.stock : producto.stock
  const sinStock   = stockVal === 0

  const varLabel   = variante
    ? Object.values(variante.atributos).join(' / ')
    : null

  const nombre     = varLabel ? `${producto.nombre} — ${varLabel}` : producto.nombre
  const href       = variante
    ? `/productos/${producto.slug}?variante=${variante.id}`
    : `/productos/${producto.slug}`

  const tieneDescuento = producto.precio_anterior && producto.precio_anterior > producto.precio
  const descuento = tieneDescuento
    ? Math.round(((producto.precio_anterior! - producto.precio) / producto.precio_anterior!) * 100)
    : null

  const handleAgregar = () => {
    if (sinStock) return
    addItem({
      ...producto,
      nombre,
      imagen_url: imagenUrl,
      stock: stockVal,
    })
  }

  return (
    <div className="group relative bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden hover:border-brand-purple hover:shadow-card-hover transition-all duration-300 flex flex-col">
      {/* Imagen */}
      <Link href={href} className="block relative overflow-hidden aspect-square bg-brand-bg-soft">
        {imagenUrl ? (
          <Image
            src={imagenUrl}
            alt={nombre}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">📦</span>
          </div>
        )}

        {/* Favorito */}
        <div className="absolute top-2 right-2 z-10">
          <FavoritoButton productoId={producto.id} />
        </div>

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

        {sinStock && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <span className="bg-brand-bg-card text-brand-text-muted text-sm font-semibold px-3 py-1 rounded-full border border-brand-border">
              Sin stock
            </span>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <Link href={href}>
          <h3 className="font-medium text-brand-text text-sm leading-snug group-hover:text-brand-neon transition-colors line-clamp-2">
            {nombre}
          </h3>
        </Link>

        {rating && rating.cantidad > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <Stars value={rating.promedio} size={13} />
            <span className="text-xs text-brand-text-light">({rating.cantidad})</span>
          </div>
        )}

        {/* Precio arriba y botón full-width abajo: en cards angostas (grilla
            de 4) el precio largo empujaba el botón fuera del card y, como el
            contenedor tiene overflow-hidden, quedaba cortado ("+ Ag"). */}
        <div className="mt-auto pt-3 space-y-2">
          <div className="min-w-0">
            <p className="font-bold text-brand-neon text-base truncate">
              {formatPrecio(producto.precio)}
            </p>
            {tieneDescuento && (
              <p className="text-brand-text-light text-xs line-through truncate">
                {formatPrecio(producto.precio_anterior!)}
              </p>
            )}
          </div>

          <button
            onClick={handleAgregar}
            disabled={sinStock}
            className="w-full bg-brand-purple hover:bg-brand-purple-light disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
          >
            {sinStock ? 'Agotado' : '+ Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}
