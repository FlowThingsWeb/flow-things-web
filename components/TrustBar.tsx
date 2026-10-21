import Link from 'next/link'
import type { Icon } from '@phosphor-icons/react'
import {
  ArrowsClockwise,
  CreditCard,
  ShieldCheck,
  Truck,
} from '@phosphor-icons/react/dist/ssr'
import { formatPrecio } from '@/lib/format'

/**
 * Barra de garantías, justo debajo de las líneas.
 *
 * Responde las cuatro objeciones que frenan una compra online antes de que el
 * cliente tenga que ir a buscarlas: cuánto sale el envío, en cuántas cuotas,
 * si el pago es seguro y qué pasa si no le gusta.
 *
 * Los números salen de la configuración real de envíos, no están escritos a
 * mano: si cambia el mínimo de envío gratis, cambia acá solo.
 *
 * Los íconos son de Phosphor y no emojis. Un emoji lo dibuja el sistema
 * operativo, así que el camioncito de un iPhone no es el de un Android ni el
 * de una compu, y ninguno de los tres combina con el resto de la página. Acá
 * son cuatro trazos del mismo grosor y del mismo color.
 */
export default function TrustBar({
  envioGratisDesde,
  cuotas = 3,
}: {
  /** Monto a partir del cual el envío es gratis. 0 o NaN = no se muestra. */
  envioGratisDesde: number
  /** Cuotas sin interés vigentes en Mercado Pago. */
  cuotas?: number
}) {
  const items: {
    Icono: Icon
    titulo: string
    detalle: string
    href?: string
  }[] = [
    ...(envioGratisDesde > 0
      ? [
          {
            Icono: Truck,
            titulo: `Envío gratis desde ${formatPrecio(envioGratisDesde)}`,
            detalle: 'A todo el país',
            href: '/productos',
          },
        ]
      : []),
    {
      Icono: CreditCard,
      titulo: `${cuotas} cuotas sin interés`,
      detalle: 'Con tarjeta de crédito, siempre',
    },
    {
      Icono: ShieldCheck,
      titulo: 'Pago protegido',
      detalle: 'Procesado por Mercado Pago',
    },
    {
      Icono: ArrowsClockwise,
      titulo: 'Cambios y devoluciones',
      detalle: 'Hasta 10 días corridos',
      href: '/cambios-y-devoluciones',
    },
  ]

  return (
    <section className="border-b border-brand-border bg-brand-bg-card/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
          {items.map(({ Icono, titulo, detalle, href }) => {
            const contenido = (
              <>
                <Icono
                  size={26}
                  weight="regular"
                  className="shrink-0 text-brand-neon"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white leading-tight">
                    {titulo}
                  </span>
                  <span className="block text-xs text-brand-text-muted mt-0.5">
                    {detalle}
                  </span>
                </span>
              </>
            )
            return (
              <li key={titulo}>
                {href ? (
                  <Link
                    href={href}
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
