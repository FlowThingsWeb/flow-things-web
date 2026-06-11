'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Producto, ItemCarrito } from '@/types'

interface CartState {
  items: ItemCarrito[]
  isOpen: boolean
  addItem: (producto: Producto) => void
  removeItem: (productoId: string) => void
  updateCantidad: (productoId: string, cantidad: number) => void
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

      addItem: (producto) => {
        const items = get().items
        const existing = items.find((i) => i.producto.id === producto.id)

        if (existing) {
          set({
            items: items.map((i) =>
              i.producto.id === producto.id
                ? { ...i, cantidad: i.cantidad + 1 }
                : i
            ),
            isOpen: true,
          })
        } else {
          set({
            items: [...items, { producto, cantidad: 1 }],
            isOpen: true,
          })
        }
      },

      removeItem: (productoId) => {
        set({ items: get().items.filter((i) => i.producto.id !== productoId) })
      },

      updateCantidad: (productoId, cantidad) => {
        if (cantidad <= 0) {
          get().removeItem(productoId)
          return
        }
        set({
          items: get().items.map((i) =>
            i.producto.id === productoId ? { ...i, cantidad } : i
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
