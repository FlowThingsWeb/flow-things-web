import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { unstable_cache } from 'next/cache'

/**
 * Las piezas del banner de la home: una por línea, más las de campaña.
 *
 * Qué se muestra está acá y no en la base a propósito. Son cuatro o cinco
 * piezas que se cambian cada varios meses, no un listado que crece: ponerlas
 * en una tabla obligaba a un ABM entero —orden, colores, qué productos, en qué
 * hueco va cada uno— para editar algo que se toca tres veces al año. Lo que sí
 * sale de la base es lo que cambia solo: las fotos, el precio desde y si la
 * línea todavía tiene stock.
 *
 * Los SKU están en el orden en que ocupan los huecos del banner. El primero
 * es el grande de la izquierda, el cuarto el grande de la derecha; ver
 * `HUECOS` en components/BannerLineas.tsx.
 */

export type PiezaBanner = {
  id: string
  /** A dónde lleva el botón. */  href: string
  titulo: string
  /** Logo de la marca, cuando existe. Reemplaza al título escrito. */
  logo?: string
  /** Tipografía del título: cada línea tiene la suya, si no parecen la misma pieza. */
  familia?: 'serif' | 'condensada' | 'negra'
  bajada: string[]
  cta: string
  fondo: string
  /**
   * Texto y botón para fondo claro.
   *
   * De los 24 logos de marca, 21 son de tinta oscura: están hechos para el
   * catálogo impreso. Las tres piezas cuyo logo queremos mostrar van sobre
   * fondo claro por eso, y entonces el texto tiene que ser oscuro.
   */
  claro?: boolean
  burbujaIzq: string
  burbujaDer: string
  /** Color de los dos arcos del isotipo. Sobre turquesa el verde no se ve. */
  arco: string
  /**
   * Color del mosaico de abajo, que lleva texto blanco.
   *
   * No es el fondo del banner. Cuando la pieza es clara, usar el mismo color
   * dejaría el mosaico con letras blancas sobre crema. Acá va el color
   * profundo de la línea, que es además lo que le da peso a la fila de
   * mosaicos: cuatro bloques pálidos no cortan nada.
   */
  mosaico: string
  skus: string[]
  /** Sólo se muestra entre estas dos fechas, inclusive. Para campañas. */
  desde?: string
  hasta?: string
}

export const PIEZAS: PiezaBanner[] = [
  {
    id: 'el-principito',
    href: '/marcas/el-principito',
    titulo: 'El Principito',
    logo: '/marcas/el-principito.png',
    bajada: ['Sets para armar', 'y dejar a la vista.', '16 modelos distintos'],
    cta: '¡VER MÁS!',
    fondo: '#F6E6C6',
    claro: true,
    burbujaIzq: '#FFFFFF',
    burbujaDer: '#EBC6D6',
    arco: 'rgba(34,64,126,0.16)',
    mosaico: '#22407E',
    skus: ['86315', '86301', '86332', '86311', '86322', '86331'],
  },
  {
    id: 'style-4-ever',
    href: '/marcas/style-4-ever',
    titulo: 'Style 4 Ever',
    logo: '/marcas/style-4-ever.png',
    bajada: ['Peluches para pintar', 'con aerógrafo. Se lavan', 'y se vuelven a pintar'],
    cta: '¡VER MÁS!',
    fondo: '#45C2C2',
    burbujaIzq: '#FBD9E6',
    burbujaDer: '#CBB8E8',
    arco: 'rgba(33,33,33,0.14)',
    mosaico: '#45C2C2',
    skus: ['OFG272', 'OFG228', 'AIR028', 'OFG257', 'OFG243', 'AIR049'],
  },
  {
    id: 'mafalda',
    href: '/marcas/mafalda',
    titulo: 'MAFALDA',
    logo: '/marcas/mafalda.png',
    bajada: ['Cuadernos, canoplas', 'y organizadores.', 'Toda la línea'],
    cta: '¡VER MÁS!',
    fondo: '#FBE6D3',
    claro: true,
    burbujaIzq: '#FFFFFF',
    burbujaDer: '#F9D2CC',
    arco: 'rgba(217,79,69,0.18)',
    mosaico: '#D94F45',
    skus: ['4722-20', '4763-15TD', '4767-15TD', '4798-20', '4760-11TD', '4785-20'],
  },
  {
    id: 'jujutsu-kaisen',
    href: '/marcas/jujutsu-kaisen',
    titulo: 'Jujutsu Kaisen',
    logo: '/marcas/jujutsu-kaisen.png',
    bajada: ['Cajas sorpresa, figuras,', 'posavasos y colgantes.', 'Toda la serie'],
    cta: '¡VER MÁS!',
    fondo: '#E7E1F8',
    claro: true,
    burbujaIzq: '#FFFFFF',
    burbujaDer: '#F4D7E4',
    arco: 'rgba(75,60,135,0.18)',
    mosaico: '#4B3C87',
    skus: ['2726', '2716', '2718', '2727', '2714', '2719'],
  },
]

