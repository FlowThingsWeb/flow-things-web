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
import { blurDe, getMapaBlur, imagenDeProducto } from '@/lib/blur'
import BannerLineas from '@/components/BannerLineas'
import LineasDestacadas from '@/components/LineasDestacadas'
import { getPiezasBanner } from '@/lib/bannerLineas'
import { ShoppingBag } from '@phosphor-icons/react/dist/ssr'
import TrustBar from '@/components/TrustBar'
import RielProductos from '@/components/RielProductos'
import FaqCategoria, { faqDeTienda } from '@/components/FaqCategoria'
import { cyberActivo } from '@/lib/cyber'

/**
 * Medios de pago que se muestran al pie de la home.
 *
 * Los SVG son de Simple Icons (CC0) y viven en /public/pagos: los tres vienen
 * en un lienzo cuadrado de 24x24, por eso van todos al mismo tamaño. El
 * width/height está escrito para que el navegador reserve el lugar y la fila
 * no salte cuando cargan.
 */
const MEDIOS_DE_PAGO = [
  { nombre: 'Mercado Pago', logo: '/pagos/mercadopago.svg' },
  { nombre: 'Visa', logo: '/pagos/visa.svg' },
  { nombre: 'Mastercard', logo: '/pagos/mastercard.svg' },
]

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

  const [destacados, categorias, cfg, publicables, mapaBlur, piezasBanner] =
    await Promise.all([
      getDestacados(),
      getCategorias(),
      getConfig(),
      getProductosPublicables(),
      getMapaBlur(),
      getPiezasBanner(),
    ])

  const faqHome = faqDeTienda(cfg)

  // Cada categoría se muestra con una foto real de su mercadería y cuántos
  // productos tiene disponibles. Una grilla de emojis no da ganas de entrar.
  const categoriasConFoto = categorias
    .map((cat) => {
      const suyos = publicables.filter((p) => p.categoria_id === cat.id)
      return {
        ...cat,
        cantidad: suyos.length,
        // Tres fotos, no una: la ficha muestra un trío de productos reales.
        fotos: suyos.map(fotoDe).filter((f): f is string => !!f).slice(0, 3),
      }
    })
    .filter((cat) => cat.cantidad > 0 && cat.fotos.length > 0)

  const totalCatalogo = publicables.length

  // Novedades: lo último que entró, sin repetir los destacados que ya se
  // muestran más arriba. Sale de `publicables`, así que no cuesta otra query.
  const idsDestacados = new Set(destacados.map((p) => p.id))
  // Doce y no ocho: en un riel las fichas de más no alargan la página, sólo
  // le dan de qué seguir tirando a quien está paseando.
  const novedades = publicables
    .filter((p) => !idsDestacados.has(p.id))
    .slice(0, 12)

  const envioGratisDesde = Number(
    cfg.envio_km_activo === '1'
      ? cfg.envio_km_gratis_desde
      : cfg.envio_gratis_caba_desde,
  )

  /**
   * Lo rebajado, para el riel de la promo.
   *
   * El criterio es el mismo en toda la tienda —hay precio anterior y es más
   * alto— así que un producto no puede aparecer en el riel del Cyber y sin
   * tachado en la grilla. Se corta en doce: es un riel, no el catálogo; el
   * resto está en /cyber.
   */
  const cyberOn = cyberActivo(cfg)
  const ofertas = cyberOn
    ? publicables
        .filter((p) => p.precio_anterior != null && p.precio_anterior > p.precio)
        .slice(0, 12)
    : []

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

      {/* El banner de líneas abre la home: dice qué vendemos antes que cuánto
          sale. El 58% del tráfico entra desde Instagram y no sabe qué hay
          acá adentro; una ficha de producto con precio no se lo explica. */}
      <BannerLineas piezas={piezasBanner} />

      {/* Pegado al banner, sin aire: son su continuación, no otra sección. */}
      <LineasDestacadas />

      {/*
        La promo, arriba de todo lo demás y debajo del banner.

        Arriba del banner no: el 58% del tráfico entra desde Instagram sin
        saber qué se vende acá, y un cartel de descuentos antes de haber
        mostrado un solo producto es ruido. Primero qué hay, después a cuánto.
      */}
      {cyberOn && ofertas.length > 0 && (
        <RielProductos
          titulo={cfg.cyber_titulo || 'Ofertas Cyber'}
          bajada={
            cfg.cyber_bajada ||
            `${ofertas.length} productos rebajados, con envío gratis desde $${envioGratisDesde.toLocaleString('es-AR')}`
          }
          productos={ofertas}
          verMasHref="/cyber"
          mapaBlur={mapaBlur}
        />
      )}

      {/* Garantías: contesta envío, cuotas, seguridad y devoluciones antes de
          que el cliente tenga que ir a buscarlo. */}
      <TrustBar envioGratisDesde={envioGratisDesde} />

      {/* Banda de marca, no un segundo hero.
          
          Acá había un hero entero: insignia, dos titulares, bajada y dos
          botones, debajo de un banner que ya había hecho ese trabajo. El
          visitante llegaba a esta altura y le volvían a ofrecer "ver todos los
          productos", algo que la grilla de categorías le ofrece diez
          centímetros más abajo y el cierre de la página una tercera vez.

          Queda la banda: el h1 —que es lo que lee Google y lo único que no
          estaba en ningún otro lado— la bajada y la marca. Sin botones
          repetidos y con la mitad de alto. */}
      <section
        className="relative overflow-hidden bg-gradient-brand"
        style={editMode ? { paddingTop: '40px' } : undefined}
      >
        <div className="absolute -top-10 right-10 h-72 w-72 rounded-full bg-brand-purple/20 blur-3xl pointer-events-none" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-start gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-12">
          <div className="min-w-0">
            {/* El h1 abre con lo que se busca en Google —"juguetería",
                "librería", "online"—, que el título y la descripción ya decían
                y él no. La frase de marca no se fue: quedó dentro del mismo
                h1, un escalón más abajo.

                Un solo degradado por titular: tenía dos palabras en degradado
                en el mismo h1, y dos acentos compitiendo no acentúan nada. */}
            <h1>
              <span className="block text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                <T k="hero_h1_1" />{' '}
                <span className="text-gradient-purple">
                  <T k="hero_h1_2" />
                </span>
              </span>
              <span className="mt-2 block text-base font-semibold leading-snug text-brand-text-muted sm:text-lg">
                <T k="hero_titulo_1" /> <T k="hero_titulo_2" />{' '}
                <T k="hero_titulo_3" />
              </span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-text-muted">
              <T k="hero_subtitulo" multiline />
            </p>
          </div>

          {/* La marca, del tamaño de una marca y no de una portada. */}
          <div className="hidden shrink-0 lg:block">
            {editMode ? (
              <EditableImage
                configKey="hero_banner_url"
                src={cfg.hero_banner_url || '/banner.png'}
                alt="Flow Things banner"
                width={800}
                height={600}
                className="h-auto w-[300px] rounded-2xl"
              />
            ) : (
              <img
                src={cfg.hero_banner_url || '/banner.png'}
                alt="Flow Things"
                width={300}
                height={225}
                className="h-auto w-[300px] rounded-2xl"
              />
            )}
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-white mb-8">
          <T k="seccion_categorias_titulo" />
        </h2>
        {/* Tantas columnas como categorías, hasta tres. Con el atajo a
            "todos los productos" adentro eran siempre tres fichas y la grilla
            cerraba sola; ahora son las categorías reales, y pedir tres
            columnas con dos categorías deja un hueco al final de la fila. */}
        <div
          className={`grid gap-4 stagger-children ${
            categoriasConFoto.length === 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {categoriasConFoto.map((cat) => (
            <Link
              key={cat.id}
              href={`/categoria/${cat.slug}`}
              className="group overflow-hidden rounded-2xl border border-brand-border bg-brand-bg-card transition-all hover:-translate-y-1 hover:border-brand-purple hover:shadow-card-hover animate-fade-up opacity-0"
            >
              {/*
                Antes acá iba UNA foto de producto a `object-cover`, recortada
                a 16:10 y tapada por un degradado negro al 85% para que se
                leyera el texto encima. Resultado: un peluche cortado al medio
                y casi a oscuras representando "Juguetería".

                Ahora van tres productos de la categoría enteros, sin recortar,
                sobre el fondo suave de la marca, y el texto abajo. Se ve qué
                hay adentro y no hace falta oscurecer nada.
              */}
              <div className="grid grid-cols-2 gap-1 bg-brand-bg-soft p-2 sm:grid-cols-3">
                {cat.fotos.map((foto: string, i: number) => (
                  <div
                    key={foto}
                    /* En el teléfono la ficha mide 165px: tres columnas
                       dejaban cuadrados de 50px, demasiado chicos para ver
                       qué es cada cosa. Van dos, y la tercera aparece recién
                       cuando hay ancho. */
                    className={`relative aspect-square overflow-hidden rounded-lg bg-white/5 ${
                      i === 2 ? 'hidden sm:block' : ''
                    }`}
                  >
                    <Image
                      src={foto}
                      alt=""
                      fill
                      className="object-contain p-1.5 transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 1024px) 25vw, 120px"
                      placeholder={blurDe(mapaBlur, foto) ? 'blur' : 'empty'}
                      blurDataURL={blurDe(mapaBlur, foto)}
                    />
                  </div>
                ))}
              </div>
              <div className="px-4 py-3">
                <span className="block text-lg font-bold leading-tight text-white">
                  {cat.nombre}
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-brand-neon">
                  {cat.cantidad}{' '}
                  {cat.cantidad === 1 ? 'producto' : 'productos'} →
                </span>
              </div>
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
              className="shrink-0 border border-brand-border hover:border-brand-neon text-white hover:text-brand-neon text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <T k="seccion_ver_todos" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children">
            {destacados.map((producto) => (
              <div key={producto.id} className="animate-fade-up opacity-0">
                <ProductCard
                  producto={producto}
                  blurDataURL={blurDe(mapaBlur, imagenDeProducto(producto))}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Novedades — más mercadería a la vista sin obligar a ir al catálogo.
          Va como riel y no como grilla: ver RielProductos. */}
      <RielProductos
        titulo="Recién llegados"
        bajada="Lo último que sumamos al catálogo"
        productos={novedades}
        verMasHref="/productos"
        mapaBlur={mapaBlur}
      />

      {/* Cierre: el único lugar de la home donde se ofrece el catálogo entero.

          Antes esta sección repetía la grilla de categorías palabra por
          palabra: el mismo "Ver todos los productos", las mismas dos
          categorías, los mismos contadores, a dos pantallas de distancia. La
          home ofrecía tres veces lo mismo y ninguna de las tres se leía como
          la importante.

          Ahora cada destino aparece una sola vez. Las categorías están
          arriba, con foto y cantidad. Acá queda el catálogo completo, que es
          lo que no estaba en ningún otro lado, con un botón solo. */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-brand-purple/40 bg-gradient-card p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-brand-purple/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Todavía hay {totalCatalogo} productos para ver
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-text-muted">
              Librería y juguetería con envío a todo el país
              {envioGratisDesde > 0 ? ', y gratis en CABA por compras grandes' : ''}.
            </p>
            <Link
              href="/productos"
              className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-8 py-4 font-bold text-white transition-all hover:bg-brand-purple-light hover:shadow-purple"
            >
              <ShoppingBag size={20} weight="regular" aria-hidden="true" />
              Ver todos los productos
            </Link>
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
          {/* Logos de verdad, no cajitas con el nombre escrito. Un wordmark
              tipeado a mano dice "no conseguí el logo"; el logo dice que el
              medio de pago existe. Están servidos desde /public y no desde un
              CDN ajeno: es la sección que habla de seguridad del pago, no es
              lugar para pedirle un archivo a un tercero. */}
          <ul className="flex shrink-0 items-center gap-5">
            {MEDIOS_DE_PAGO.map((medio) => (
              <li key={medio.nombre}>
                <img
                  src={medio.logo}
                  alt={medio.nombre}
                  width={34}
                  height={34}
                  loading="lazy"
                  className="h-[34px] w-[34px] opacity-80"
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Preguntas frecuentes de la tienda. Las categorías ya tienen las suyas;
          faltaban en la home, que es la página por la que entra un asistente
          cuando le preguntan "dónde compro juguetes con envío". */}
      <FaqCategoria faq={faqHome} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqHome.map((f) => ({
              '@type': 'Question',
              name: f.pregunta,
              acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
            })),
          }),
        }}
      />
    </>
  )
}
