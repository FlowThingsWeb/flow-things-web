import Link from 'next/link'
import Image from 'next/image'
import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import ProductCard from '@/components/ProductCard'
import EditableText from '@/components/EditableText'
import EditableImage from '@/components/EditableImage'
import EditBar from '@/components/EditBar'
import { Producto } from '@/types'
import { getConfig } from '@/lib/config'
import { CATEGORIAS_PAUSADAS } from '@/lib/categoriasPausadas'
import HomeCarousel from '@/components/HomeCarousel'
import TrustBar from '@/components/TrustBar'
import { armarCarrusel } from '@/lib/carruselHome'

/** Primera foto usable de un producto (la propia o la de alguna variante). */
function fotoDe(p: Producto): string | null {
  const varianteConImagen = p.variantes?.find(
    (v) => v.activo !== false && (v.imagen_url || v.imagenes?.[0]),
  )
  return (
    p.imagen_url ||
    p.imagenes?.[0] ||
    varianteConImagen?.imagen_url ||
    varianteConImagen?.imagenes?.[0] ||
    null
  )
}

// La página se sigue renderizando por request (usa searchParams para el modo
// editor), pero los datos del catálogo salen de caché en vez de pegarle a
// Supabase en cada visita. Se invalida sola cada 60s y, ni bien el CRM empuja
// stock o entra una venta, por tag ('catalogo'). El visitante ve lo mismo.
const CACHE = { revalidate: 60, tags: ['catalogo'] }

/**
 * Todo lo que se puede comprar hoy: activo, con stock y de una categoría no
 * pausada. De acá salen el carrusel, la foto y el contador de cada categoría
 * y el total del catálogo, con una sola consulta.
 */
const getProductosPublicables = unstable_cache(async (): Promise<Producto[]> => {
  const { data } = await supabaseAdmin
    .from('productos')
    .select(
      '*, categorias(id, nombre, slug), variantes(id, imagen_url, imagenes, activo)',
    )
    .eq('activo', true)
    .gt('stock', 0)
    .order('created_at', { ascending: false })
    .limit(300)

  return (data || []).filter(
    (p: any) => !CATEGORIAS_PAUSADAS.includes(p.categorias?.slug),
  )
}, ['home-publicables'], CACHE)

const getDestacados = unstable_cache(async (): Promise<Producto[]> => {
  const { data } = await supabaseAdmin
    .from('productos')
    .select(
      '*, categorias(id, nombre, slug), variantes(id, imagen_url, imagenes, activo)',
    )
    .eq('activo', true)
    .eq('destacado', true)
    .order('created_at', { ascending: false })
    .limit(20) // fetch more to account for filtering

  return (data || [])
    .filter((p: any) => !CATEGORIAS_PAUSADAS.includes(p.categorias?.slug))
    .slice(0, 8)
}, ['home-destacados'], CACHE)

