import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidad — Flow Things',
  description: 'Conocé cómo Flow Things recopila, usa y protege tu información personal.',
}

export default function PoliticaPrivacidadPage() {
  const fecha = '29 de junio de 2025'

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header simple */}
      <header className="border-b border-brand-border">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">
            Flow <span className="text-brand-purple">Things</span>
          </Link>
          <Link href="/" className="text-sm text-brand-text-muted hover:text-brand-text transition-colors">
            ← Volver al sitio
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-brand-text mb-2">Política de Privacidad</h1>
        <p className="text-brand-text-muted text-sm mb-10">Última actualización: {fecha}</p>

        <div className="prose prose-invert max-w-none space-y-8 text-brand-text-muted leading-relaxed">

          <section>
            <p>
              En <strong className="text-brand-text">Flow Things</strong> ("nosotros", "nuestro", "la tienda") nos comprometemos a proteger
              tu privacidad. Esta política describe cómo recopilamos, usamos, almacenamos y protegemos tu información personal cuando
              usás nuestro sitio web <strong className="text-brand-text">flowthings.com.ar</strong>.
            </p>
          </section>

          {/* 1 */}
          <section>
            <h2 className="text-xl font-bold text-brand-text mb-3">1. Datos que recopilamos</h2>
            <p className="mb-3">Cuando creás una cuenta o iniciás sesión con Google, accedemos a los siguientes datos de tu cuenta Google:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong className="text-brand-text">Nombre</strong> — para personalizar tu experiencia en la tienda.</li>
              <li><strong className="text-brand-text">Dirección de email</strong> — como identificador único de tu cuenta.</li>
              <li><strong className="text-brand-text">Foto de perfil</strong> — para mostrar en el menú de usuario.</li>
            </ul>
            <p className="mt-3">
              No accedemos a tus contactos, calendario, correos, documentos ni ningún otro dato de Google más allá de los mencionados.
            </p>
            <p className="mt-3">Adicionalmente, al completar tu perfil o realizar compras podés proporcionarnos:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
              <li>Número de DNI (requerido por ARCA/AFIP para facturación)</li>
              <li>Número de teléfono</li>
              <li>Fecha de nacimiento (opcional)</li>
              <li>Direcciones de entrega</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-bold text-brand-text mb-3">2. Cómo usamos tus datos</h2>
            <p className="mb-3">Los datos que obtenemos de Google y los que vos proporcionás se usan exclusivamente para:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Crear y gestionar tu cuenta en Flow Things.</li>
              <li>Identificarte de forma segura al iniciar sesión.</li>
              <li>Pre-completar formularios de compra para facilitar el proceso.</li>
              <li>Enviarte confirmaciones de pedido y novedades de tu cuenta (solo al email registrado).</li>
              <li>Calcular descuentos y beneficios asociados a tu cuenta.</li>
              <li>Cumplir obligaciones legales de facturación (ARCA/AFIP).</li>
            </ul>
            <p className="mt-3">
              No usamos tus datos de Google para entrenar modelos de inteligencia artificial ni para publicidad dirigida.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-bold text-brand-text mb-3">3. Compartición de datos con terceros</h2>
            <p className="mb-3">
              No vendemos ni cedemos tus datos personales a terceros. Solo los compartimos con los siguientes proveedores de servicio,
              estrictamente necesarios para operar la tienda:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>
                <strong className="text-brand-text">Supabase</strong> — plataforma de base de datos donde se almacena tu información de cuenta
                de forma segura y cifrada.
              </li>
              <li>
                <strong className="text-brand-text">MercadoPago</strong> — procesador de pagos. Solo recibe los datos mínimos necesarios
                para procesar tu transacción (nombre, email, DNI, monto). No recibe tu contraseña ni datos de Google.
              </li>
              <li>
                <strong className="text-brand-text">Vercel</strong> — plataforma de hosting del sitio web. No procesa datos personales más
                allá de los logs técnicos estándar.
              </li>
            </ul>
            <p className="mt-3">
              Todos estos proveedores cuentan con sus propias políticas de privacidad y no están autorizados a usar tus datos para
              ningún otro fin que no sea el indicado.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-bold text-brand-text mb-3">4. Almacenamiento y protección</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Tus datos se almacenan en servidores de <strong className="text-brand-text">Supabase</strong> con cifrado en reposo y en tránsito (TLS/SSL).</li>
              <li>La autenticación con Google se gestiona a través de <strong className="text-brand-text">Supabase Auth</strong>, que implementa OAuth 2.0 estándar. Nunca almacenamos tu contraseña de Google.</li>
              <li>El acceso a los datos de usuario está restringido mediante Row Level Security (RLS) de Supabase: cada usuario solo puede acceder a sus propios datos.</li>
              <li>Las comunicaciones entre el navegador y nuestros servidores están protegidas por HTTPS.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-bold text-brand-text mb-3">5. Retención y eliminación de datos</h2>
            <p className="mb-3">
              Conservamos tus datos mientras tu cuenta esté activa. Si deseás eliminar tu cuenta y todos tus datos asociados,
              podés hacerlo de las siguientes formas:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Enviando un email a <strong className="text-brand-text">contacto@flowthings.com.ar</strong> con el asunto "Eliminar mi cuenta".</li>
              <li>Escribiéndonos por los canales de contacto disponibles en el sitio.</li>
            </ul>
            <p className="mt-3">
              Procesamos las solicitudes de eliminación dentro de los 30 días hábiles. Podemos conservar ciertos datos
              durante el período que exija la legislación argentina aplicable (por ejemplo, datos de facturación por 5 años según
              normativa de ARCA/AFIP).
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-bold text-brand-text mb-3">6. Tus derechos</h2>
            <p className="mb-2">De acuerdo con la Ley 25.326 de Protección de Datos Personales de Argentina, tenés derecho a:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Acceder a los datos personales que tenemos sobre vos.</li>
              <li>Rectificar datos incorrectos o incompletos.</li>
              <li>Solicitar la eliminación de tus datos ("derecho al olvido").</li>
              <li>Revocar el consentimiento para el uso de tus datos en cualquier momento.</li>
            </ul>
            <p className="mt-3">
              Para ejercer cualquiera de estos derechos, contactanos a <strong className="text-brand-text">contacto@flowthings.com.ar</strong>.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-bold text-brand-text mb-3">7. Cookies</h2>
            <p>
              Usamos cookies de sesión estrictamente necesarias para mantener tu sesión iniciada. No usamos cookies de
              seguimiento ni de publicidad de terceros.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-bold text-brand-text mb-3">8. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta política periódicamente. En caso de cambios significativos, te notificaremos por email
              o mediante un aviso en el sitio. La fecha de "última actualización" al inicio de esta página refleja la versión vigente.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-bold text-brand-text mb-3">9. Contacto</h2>
            <p>
              Si tenés preguntas sobre esta política de privacidad o el manejo de tus datos, contactanos en:{' '}
              <a href="mailto:contacto@flowthings.com.ar" className="text-brand-purple hover:underline">
                contacto@flowthings.com.ar
              </a>
            </p>
          </section>

        </div>
      </main>

      {/* Footer mínimo */}
      <footer className="border-t border-brand-border mt-12">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center">
          <p className="text-brand-text-muted text-xs">© 2025 Flow Things · Argentina</p>
        </div>
      </footer>
    </div>
  )
}
