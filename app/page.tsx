import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import ProductCard from '@/components/ProductCard'
import EditableText from '@/components/EditableText'
import EditableImage from '@/components/EditableImage'
import EditBar from '@/components/EditBar'
import { Producto } from '@/types'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

async function getDestacados(): Promise<Producto[]> {
  const { data } = await supabaseAdmin
    .from('productos')
    .select('*, categorias(id, nombre, slug)')
    .eq('activo', true)
    .eq('destacado', true)
    .order('created_at', { ascending: false })
    .limit(8)

  return data || []
}

async function getCategorias() {
  const { data } = await supabaseAdmin.from('categorias').select('*')
  return data || []
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>
}) {
  const params = await searchParams
  const editMode = params.editMode === '1'

  const [destacados, categorias, cfg] = await Promise.all([
    getDestacados(),
    getCategorias(),
    getConfig(),
  ])

  const categoriasIconos: Record<string, string> = {
    libreria: '📚',
    jugueteria: '🧸',
    'utiles-escolares': '✏️',
    'juegos-de-mesa': '🎲',
  }

  const T = ({ k, className, as, multiline }: {
    k: string
    className?: string
    as?: string
    multiline?: boolean
  }) =>
    editMode ? (
      <EditableText
        configKey={k}
        value={cfg[k]}
        className={className}
        as={as}
        multiline={multiline}
      />
    ) : (
      <>{cfg[k]}</>
    )

  return (
    <>
      {/* Barra de edición — solo en modo editor */}
      {editMode && <EditBar />}

      {/* Hero */}
      <section
        className="relative overflow-hidden bg-gradient-brand min-h-[80vh] flex items-center"
        style={editMode ? { paddingTop: '40px' } : undefined}
      >
        <div className="absolute top-20 right-20 w-96 h-96 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-64 h-64 bg-brand-neon/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Texto */}
            <div>
              <div className="inline-flex items-center gap-2 bg-brand-bg-soft border border-brand-border px-4 py-2 rounded-full mb-8 animate-fade-up">
                <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
                <span className="text-brand-text-muted text-sm font-medium">
                  <T k="hero_badge" />
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 animate-fade-up leading-tight">
                <T k="hero_titulo_1" />{' '}
                <span className="text-gradient-purple">
                  <T k="hero_titulo_2" />
                </span>
                <br />
                <T k="hero_titulo_3" />
              </h1>

              <p className="text-brand-text-muted text-lg max-w-xl mb-10 animate-fade-up leading-relaxed">
                <T k="hero_subtitulo" multiline />
              </p>

              <div className="flex flex-col sm:flex-row gap-4 animate-fade-up">
                <Link
                  href="/productos"
                  className="bg-brand-purple hover:bg-brand-purple-light text-white font-semibold px-8 py-4 rounded-2xl transition-all hover:shadow-purple text-base text-center"
                >
                  <T k="hero_cta_primario" />
                </Link>
                <Link
                  href="/productos?categoria=jugueteria"
                  className="border border-brand-neon text-brand-neon hover:bg-brand-neon hover:text-black font-semibold px-8 py-4 rounded-2xl transition-all text-base text-center"
                >
                  <T k="hero_cta_secundario" />
                </Link>
              </div>
            </div>

            {/* Banner hero */}
            <div className="hidden lg:block animate-float">
              <div className="relative rounded-3xl overflow-hidden border border-brand-border shadow-purple">
                {editMode ? (
                  <EditableImage
                    configKey="hero_banner_url"
                    src={cfg.hero_banner_url || '/banner.png'}
                    alt="Flow Things banner"
                    width={800}
                    height={600}
                    className="w-full h-auto"
                  />
                ) : (
                  <img
                    src={cfg.hero_banner_url || '/banner.png'}
                    alt="Flow Things"
                    className="w-full h-auto"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-white mb-8">
          <T k="seccion_categorias_titulo" />
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
          {categorias.map((cat) => (
            <Link
              key={cat.id}
              href={`/productos?categoria=${cat.slug}`}
              className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 text-center hover:border-brand-purple hover:shadow-card-hover transition-all hover:-translate-y-1 animate-fade-up opacity-0"
            >
              <span className="text-4xl block mb-3">
                {categoriasIconos[cat.slug] || '📦'}
              </span>
              <span className="font-medium text-white text-sm">{cat.nombre}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Productos destacados */}
      {destacados.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-brand-text">
              <T k="seccion_destacados_titulo" />
            </h2>
            <Link
              href="/productos"
              className="text-brand-purple hover:text-brand-purple-dark text-sm font-medium transition-colors"
            >
              <T k="seccion_ver_todos" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children">
            {destacados.map((producto) => (
              <div key={producto.id} className="animate-fade-up opacity-0">
                <ProductCard producto={producto} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Banner Mercado Pago */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-brand-bg-card border border-brand-border rounded-3xl p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-white mb-2">
              <T k="mp_titulo" />
            </h3>
            <p className="text-brand-text-muted">
              <T k="mp_texto" multiline />
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-brand-purple/20 border border-brand-purple rounded-xl px-4 py-2 text-sm font-semibold text-brand-purple">
              Mercado Pago
            </div>
            <div className="bg-brand-bg-soft border border-brand-border rounded-xl px-4 py-2 text-sm text-brand-text-muted">
              Visa / Mastercard
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
