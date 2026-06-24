import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="relative inline-block mb-8">
          <span className="text-8xl font-black text-brand-purple/20 select-none">404</span>
          <span className="absolute inset-0 flex items-center justify-center text-5xl">🔍</span>
        </div>

        <h1 className="text-3xl font-bold text-brand-text mb-3">
          Página no encontrada
        </h1>

        <p className="text-brand-text-muted mb-8 leading-relaxed">
          La página que buscás no existe o fue movida.
          Probablemente el producto fue desactivado o la URL está mal escrita.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/productos"
            className="bg-brand-purple hover:bg-brand-purple-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Ver catálogo
          </Link>
          <Link
            href="/"
            className="border border-brand-border text-brand-text hover:bg-brand-bg-soft font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
