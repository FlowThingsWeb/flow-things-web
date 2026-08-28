import { supabaseAdmin } from './supabaseAdmin'

export interface ConfigMap {
  // General
  sitio_nombre: string
  logo_url: string
  // Header
  header_nombre_1: string
  header_nombre_2: string
  header_nav_catalogo: string
  header_nav_libreria: string
  header_nav_jugueteria: string
  // Hero
  hero_badge: string
  hero_h1_1: string
  hero_h1_2: string
  hero_titulo_1: string
  hero_titulo_2: string
  hero_titulo_3: string
  hero_subtitulo: string
  hero_cta_primario: string
  hero_cta_secundario: string
  hero_banner_url: string
  // Secciones home
  seccion_categorias_titulo: string
  seccion_destacados_titulo: string
  seccion_ver_todos: string
  // Banners
  mp_titulo: string
  mp_texto: string
  // Footer
  footer_tagline: string
  footer_instagram: string
  footer_tienda_titulo: string
  footer_contacto_titulo: string
  footer_email: string
  footer_telefono: string
  footer_link_catalogo: string
  footer_link_libreria: string
  footer_link_jugueteria: string
  footer_link_utiles: string
  footer_banner_url: string
  footer_copyright: string
  // Envíos — precios por zona
  envio_precio_caba: string
  envio_precio_gba: string
  envio_precio_interior: string
  envio_gratis_caba_desde: string
  envio_gratis_gba_desde: string
  envio_gratis_interior_desde: string
  envio_tiempo_caba: string
  envio_tiempo_gba: string
  envio_tiempo_interior: string
  cabify_direccion_origen: string
  // Envío por cercanía (km) — reemplaza CABA/AMBA cuando está activo
  envio_km_activo: string        // '1' | '0'
  envio_km_origen: string        // dirección del local (origen)
  envio_km_base: string          // costo base $
  envio_km_por_km: string        // $ por km
  envio_km_gratis_desde: string  // subtotal para envío gratis
  envio_km_radio_max: string     // km máximo; fuera de radio → cae a zona plana
  envio_km_nombre: string        // etiqueta mostrada
  envio_km_tiempo: string        // tiempo estimado
  // Design
  design_overrides: string
  design_font_family: string
  design_color_primary: string
  design_color_accent: string
  design_color_bg: string
  [key: string]: string
}

const DEFAULTS: ConfigMap = {
  sitio_nombre: 'Flow Things',
  // 128 px, no el master de 512. Lo único que lee esta clave son el logo
  // del encabezado (36 px) y el del pie (40 px). `/logo.png` sigue existiendo
  // para la factura, los mails y el logo de Organization de los datos
  // estructurados, que sí necesitan resolución.
  logo_url: '/logo-chico.png',
  header_nombre_1: 'FLOW',
  header_nombre_2: 'THINGS',
  header_nav_catalogo: 'Catálogo',
  header_nav_libreria: 'Librería',
  header_nav_jugueteria: 'Juguetería',
  hero_badge: 'Librería & Juguetería online',
  // El h1 arranca con lo que la gente escribe en Google. La frase de marca
  // sigue en el mismo h1, abajo (hero_titulo_1..3): se lee igual, pero el
  // encabezado ya no es sólo un eslogan.
  hero_h1_1: 'Juguetería y librería',
  hero_h1_2: 'online',
  hero_titulo_1: 'Todo lo que',
  hero_titulo_2: 'imaginás',
  hero_titulo_3: 'en un solo lugar',
  hero_subtitulo: 'Juguetes, librería y regalos. Los mejores productos para aprender, crear y jugar, con envío a todo el país.',
  hero_cta_primario: 'Ver catálogo completo',
  hero_cta_secundario: 'Explorar juguetería',
  hero_banner_url: '/banner.png',
  seccion_categorias_titulo: 'Explorar por categoría',
  seccion_destacados_titulo: 'Productos destacados',
  seccion_ver_todos: 'Ver todos →',
  mp_titulo: 'Pagá como quieras 💳',
  mp_texto: 'Aceptamos todas las tarjetas y transferencia bancaria a través de Mercado Pago.',
  footer_tagline: 'Tu librería y juguetería de confianza. Todo lo que necesitás para aprender, crear y jugar.',
  footer_instagram: 'https://instagram.com/flowthings__',
  footer_tienda_titulo: 'Tienda',
  footer_contacto_titulo: 'Contacto',
  footer_email: 'contacto@flowthings.com.ar',
  footer_telefono: '+54 9 11 5607 5633',
  footer_link_catalogo: 'Todo el catálogo',
  footer_link_libreria: 'Librería',
  footer_link_jugueteria: 'Juguetería',
  footer_link_utiles: 'Útiles escolares',
  footer_banner_url: '/banner.png',
  footer_copyright: 'Todos los derechos reservados.',
  // Envíos — precios por zona
  envio_precio_caba: '2500',
  envio_precio_gba: '3500',
  envio_precio_interior: '6000',
  envio_gratis_caba_desde: '40000',
  envio_gratis_gba_desde: '60000',
  envio_gratis_interior_desde: '120000',
  envio_tiempo_caba: '24-48 hs hábiles',
  envio_tiempo_gba: '48-72 hs hábiles',
  envio_tiempo_interior: '3-7 días hábiles',
  cabify_direccion_origen: 'Federico Lacroze 3885, CABA, 1427',
  // Envío por cercanía (km) — off hasta configurar key + origen
  envio_km_activo: '0',
  envio_km_origen: '',
  envio_km_base: '2000',
  envio_km_por_km: '300',
  envio_km_gratis_desde: '40000',
  envio_km_radio_max: '20',
  envio_km_nombre: 'Envío a domicilio',
  envio_km_tiempo: 'Coordinamos el día de entrega',
  // Design
  design_overrides: '',
  design_font_family: 'inherit',
  design_color_primary: '#9333ea',
  design_color_accent: '#c8ff00',
  design_color_bg: '#0f0f0f',
}

