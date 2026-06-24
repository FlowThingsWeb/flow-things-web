'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCartStore } from '@/lib/store'

function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateCantidad, total } = useCartStore()
  const totalAmount = total()

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [closeCart])

  // Bloquear scroll del body
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-50 animate-fade-in"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-brand-bg-card border-l border-brand-border z-50 shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h2 className="font-semibold text-brand-text text-lg">
            Tu carrito {items.length > 0 && `(${items.length})`}
          </h2>
          <button
            onClick={closeCart}
            className="p-2 text-brand-text-muted hover:text-brand-text rounded-lg hover:bg-brand-border/50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <span className="text-5xl">🛒</span>
              <p className="text-brand-text-muted">Tu carrito está vacío</p>
              <button
                onClick={closeCart}
                className="text-brand-purple text-sm font-medium hover:underline"
              >
                Seguir comprando
              </button>
            </div>
          ) : (
            items.map(({ producto, cantidad, varianteId }) => (
              <div key={`${producto.id}::${varianteId ?? ''}`} className="flex gap-3 bg-brand-bg-soft border border-brand-border rounded-xl p-3">
                {/* Imagen */}
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-brand-bg flex-shrink-0">
                  {producto.imagen_url ? (
                    <Image
                      src={producto.imagen_url}
                      alt={producto.nombre}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-text line-clamp-1">
                    {producto.nombre}
                  </p>
                  <p className="text-brand-neon font-semibold text-sm mt-1">
                    {formatPrecio(producto.precio)}
                  </p>

                  {/* Controles cantidad */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateCantidad(producto.id, cantidad - 1, varianteId)}
                      className="w-6 h-6 rounded-full bg-brand-border hover:bg-brand-purple hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
                    >
                      −
                    </button>
                    <span className="text-sm font-medium w-4 text-center">{cantidad}</span>
                    <button
                      onClick={() => updateCantidad(producto.id, cantidad + 1, varianteId)}
                      className="w-6 h-6 rounded-full bg-brand-border hover:bg-brand-purple hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeItem(producto.id, varianteId)}
                      className="ml-auto text-brand-text-light hover:text-red-400 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-brand-border p-5 space-y-4">
            {/* Progreso envío gratis */}
            {(() => {
              const AMBA = 40000
              const INTERIOR = 120000
              const pctAmba = Math.min(100, (totalAmount / AMBA) * 100)
              const pctInterior = Math.min(100, (totalAmount / INTERIOR) * 100)
              const libreAmba = totalAmount >= AMBA
              const libreInterior = totalAmount >= INTERIOR

              if (libreInterior) {
                return (
                  <div className="bg-green-900/30 border border-green-500/30 rounded-xl px-3 py-2">
                    <p className="text-xs text-green-300 font-medium">
                      🎉 ¡Envío gratis a todo el país!
                    </p>
                  </div>
                )
              }

              return (
                <div className="bg-brand-bg-soft rounded-xl p-3 space-y-3">
                  {/* AMBA */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-brand-text-muted">🚚 AMBA</p>
                      {libreAmba
                        ? <span className="text-xs text-green-400 font-semibold">¡Gratis! ✓</span>
                        : <span className="text-xs text-brand-text-muted">Falta <span className="text-white font-bold">{formatPrecio(AMBA - totalAmount)}</span></span>
                      }
                    </div>
                    <div className="w-full h-1.5 bg-brand-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${libreAmba ? 'bg-green-400' : 'bg-brand-neon'}`} style={{ width: `${pctAmba}%` }} />
                    </div>
                  </div>
                  {/* Interior */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-brand-text-muted">🚚 Interior del país</p>
                      <span className="text-xs text-brand-text-muted">Falta <span className="text-white font-bold">{formatPrecio(INTERIOR - totalAmount)}</span></span>
                    </div>
                    <div className="w-full h-1.5 bg-brand-border rounded-full overflow-hidden">
                      <div className="h-full bg-brand-purple rounded-full transition-all duration-500" style={{ width: `${pctInterior}%` }} />
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="flex items-center justify-between">
              <span className="text-brand-text-muted text-sm">Subtotal</span>
              <span className="font-bold text-brand-text text-lg">
                {formatPrecio(totalAmount)}
              </span>
            </div>
            <p className="text-xs text-brand-text-light">
              Descuentos calculados al finalizar la compra
            </p>
            <Link
              href="/carrito"
              onClick={closeCart}
              className="block w-full bg-brand-purple hover:bg-brand-purple-dark text-white font-semibold py-3 rounded-xl text-center transition-colors"
            >
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
