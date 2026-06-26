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
  logo_url: '/logo.png',
  header_nombre_1: 'FLOW',
  header_nombre_2: 'THINGS',
  header_nav_catalogo: 'Catálogo',
  header_nav_libreria: 'Librería',
  header_nav_jugueteria: 'Juguetería',
  hero_badge: 'Librería & Juguetería online',
  hero_titulo_1: 'Todo lo que',
  hero_titulo_2: 'imaginás',
  hero_titulo_3: 'en un solo lugar',
  hero_subtitulo: 'Útiles, juguetes, libros y mucho más. Los mejores productos para aprender, crear y jugar, con envío a todo el país.',
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
