'use client'

/**
 * CartSync — sincroniza el carrito de Zustand con la tabla carritos_guardados de Supabase.
 *
 * Lógica:
 * - Al hacer login: carga el carrito guardado en DB y lo mergea con el local.
 * - Al cambiar items (debounced 1.5s): guarda en DB si el usuario está logueado.
 * - Al hacer logout: el carrito local queda, pero el de DB persiste para el próximo login.
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/lib/store'

export default function CartSync() {
  const { user } = useAuth()
  const { items, addItem } = useCartStore()
  const prevUserIdRef = useRef<string | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLoadFromDb = useRef(false)

  // Al hacer login, cargar carrito guardado y mergear
  useEffect(() => {
    const prevId = prevUserIdRef.current
    prevUserIdRef.current = user?.id ?? null

    if (!user || user.id === prevId) return

    // Nuevo login: cargar carrito de DB
    didLoadFromDb.current = false

    async function loadCart() {
      try {
        const { data } = await supabase
          .from('carritos_guardados')
          .select('items')
          .eq('user_id', user!.id)
          .maybeSingle()

        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
          // Mergear con el carrito local (el local tiene prioridad para cantidades)
          const localItems = useCartStore.getState().items
          const localIds = new Set(
            localItems.map(i => `${i.producto.id}::${i.varianteId ?? ''}`)
          )
          for (const item of data.items) {
            const key = `${item.producto.id}::${item.varianteId ?? ''}`
            if (!localIds.has(key)) {
              for (let i = 0; i < item.cantidad; i++) {
                addItem(item.producto, item.varianteId ?? undefined)
              }
            }
          }
        }
      } catch {
        // silenciar errores de red
      } finally {
        didLoadFromDb.current = true
      }
    }

    loadCart()
  }, [user, addItem])

  // Al cambiar items, guardar en DB (debounced)
  useEffect(() => {
    if (!user || !didLoadFromDb.current) return

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)

    syncTimerRef.current = setTimeout(async () => {
      try {
        await supabase
          .from('carritos_guardados')
          .upsert({ user_id: user.id, items, updated_at: new Date().toISOString() })
      } catch {
        // silenciar errores de red
      }
    }, 1500)

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [user, items])

  return null
}
