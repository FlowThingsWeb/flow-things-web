/**
 * Preguntas frecuentes al pie de cada categoría.
 *
 * Dos motivos, los dos reales: responde lo que la gente pregunta antes de
 * comprar (cuánto sale el envío, en cuánto llega, cómo se paga), y le da a la
 * página texto propio con las palabras que se buscan. El mismo contenido va
 * como FAQPage en los datos estructurados, que es lo que Google puede mostrar
 * desplegado debajo del resultado.
 *
 * Las respuestas salen de la configuración real del sitio: si mañana cambia el
 * costo de envío, cambian solas. Nada acá está escrito a mano.
 */
import { formatPrecio } from '@/lib/format'

type Config = Record<string, string>

export type ItemFaq = { pregunta: string; respuesta: string }

const num = (v: string | undefined) => Number(v || 0)

export function faqDeCategoria(nombreCategoria: string, cfg: Config): ItemFaq[] {
  const caba = num(cfg.envio_precio_caba)
  const cabaGratis = num(cfg.envio_gratis_caba_desde)
  const gba = num(cfg.envio_precio_gba)
  const interior = num(cfg.envio_precio_interior)
  const interiorGratis = num(cfg.envio_gratis_interior_desde)
  const cat = nombreCategoria.toLowerCase()

  const faq: ItemFaq[] = []

  faq.push({
    pregunta: `¿Hacen envíos de ${cat} a todo el país?`,
    respuesta:
      `Sí. Enviamos a CABA (${cfg.envio_tiempo_caba || 'hasta 24 hs hábiles'}), ` +
      `Gran Buenos Aires (${cfg.envio_tiempo_gba || '48-72 hs hábiles'}) y al interior ` +
      `del país (${cfg.envio_tiempo_interior || 'hasta 12 días hábiles'}).`,
  })

  if (caba) {
    faq.push({
      pregunta: '¿Cuánto cuesta el envío?',
      respuesta:
        `El envío a CABA cuesta ${formatPrecio(caba)}` +
        (cabaGratis ? `, y es gratis en compras desde ${formatPrecio(cabaGratis)}` : '') +
        (gba ? `. A Gran Buenos Aires, ${formatPrecio(gba)}` : '') +
        (interior
          ? `. Al interior del país, ${formatPrecio(interior)}` +
            (interiorGratis ? `, gratis desde ${formatPrecio(interiorGratis)}` : '')
          : '') +
        '.',
    })
  }

  faq.push({
    pregunta: '¿Cómo puedo pagar?',
    respuesta:
      'Con Mercado Pago: tarjeta de crédito en hasta 12 cuotas, tarjeta de débito, ' +
      'dinero en cuenta o transferencia.',
  })

  faq.push({
    pregunta: '¿Puedo cambiar o devolver un producto?',
    respuesta:
      'Sí. Tenés 10 días corridos desde que recibís el pedido para arrepentirte de la ' +
      'compra, según la Ley de Defensa del Consumidor. Las condiciones están en la ' +
      'página de cambios y devoluciones.',
  })

  return faq
}

export default function FaqCategoria({ faq }: { faq: ItemFaq[] }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <h2 className="text-2xl font-bold text-brand-text mb-6">Preguntas frecuentes</h2>
      <dl className="space-y-4 max-w-3xl">
        {faq.map((f) => (
          <div key={f.pregunta} className="bg-brand-bg-card border border-brand-border rounded-2xl p-5">
            <dt className="font-semibold text-white">{f.pregunta}</dt>
            <dd className="text-brand-text-muted mt-2 leading-relaxed">{f.respuesta}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