import { unstable_cache } from 'next/cache'

async function _getConfig(): Promise<ConfigMap> {
  const { data } = await supabaseAdmin
    .from('configuracion')
    .select('clave, valor')

  const config: ConfigMap = { ...DEFAULTS }
  for (const row of data || []) {
    if (row.valor !== null && row.valor !== '') {
      config[row.clave] = row.valor
    }
  }
  return config
}

/** Configuración con caché de 60 segundos — evita query a Supabase en cada pageview */
export const getConfig = unstable_cache(
  _getConfig,
  ['site-config'],
  { revalidate: 60, tags: ['site-config'] }
)

/**
 * Claves que no tienen por qué llegar al browser.
 *
 * `getConfig()` devuelve las 47 filas de `configuracion`, y el layout le pasa
 * el objeto entero a UserShell, que es un componente de cliente: Next serializa
 * todo eso en el HTML de TODAS las páginas. Ahí viajaban los cuerpos HTML
 * completos de los mails de notificación —12,6 KB que ningún visitante usa— y
 * el código del cupón post-compra, que se supone que se entrega recién después
 * de comprar y estaba a la vista de cualquiera en el código fuente.
 *
 * Es una lista de exclusión, no de inclusión: si mañana se agrega una clave que
 * sí necesita la UI, sigue funcionando sola. La contra es que una clave nueva
 * pesada o sensible hay que acordarse de sumarla acá, por prefijo o por nombre.
 */
const PREFIJOS_SOLO_SERVIDOR = ['notif_', 'mailing_']
const CLAVES_SOLO_SERVIDOR = ['cupon_postcompra_codigo']

/**
 * La misma config, sin lo que sólo usa el servidor. Va en todo borde donde el
 * objeto cruza a un componente de cliente.
 */
export function configParaCliente(cfg: ConfigMap): ConfigMap {
  const salida = {} as ConfigMap
  for (const [clave, valor] of Object.entries(cfg)) {
    if (CLAVES_SOLO_SERVIDOR.includes(clave)) continue
    if (PREFIJOS_SOLO_SERVIDOR.some((p) => clave.startsWith(p))) continue
    salida[clave] = valor
  }
  return salida
}

export interface ConfigRow {
  clave: string
  valor: string | null
  tipo: string
  etiqueta: string
  seccion: string
}

export async function getConfigRows(): Promise<ConfigRow[]> {
  const { data } = await supabaseAdmin
    .from('configuracion')
    .select('*')
    .order('seccion')

  return (data || []) as ConfigRow[]
}
