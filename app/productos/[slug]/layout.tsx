import type { Metadata } from 'next'
import { nombresAlternativos, tituloSeo } from '@/lib/sinonimos'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { marcaDe } from '@/lib/marcas'
import { getConfig } from '@/lib/config'

const BASE = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

async function getProducto(slug: string) {
  const { data } = await supabaseAdmin
    .from('productos')
    .select('nombre, descripcion, precio, imagen_url, imagenes, stock, slug, sku, categorias(nombre), variantes(imagen_url, imagenes, activo)')
    .eq('slug', slug)
    .eq('activo', true)
    .maybeSingle()
  return data as {
    nombre: string
    descripcion: string | null
    precio: number
    imagen_url: string | null
    imagenes: string[] | null
    stock: number
    slug: string
    sku: string | null
    categorias: { nombre: string } | null
    variantes: { imagen_url: string | null; imagenes: string[] | null; activo: boolean }[] | null
  } | null
}

/**
 * Imagen para el preview al compartir (Open Graph). Los productos que cargan
 * las fotos en las variantes no tienen imagen propia, así que caemos a la
 * primera variante activa con imagen — si no, se veía el logo de Flow Things.
 */
function imagenDe(p: {
  imagen_url: string | null
  imagenes: string[] | null
  variantes?: { imagen_url: string | null; imagenes: string[] | null; activo: boolean }[] | null
}): string | null {
  if (p.imagen_url) return p.imagen_url
  if (p.imagenes?.[0]) return p.imagenes[0]
  const v = (p.variantes || []).find(
    (v) => v.activo !== false && (v.imagen_url || v.imagenes?.[0]),
  )
  return v?.imagen_url || v?.imagenes?.[0] || null
}

/**
 * Recorta la descripción para el snippet de Google, que muestra ~160
 * caracteres. Cortando por número seco quedaban frases partidas al medio de
 * una palabra ("...sin pegamento ni he"), que es lo primero que lee alguien
 * decidiendo si entra. Corta en el último espacio y cierra con puntos
 * suspensivos; si el texto ya entra, lo deja intacto.
 */
function recortar(texto: string, max = 160): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  if (limpio.length <= max) return limpio
  const corte = limpio.slice(0, max - 1)
  const ultimoEspacio = corte.lastIndexOf(' ')
  return `${corte.slice(0, ultimoEspacio > 0 ? ultimoEspacio : corte.length).replace(/[,;:.\s]+$/, '')}…`
}

/** Vigencia del precio para el dato estructurado: 30 días, en YYYY-MM-DD. */
function validoHasta(dias = 30): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

/**
 * Costos de envío declarados por zona, para el dato estructurado.
 *
 * Sale de la misma configuración que cobra el checkout. CABA va como rango
 * porque el envío por cercanía depende de los kilómetros: declarar un número
 * fijo sería prometer un precio que la caja no respeta.
 */
