import Link from 'next/link'

/** Layout compartido para páginas legales (términos, devoluciones, arrepentimiento). */
export default function LegalPageShell({
  title,
  fecha,
  children,
}: {
  title: string
  fecha?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-brand-bg">
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

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-brand-text mb-2">{title}</h1>
        {fecha && <p className="text-brand-text-muted text-sm mb-10">Última actualización: {fecha}</p>}

        <div className="prose prose-invert max-w-none space-y-8 text-brand-text-muted leading-relaxed">
          {children}
        </div>
      </main>
    </div>
  )
}
