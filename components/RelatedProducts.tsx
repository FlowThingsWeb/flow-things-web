'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Producto } from '@/types'
import ProductCard from '@/components/ProductCard'

/**
 * Productos relacionados: otros productos activos de la misma categoría.
 * Palanca de venta cruzada en la ficha (sube el ticket promedio).
 */
export default function RelatedProducts({
  productoId,
  categoriaId,
}: {
  productoId: string
  categoriaId: string | null | undefined
}) {
  const [relacionados, setRelacionados] = useState<Producto[]>([])

  useEffect(() => {
    if (!categoriaId) return
    let cancelado = false
    async function load() {
      const { data } = await supabase
        .from('productos')
        .select('*, categorias(id, nombre, slug)')
        .eq('activo', true)
        .eq('categoria_id', categoriaId)
        .neq('id', productoId)
        .limit(8)
      if (cancelado) return
      setRelacionados(((data as Producto[]) || []).slice(0, 4))
    }
    load()
    return () => { cancelado = true }
  }, [productoId, categoriaId])

  if (relacionados.length === 0) return null

  return (
    <section className="border-t border-brand-border pt-8 mt-8">
      <h2 className="text-xl font-bold text-brand-text mb-6">También te puede gustar</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {relacionados.map((p) => (
          <ProductCard key={p.id} producto={p} />
        ))}
      </div>
    </section>
  )
}
