import Link from 'next/link'
import LegalPageShell from '@/components/LegalPageShell'

export const metadata = {
  title: 'Términos y Condiciones — Flow Things',
  description: 'Términos y condiciones de uso y compra en Flow Things.',
}

const EMAIL = 'contacto@flowthings.com.ar'

export default function TerminosPage() {
  return (
    <LegalPageShell title="Términos y Condiciones" fecha="10 de julio de 2026">
      <section>
        <p>
          Estos Términos y Condiciones regulan el uso del sitio <strong className="text-brand-text">flowthings.com.ar</strong> y
          la compra de productos a través de él. Al navegar y/o comprar en el sitio, aceptás estos términos en su totalidad.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">1. Titular</h2>
        <p>
          El sitio es operado por <strong className="text-brand-text">Lucas Barman</strong>,
          CUIT <strong className="text-brand-text">20-46212670-1</strong>, con domicilio en{' '}
          <strong className="text-brand-text">Avenida Ángel Gallardo 160</strong>, Ciudad Autónoma de Buenos Aires,
          Argentina. Contacto: <a href={`mailto:${EMAIL}`} className="text-brand-purple hover:underline">{EMAIL}</a>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">2. Productos y precios</h2>
        <ul className="list-disc list-inside space-y-1.5 ml-2">
          <li>Los precios están expresados en <strong className="text-brand-text">pesos argentinos (ARS)</strong> e incluyen IVA.</li>
          <li>Los precios y la disponibilidad pueden modificarse sin previo aviso; el precio válido es el vigente al momento de confirmar la compra.</li>
          <li>Las imágenes de los productos son ilustrativas.</li>
          <li>Las ventas están sujetas a disponibilidad de stock. Si un producto no estuviera disponible luego de la compra, te contactaremos para resolverlo o reintegrarte el importe.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">3. Medios de pago</h2>
        <p>
          Los pagos se procesan a través de <strong className="text-brand-text">Mercado Pago</strong>. Flow Things no
          almacena los datos de tu tarjeta; el procesamiento del pago lo realiza Mercado Pago bajo sus propias condiciones
          y estándares de seguridad.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">4. Envíos</h2>
        <p>
          Realizamos envíos a todo el país. Los costos y plazos de entrega se calculan e informan en el checkout antes de
          confirmar la compra, según la zona de destino. Los plazos son estimados y pueden variar por causas ajenas a
          Flow Things (correo, clima, etc.).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">5. Facturación</h2>
        <p>
          Por cada compra se emite la correspondiente factura electrónica conforme a la normativa de AFIP, que se envía al
          email informado en la compra.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">6. Arrepentimiento, cambios y devoluciones</h2>
        <p>
          Podés arrepentirte de tu compra dentro de los 10 días corridos de recibido el producto. Conocé el detalle en{' '}
          <Link href="/boton-de-arrepentimiento" className="text-brand-purple hover:underline">Botón de Arrepentimiento</Link>{' '}
          y en nuestra{' '}
          <Link href="/cambios-y-devoluciones" className="text-brand-purple hover:underline">política de Cambios y Devoluciones</Link>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">7. Cuenta de usuario</h2>
        <p>
          Sos responsable de la veracidad de los datos que cargás y de mantener la confidencialidad de tu cuenta. Los
          datos de envío y contacto que ingreses deben ser correctos para poder procesar tu pedido.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">8. Propiedad intelectual</h2>
        <p>
          Todo el contenido del sitio (marca, logos, textos, imágenes y diseño) es propiedad de Flow Things o de sus
          titulares y no puede reproducirse sin autorización.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">9. Privacidad</h2>
        <p>
          El tratamiento de tus datos personales se rige por nuestra{' '}
          <Link href="/politica-de-privacidad" className="text-brand-purple hover:underline">Política de Privacidad</Link>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">10. Ley aplicable y defensa del consumidor</h2>
        <p>
          Estos términos se rigen por las leyes de la República Argentina, en particular la Ley 24.240 de Defensa del
          Consumidor. Ante cualquier conflicto podés iniciar tu reclamo en la{' '}
          <a href="https://autogestion.produccion.gob.ar/consumidores" target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline">
            Ventanilla Única Federal de Defensa del Consumidor
          </a>.
        </p>
      </section>

      <section>
        <p className="text-sm">Contacto: <a href={`mailto:${EMAIL}`} className="text-brand-purple hover:underline">{EMAIL}</a></p>
      </section>
    </LegalPageShell>
  )
}