const getCategorias = unstable_cache(async () => {
  const { data } = await supabaseAdmin.from('categorias').select('*')
  return (data || []).filter((c: any) => !CATEGORIAS_PAUSADAS.includes(c.slug))
}, ['home-categorias'], CACHE)

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>
}) {
  const params = await searchParams
  const editMode = params.editMode === '1'

  const [destacados, categorias, cfg, publicables] = await Promise.all([
    getDestacados(),
    getCategorias(),
    getConfig(),
    getProductosPublicables(),
  ])

  const slidesCarrusel = armarCarrusel(publicables)

  // Cada categoría se muestra con una foto real de su mercadería y cuántos
  // productos tiene disponibles. Una grilla de emojis no da ganas de entrar.
  const categoriasConFoto = categorias
    .map((cat) => {
      const suyos = publicables.filter((p) => p.categoria_id === cat.id)
      return {
        ...cat,
        cantidad: suyos.length,
        foto: suyos.map(fotoDe).find(Boolean) ?? null,
      }
    })
    .filter((cat) => cat.cantidad > 0)

  const totalCatalogo = publicables.length

  // Novedades: lo último que entró, sin repetir los destacados que ya se
  // muestran más arriba. Sale de `publicables`, así que no cuesta otra query.
  const idsDestacados = new Set(destacados.map((p) => p.id))
  const novedades = publicables
    .filter((p) => !idsDestacados.has(p.id))
    .slice(0, 8)

  const envioGratisDesde = Number(
    cfg.envio_km_activo === '1'
      ? cfg.envio_km_gratis_desde
      : cfg.envio_gratis_caba_desde,
  )

  const categoriasIconos: Record<string, string> = {
    libreria: '📚',
    jugueteria: '🧸',
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

      {/* Carrusel de productos — primero para que se vea mercadería y un
          botón de comprar sin tener que scrollear. */}
      <HomeCarousel slides={slidesCarrusel} />

      {/* Garantías: contesta envío, cuotas, seguridad y devoluciones antes de
          que el cliente tenga que ir a buscarlo. */}
      <TrustBar envioGratisDesde={envioGratisDesde} />

      {/* Hero — debajo del carrusel y compacto: sigue estando el mensaje de
          marca, pero ya no se come la pantalla de entrada. */}
      <section
        className="relative overflow-hidden bg-gradient-brand"
        style={editMode ? { paddingTop: '40px' } : undefined}
      >
        <div className="absolute top-20 right-20 w-96 h-96 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-64 h-64 bg-brand-neon/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Texto */}
            <div>
              <div className="inline-flex items-center gap-2 bg-brand-bg-soft border border-brand-border px-4 py-2 rounded-full mb-5 animate-fade-up">
                <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
                <span className="text-brand-text-muted text-sm font-medium">
                  <T k="hero_badge" />
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 animate-fade-up leading-tight">
                <T k="hero_titulo_1" />{' '}
                <span className="text-gradient-purple">
                  <T k="hero_titulo_2" />
                </span>
                <br />
                <T k="hero_titulo_3" />
              </h1>

              <p className="text-brand-text-muted text-base max-w-xl mb-7 animate-fade-up leading-relaxed">
                <T k="hero_subtitulo" multiline />
              </p>

              <div className="flex flex-col sm:flex-row gap-4 animate-fade-up">
                <Link
                  href="/productos"
                  className="bg-brand-purple hover:bg-brand-purple-light text-white font-semibold px-7 py-3.5 rounded-2xl transition-all hover:shadow-purple text-base text-center"
                >
                  <T k="hero_cta_primario" />
                </Link>
                <Link
                  href="/productos?categoria=jugueteria"
                  className="border border-brand-neon text-brand-neon hover:bg-brand-neon hover:text-black font-semibold px-7 py-3.5 rounded-2xl transition-all text-base text-center"
                >
                  <T k="hero_cta_secundario" />
                </Link>
              </div>
            </div>

            {/* Banner hero */}
            <div className="hidden lg:block">
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-white mb-8">
          <T k="seccion_categorias_titulo" />
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {categoriasConFoto.map((cat) => (
            <Link
              key={cat.id}
              href={`/productos?categoria=${cat.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-brand-border bg-brand-bg-card hover:border-brand-purple hover:shadow-card-hover transition-all hover:-translate-y-1 animate-fade-up opacity-0"
            >
              <div className="relative aspect-[16/10] bg-brand-bg-soft">
                {cat.foto ? (
                  <Image
                    src={cat.foto}
                    alt={cat.nombre}
                    fill
                    className="object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    sizes="(max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-5xl">
                      {categoriasIconos[cat.slug] || '📦'}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <span className="block font-bold text-white text-lg leading-tight">
                    {cat.nombre}
                  </span>
                  <span className="block text-brand-neon text-xs font-semibold mt-0.5">
                    {cat.cantidad}{' '}
                    {cat.cantidad === 1 ? 'producto' : 'productos'} · Ver todos →
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {/* Atajo a todo el catálogo, con la misma forma que las categorías */}
          <Link
            href="/productos"
            className="group relative overflow-hidden rounded-2xl border border-brand-purple/50 bg-gradient-card hover:border-brand-purple hover:shadow-card-hover transition-all hover:-translate-y-1 animate-fade-up opacity-0"
          >
            <div className="relative aspect-[16/10] flex flex-col items-center justify-center text-center p-4">
              <span className="text-3xl mb-2" aria-hidden="true">🛍️</span>
              <span className="font-bold text-white text-lg leading-tight">
                Ver todo el catálogo
              </span>
              <span className="text-brand-neon text-xs font-semibold mt-1">
                {totalCatalogo} productos disponibles →
              </span>
            </div>
          </Link>
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
              className="shrink-0 border border-brand-border hover:border-brand-neon text-white hover:text-brand-neon text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
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

      {/* Novedades — más mercadería a la vista sin obligar a ir al catálogo */}
      {novedades.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-brand-text">
                Recién llegados
              </h2>
              <p className="text-brand-text-muted text-sm mt-1">
                Lo último que sumamos al catálogo
              </p>
            </div>
            <Link
              href="/productos"
              className="shrink-0 border border-brand-border hover:border-brand-neon text-white hover:text-brand-neon text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              Ver más
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children">
            {novedades.map((producto) => (
              <div key={producto.id} className="animate-fade-up opacity-0">
                <ProductCard producto={producto} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cierre: el que llegó hasta acá vio poco catálogo. Se lo ofrecemos
          entero, con el número real de productos y atajos por categoría. */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="relative overflow-hidden rounded-3xl border border-brand-purple/40 bg-gradient-card p-8 sm:p-12 text-center">
          <div className="absolute -top-16 -right-10 w-64 h-64 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Todavía hay {totalCatalogo} productos para ver
            </h2>
            <p className="text-brand-text-muted mt-3 max-w-xl mx-auto">
              Librería y juguetería con envío a todo el país
              {envioGratisDesde > 0 ? ', y gratis en CABA por compras grandes' : ''}.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/productos"
                className="bg-brand-purple hover:bg-brand-purple-light text-white font-bold px-8 py-4 rounded-2xl transition-all hover:shadow-purple"
              >
                Ver todo el catálogo
              </Link>
              {categoriasConFoto.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/productos?categoria=${cat.slug}`}
                  className="border border-brand-border hover:border-brand-neon text-white hover:text-brand-neon font-semibold px-8 py-4 rounded-2xl transition-colors"
                >
                  {cat.nombre}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

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
            <div className="bg-brand-purple/20 border border-brand-purple rounded-xl px-4 py-2 text-sm font-semibold text-white">
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