export type ProductoBanner = {
  sku: string
  nombre: string
  imagen: string
}

export type PiezaResuelta = Omit<PiezaBanner, 'skus'> & {
  productos: ProductoBanner[]
}

/** Hoy en Buenos Aires, como YYYY-MM-DD. El servidor corre en UTC. */
function hoyAR(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())
}

function enFecha(p: PiezaBanner, hoy: string): boolean {
  if (p.desde && hoy < p.desde) return false
  if (p.hasta && hoy > p.hasta) return false
  return true
}

/**
 * Los productos del banner que todavía tienen stock, por SKU.
 *
 * Lo ÚNICO que se cachea es esto: lo que sale de la base. Los colores, los
 * textos y las fechas viven en `PIEZAS`, que es código, y si se cachearan
 * junto con los productos un deploy no cambiaría nada —la caché de datos de
 * Vercel sobrevive a los deploys, así que el banner seguiría pintado con los
 * colores viejos hasta que algo invalide el tag—. Pasó: los fondos claros
 * tardaron un deploy en aparecer porque la entrada vieja los traía adentro.
 */
const getProductosBanner = unstable_cache(
  async (): Promise<Record<string, ProductoBanner>> => {
    const skus = Array.from(new Set(PIEZAS.flatMap((p) => p.skus)))

    const { data, error } = await supabaseAdmin
      .from('productos')
      .select('sku, nombre, imagen_url, imagenes')
      .in('sku', skus)
      .eq('activo', true)
      .gt('stock', 0)

    if (error) {
      console.error('[bannerLineas] no se pudo leer el catálogo:', error.message)
      return {}
    }

    const porSku: Record<string, ProductoBanner> = {}
    for (const p of data || []) {
      const imagen =
        (p as { imagen_url?: string | null }).imagen_url ||
        ((p as { imagenes?: string[] | null }).imagenes || [])[0]
      if (!imagen) continue
      porSku[String(p.sku)] = {
        sku: String(p.sku),
        nombre: String(p.nombre ?? ''),
        imagen,
      }
    }
    return porSku
  },
  ['banner-lineas-productos'],
  { revalidate: 300, tags: ['catalogo'] },
)

/**
 * Resuelve las piezas contra el catálogo.
 *
 * Una pieza que se quedó con menos de dos productos con stock NO se muestra.
 * Un banner de una línea agotada manda al visitante a una página vacía, que es
 * peor que no ofrecerla: el click se gasta igual y la decepción queda.
 *
 * Las fotos salen de la misma consulta, así que si cambiás la imagen de un
 * producto en el admin, el banner la toma sola en la próxima revalidación.
 */
export async function getPiezasBanner(): Promise<PiezaResuelta[]> {
  const porSku = await getProductosBanner()
  const hoy = hoyAR()

  return PIEZAS.filter((p) => enFecha(p, hoy))
    .map(({ skus: lista, ...resto }) => ({
      ...resto,
      productos: lista
        .map((s) => porSku[s])
        .filter((x): x is ProductoBanner => !!x),
    }))
    .filter((p) => p.productos.length >= 2)
}
