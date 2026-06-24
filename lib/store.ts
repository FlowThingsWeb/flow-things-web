'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Producto, ItemCarrito } from '@/types'

/** Clave única por slot de carrito. Combina producto + variante para que dos
 *  variantes distintas del mismo producto ocupen slots separados. */
function cartKey(productoId: string, varianteId?: string): string {
  return varianteId ? `${productoId}::${varianteId}` : productoId
}

interface CartState {
  items: ItemCarrito[]
  isOpen: boolean
  addItem: (producto: Producto, varianteId?: string) => void
  removeItem: (productoId: string, varianteId?: string) => void
  updateCantidad: (productoId: string, cantidad: number, varianteId?: string) => void
  clearCart: () => void
  toggleCart: () => void
  openCart: () => void
  closeCart: () => void
  total: () => number
  cantidadTotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (producto, varianteId) => {
        const items = get().items
        const key = cartKey(producto.id, varianteId)
        const existing = items.find(
          (i) => cartKey(i.producto.id, i.varianteId) === key
        )

        if (existing) {
          set({
            items: items.map((i) =>
              cartKey(i.producto.id, i.varianteId) === key
                ? { ...i, cantidad: i.cantidad + 1 }
                : i
            ),
            isOpen: true,
          })
        } else {
          set({
            items: [...items, { producto, cantidad: 1, varianteId }],
            isOpen: true,
          })
        }
      },

      removeItem: (productoId, varianteId) => {
        const key = cartKey(productoId, varianteId)
        set({
          items: get().items.filter(
            (i) => cartKey(i.producto.id, i.varianteId) !== key
          ),
        })
      },

      updateCantidad: (productoId, cantidad, varianteId) => {
        if (cantidad <= 0) {
          get().removeItem(productoId, varianteId)
          return
        }
        const key = cartKey(productoId, varianteId)
        set({
          items: get().items.map((i) =>
            cartKey(i.producto.id, i.varianteId) === key ? { ...i, cantidad } : i
          ),
        })
      },

      clearCart: () => set({ items: [] }),

      toggleCart: () => set({ isOpen: !get().isOpen }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      total: () =>
        get().items.reduce(
          (acc, item) => acc + item.producto.precio * item.cantidad,
          0
        ),

      cantidadTotal: () =>
        get().items.reduce((acc, item) => acc + item.cantidad, 0),
    }),
    {
      name: 'flow-things-cart',
    }
  )
)
