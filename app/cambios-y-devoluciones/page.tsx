import Link from 'next/link'
import LegalPageShell from '@/components/LegalPageShell'

export const metadata = {
  title: 'Cambios y Devoluciones — Flow Things',
  description: 'Política de cambios, devoluciones y garantía de Flow Things.',
}

const EMAIL = 'contacto@flowthings.com.ar'

export default function CambiosDevolucionesPage() {
  return (
    <LegalPageShell title="Cambios y Devoluciones" fecha="10 de julio de 2026">
      <section>
        <p>
          En <strong className="text-brand-text">Flow Things</strong> queremos que compres tranquilo. Acá te explicamos
          cómo funcionan los cambios, las devoluciones y la garantía. Para cualquier gestión, escribinos a{' '}
          <a href={`mailto:${EMAIL}`} className="text-brand-purple hover:underline">{EMAIL}</a> con tu número de orden.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">1. Arrepentimiento (10 días)</h2>
        <p>
          Si te arrepentís de tu compra, tenés <strong className="text-brand-text">10 días corridos</strong> desde que
          recibís el producto para cancelarla sin costo y recibir el 100% del dinero. El costo de la devolución lo
          asumimos nosotros. Es un derecho garantizado por ley.
        </p>
        <p className="mt-2">
          <Link href="/boton-de-arrepentimiento" className="text-brand-purple hover:underline font-medium">
            → Ir al Botón de Arrepentimiento
          </Link>
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">2. Garantía por fallas</h2>
        <p>
          Todos nuestros productos tienen <strong className="text-brand-text">garantía legal</strong>. Si el producto
          llega con una falla de fábrica o un defecto, contactanos y lo cambiamos o reparamos sin cargo. En este caso,
          los costos de envío también corren por nuestra cuenta.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">3. Cambios y devoluciones voluntarias</h2>
        <p>
          Fuera del plazo de arrepentimiento, o si querés cambiar un producto por otro motivo (color, modelo, etc.),
          podemos gestionarlo bajo estas condiciones:
        </p>
        <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
          <li>El producto debe estar <strong className="text-brand-text">sin uso, en su empaque original y en perfectas condiciones</strong>, con sus accesorios y etiquetas.</li>
          <li>El costo del envío de ida y vuelta para cambios voluntarios corre por cuenta del comprador.</li>
          <li>
            Si el producto vuelve con signos de uso o deterioro, evaluaremos su estado al recibirlo y te informaremos
            el monto a reintegrar o la posibilidad del cambio antes de avanzar.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">4. Reintegros</h2>
        <ul className="list-disc list-inside space-y-1.5 ml-2">
          <li>Los reembolsos se realizan por el <strong className="text-brand-text">mismo medio de pago</strong> utilizado en la compra.</li>
          <li>Una vez aprobada la devolución, procesamos el reintegro a la brevedad. El plazo de acreditación depende de Mercado Pago y de tu banco o tarjeta.</li>
        </ul>
      </section>

      <section>
        <p className="text-sm">
          ¿Dudas? Escribinos a{' '}
          <a href={`mailto:${EMAIL}`} className="text-brand-purple hover:underline">{EMAIL}</a>{' '}
          y te ayudamos con la gestión.
        </p>
      </section>
    </LegalPageShell>
  )
}
