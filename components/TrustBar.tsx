import Link from 'next/link'
import { formatPrecio } from '@/lib/format'

/**
 * Barra de garantías, justo debajo del carrusel.
 *
 * Responde las cuatro objeciones que frenan una compra online antes de que el
 * cliente tenga que ir a buscarlas: cuánto sale el envío, en cuántas cuotas,
 * si el pago es seguro y qué pasa si no le gusta.
 *
 * Los números salen de la configuración real de envíos, no están escritos a
 * mano: si cambia el mínimo de envío gratis, cambia acá solo.
 */
export default function TrustBar({
  envioGratisDesde,
}: {
  /** Monto a partir del cual el envío es gratis. 0 o NaN = no se muestra. */
  envioGratisDesde: number
}) {
  const items: { icono: string; titulo: string; detalle: string; href?: string }[] = [
    ...(envioGratisDesde > 0
      ? [
          {
            icono: '🚚',
            titulo: `Envío gratis desde ${formatPrecio(envioGratisDesde)}`,
            detalle: 'En CABA, a domicilio',
            href: '/productos',
          },
        ]
      : []),
    {
      icono: '💳',
      titulo: 'Hasta 12 cuotas',
      detalle: 'Con tarjeta de crédito',
    },
    {
      icono: '🔒',
      titulo: 'Pago protegido',
      detalle: 'Procesado por Mercado Pago',
    },
    {
      icono: '↩️',
      titulo: 'Cambios y devoluciones',
      detalle: 'Hasta 10 días corridos',
      href: '/cambios-y-devoluciones',
    },
  ]

  return (
    <section className="border-b border-brand-border bg-brand-bg-card/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
          {items.map((item) => {
            const contenido = (
              <>
                <span className="text-2xl shrink-0" aria-hidden="true">
                  {item.icono}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white leading-tight">
                    {item.titulo}
                  </span>
                  <span className="block text-xs text-brand-text-muted mt-0.5">
                    {item.detalle}
                  </span>
                </span>
              </>
            )
            return (
              <li key={item.titulo}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 group hover:opacity-90 transition-opacity"
                  >
                    {contenido}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">{contenido}</div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