function envios(cfg: Record<string, string>) {
  const num = (v: string | undefined) => Number(v || 0)
  const zona = (
    nombre: string,
    rate: Record<string, unknown>,
    diasMin: number,
    diasMax: number,
  ) => ({
    '@type': 'OfferShippingDetails',
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'AR',
      ...(nombre ? { addressRegion: nombre } : {}),
    },
    shippingRate: { '@type': 'MonetaryAmount', currency: 'ARS', ...rate },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: diasMin, maxValue: diasMax, unitCode: 'DAY' },
    },
  })

  const porKm = cfg.envio_km_activo === '1'
  const base = num(cfg.envio_km_base)
  const porKmValor = num(cfg.envio_km_por_km)
  const radio = num(cfg.envio_km_radio_max)

  const salida = []
  if (porKm && base) {
    salida.push(
      zona('Ciudad Autónoma de Buenos Aires',
        { minValue: base, maxValue: base + porKmValor * radio }, 1, 1),
    )
  } else if (num(cfg.envio_precio_caba)) {
    salida.push(zona('Ciudad Autónoma de Buenos Aires', { value: num(cfg.envio_precio_caba) }, 1, 1))
  }
  if (num(cfg.envio_precio_gba)) {
    salida.push(zona('Buenos Aires', { value: num(cfg.envio_precio_gba) }, 2, 3))
  }
  if (num(cfg.envio_precio_interior)) {
    salida.push(zona('', { value: num(cfg.envio_precio_interior) }, 3, 12))
  }
  return salida.length ? salida : undefined
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const p = await getProducto(slug)
  if (!p) return { title: 'Producto no encontrado' }

  const img = imagenDe(p)

  // El catálogo usa el nombre del proveedor ("Canopla"), pero la gente busca
  // "cartuchera". Si la ficha nunca dice esa palabra, no aparece en esa
  // búsqueda por más que el producto exista. Se nombra UNA vez, en la
  // descripción, de forma natural — no repetido para engañar al buscador.
  const alternativos = nombresAlternativos(p.nombre)
  const tambienConocido = alternativos[0]
  const base = p.descripcion || `Comprá ${p.nombre} en Flow Things con envío a todo el país.`
  const descripcion = recortar(
    tambienConocido ? `${base} También podés buscarlo como ${tambienConocido}.` : base,
  )

  return {
    // El <title> va recortado: Google muestra ~60 caracteres y los nombres
    // del proveedor pasan largo. El nombre completo sigue en la página, en
    // el H1 y en og:title.
    title: tituloSeo(p.nombre),
    description: descripcion,
    alternates: { canonical: `${BASE}/productos/${slug}` },
    openGraph: {
      type: 'website',
      title: p.nombre,
      description: descripcion,
      url: `${BASE}/productos/${slug}`,
      images: img ? [img] : undefined,
    },
  }
}

export default async function ProductoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [p, cfg] = await Promise.all([getProducto(slug), getConfig()])

  // Product + BreadcrumbList. Los campos extra (sku, categoría, condición,
  // vendedor, devoluciones) son los que Google pide para mostrar el resultado
  // enriquecido con precio y disponibilidad, y los que un asistente necesita
  // para poder decir "está a tanto y hay stock".
  const categoriaNombre = (p?.categorias as { nombre: string } | null)?.nombre
  const jsonLd = p
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.nombre,
          description: p.descripcion || undefined,
          image: imagenDe(p) || undefined,
          sku: p.sku || undefined,
          category: categoriaNombre || undefined,
          // Nombres con los que también se lo busca (canopla → cartuchera).
          ...(nombresAlternativos(p.nombre).length
            ? { alternateName: nombresAlternativos(p.nombre) }
            : {}),
          // Quien fabrica el producto, no quien lo vende: es lo que Google
          // cruza con las búsquedas por marca y con su ficha del producto.
          brand: { '@type': 'Brand', name: marcaDe(p.sku) },
          offers: {
            '@type': 'Offer',
            price: p.precio,
            priceCurrency: 'ARS',
            // Hasta cuándo vale el precio. Sin esto Google marca la ficha como
            // incompleta y, cuando la copia que tiene indexada envejece, deja
            // de mostrar el precio en el resultado. La página se rearma cada 5
            // minutos, así que la fecha siempre viaja fresca.
            priceValidUntil: validoHasta(),
            availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
            url: `${BASE}/productos/${slug}`,
            seller: { '@type': 'Organization', name: 'Flow Things', url: BASE },
            // Cuánto sale el envío, por zona. Google lo usa para mostrar el
            // total real en la ficha de Shopping; si no lo encuentra, asume
            // costos propios o descarta el producto. En CABA el envío se cobra
            // por distancia, así que va como rango entre la base y el radio
            // máximo — no un número fijo que después no se cumple.
            shippingDetails: envios(cfg),
            hasMerchantReturnPolicy: {
              '@type': 'MerchantReturnPolicy',
              applicableCountry: 'AR',
              returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
              merchantReturnDays: 10,
              returnMethod: 'https://schema.org/ReturnByMail',
              returnFees: 'https://schema.org/FreeReturn',
            },
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE },
            { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${BASE}/productos` },
            { '@type': 'ListItem', position: 3, name: p.nombre },
          ],
        },
      ]
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  )
}
