import LegalPageShell from '@/components/LegalPageShell'

export const metadata = {
  title: 'Botón de Arrepentimiento — Flow Things',
  description: 'Ejercé tu derecho de arrepentimiento (Ley 24.240, art. 34). Cancelá tu compra dentro de los 10 días.',
}

const EMAIL = 'contacto@flowthings.com.ar'
const WHATSAPP = '5491156075633'

export default function BotonArrepentimientoPage() {
  const asunto = encodeURIComponent('Botón de arrepentimiento — Cancelar compra')
  const cuerpo = encodeURIComponent(
    'Hola, quiero ejercer mi derecho de arrepentimiento y cancelar mi compra.\n\n' +
    'N° de orden: \nNombre y apellido: \nEmail de la compra: \nMotivo (opcional): \n'
  )
  const waTexto = encodeURIComponent('Hola! Quiero ejercer el botón de arrepentimiento y cancelar mi compra. Mi N° de orden es: ')

  return (
    <LegalPageShell title="Botón de Arrepentimiento">
      <section>
        <div className="bg-brand-bg-card border border-brand-purple/40 rounded-2xl p-6">
          <p className="text-brand-text font-medium m-0">
            Tenés derecho a arrepentirte de tu compra y a que te devolvamos el 100% del dinero,
            <strong className="text-brand-text"> dentro de los 10 días corridos</strong> desde que recibís el producto,
            sin necesidad de dar explicaciones y sin ningún costo para vos.
          </p>
        </div>
        <p className="text-xs mt-3">
          Este derecho está garantizado por el art. 34 de la Ley 24.240 de Defensa del Consumidor y la
          Resolución 424/2020 de la Secretaría de Comercio Interior.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">¿Cómo lo ejercés?</h2>
        <p className="mb-3">Escribinos por cualquiera de estos medios indicando tu <strong className="text-brand-text">número de orden</strong>:</p>
        <div className="flex flex-col sm:flex-row gap-3 not-prose">
          <a
            href={`mailto:${EMAIL}?subject=${asunto}&body=${cuerpo}`}
            className="flex-1 text-center bg-brand-purple hover:bg-brand-purple-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            ✉️ Enviar email
          </a>
          <a
            href={`https://wa.me/${WHATSAPP}?text=${waTexto}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center border border-brand-border text-brand-text hover:bg-brand-bg-soft font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            💬 WhatsApp
          </a>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">¿Qué pasa después?</h2>
        <ul className="list-disc list-inside space-y-1.5 ml-2">
          <li>Si el pedido <strong className="text-brand-text">todavía no fue despachado</strong>, lo cancelamos y te reintegramos el 100%.</li>
          <li>Si ya lo recibiste, coordinamos la <strong className="text-brand-text">devolución del producto sin costo para vos</strong>: el costo del envío de devolución lo asumimos nosotros.</li>
          <li>Una vez recibido el producto (o confirmada la cancelación), te devolvemos el <strong className="text-brand-text">100% del importe abonado</strong>, por el mismo medio de pago que usaste.</li>
          <li>Podés abrir y revisar el producto para verificarlo, tal como lo harías en un local. Solo se podría descontar el monto correspondiente a una <strong className="text-brand-text">disminución de valor por un uso indebido</strong> (daño o deterioro más allá de la simple prueba).</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-text mb-3">Excepciones</h2>
        <p>De acuerdo con la ley, el derecho de arrepentimiento no aplica a:</p>
        <ul className="list-disc list-inside space-y-1.5 ml-2">
          <li>Productos confeccionados o personalizados especialmente a tu pedido.</li>
          <li>Productos que, por su naturaleza, no puedan ser devueltos o puedan deteriorarse con rapidez.</li>
        </ul>
      </section>

      <section>
        <p className="text-sm">
          Ante cualquier consulta escribinos a{' '}
          <a href={`mailto:${EMAIL}`} className="text-brand-purple hover:underline">{EMAIL}</a>.
          También podés hacer tu reclamo ante la autoridad de aplicación en{' '}
          <a href="https://autogestion.produccion.gob.ar/consumidores" target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline">
            Ventanilla Única Federal de Defensa del Consumidor
          </a>.
        </p>
      </section>
    </LegalPageShell>
  )
}
