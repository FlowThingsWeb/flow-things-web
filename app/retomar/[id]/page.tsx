'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/store'
import type { Producto } from '@/types'

/**
 * Retomar compra: vuelve a cargar en el carrito los productos de una orden que
 * quedó pendiente y redirige a /carrito. Se enlaza desde el mail de checkout
 * abandonado.
 */
export default function RetomarPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const updateCantidad = useCartStore((s) => s.updateCantidad)
  const [estado, setEstado] = useState<'cargando' | 'vacio'>('cargando')

  useEffect(() => {
    const id = params?.id
    if (!id) return
    ;(async () => {
      try {
        const res = await fetch(`/api/retomar/${id}`)
        const data = await res.json()
        const items: Array<{ id: string; nombre: string; precio: number; cantidad: number; imagen_url: string | null; variante_id: string | null }> =
          data.items ?? []
        if (items.length === 0) { setEstado('vacio'); return }
        for (const it of items) {
          const producto = {
            id: it.id,
            nombre: it.nombre,
            precio: it.precio,
            imagen_url: it.imagen_url ?? undefined,
          } as unknown as Producto
          addItem(producto, it.variante_id ?? undefined)
          if (it.cantidad > 1) updateCantidad(it.id, it.cantidad, it.variante_id ?? undefined)
        }
        router.replace('/carrito')
      } catch {
        setEstado('vacio')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        {estado === 'cargando' ? (
          <>
            <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-brand-text-muted">Recuperando tu carrito…</p>
          </>
        ) : (
          <>
            <p className="text-brand-text mb-4">Este carrito ya no está disponible (quizás ya lo compraste).</p>
            <a href="/productos" className="text-brand-purple font-semibold hover:underline">Ver todos los productos →</a>
          </>
        )}
      </div>
    </div>
  )
}
