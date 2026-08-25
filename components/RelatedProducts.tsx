import { Producto } from '@/types'
import ProductCard from '@/components/ProductCard'

/**
 * Productos relacionados: otros productos activos de la misma categoría.
 * Palanca de venta cruzada en la ficha (sube el ticket promedio).
 *
 * Los trae el servidor (app/productos/[slug]/page.tsx). Antes los pedía en un
 * useEffect: los enlaces entre fichas no existían en el HTML, así que para
 * Google los productos quedaban sin nada que los enlazara más allá del
 * sitemap — que es como terminan en "Descubierta: actualmente sin indexar".
 */
export default function RelatedProducts({ productos }: { productos: Producto[] }) {
  if (productos.length === 0) return null

  return (
    <section className="border-t border-brand-border pt-8 mt-8">
      <h2 className="text-xl font-bold text-brand-text mb-6">También te puede gustar</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {productos.map((p) => (
          <ProductCard key={p.id} producto={p} />
        ))}
      </div>
    </section>
  )
}
