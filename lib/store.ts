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
  /**
   * true cuando el carrito guardado en el navegador ya se cargó.
   *
   * Arranca en false y coincide con lo que renderiza el servidor, que no
   * tiene forma de conocer el carrito. Ver `skipHydration` más abajo.
   */
  hidratado: boolean
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
      hidratado: false,

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
      /**
       * El carrito NO se carga solo al arrancar.
       *
       * Por defecto zustand lee localStorage antes del primer render del
       * navegador, así que quien tenía algo en el carrito veía el contador con
       * items mientras el servidor había mandado el HTML con el carrito vacío.
       * React detectaba la diferencia, descartaba el HTML del servidor y
       * volvía a dibujar toda la página en el navegador: se pagaba el costo
       * del render dos veces, en cada visita.
       *
       * Ahora la carga la dispara CarritoHidratador después del primer
       * render, cuando ya no hay nada que comparar.
       */
      skipHydration: true,
      // El flag no se guarda: se recalcula en cada carga.
      partialize: (state) => ({ items: state.items, isOpen: state.isOpen }) as CartState,
      onRehydrateStorage: () => () => {
        useCartStore.setState({ hidratado: true })
      },
    }
  )
)
