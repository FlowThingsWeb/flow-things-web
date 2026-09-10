import { supabaseAdmin } from './supabaseAdmin'
import { CATEGORIAS_PAUSADAS } from './categoriasPausadas'

/**
 * Vigilante del feed de productos de Google.
 *
 * El 2/9/2026 a las 18:08 un deploy agregó `<g:region>` al bloque de envío del
 * feed. Google acepta ese atributo sólo en Australia, Estados Unidos y Japón;
 * en Argentina es inválido y desaprueba el producto entero. A las 18:10 Google
 * ya registraba la caída. Ocho días después el catálogo estaba 106 de 106 sin
 * aprobar, sin anuncios de Shopping ni fichas gratuitas, y nadie lo relacionó
 * con aquel deploy.
 *
 * El vigilante de crons no sirve para esto: mira que los crons corran, no que
 * lo que producen sea válido. El feed corría perfecto — lo que salía estaba mal.
 *
 * Esto revisa el feed REAL, el mismo que descarga Google, no una versión
 * calculada aparte. Un feed que se rompe sólo en producción es exactamente el
 * caso que hay que agarrar.
 */

export type ProblemaFeed = {
  clave: string
  titulo: string
  detalle: string
}

/**
 * Atributos que Google acepta sólo en algunos países y que en Argentina
 * invalidan el producto.
 *
 * `region` está por experiencia propia. Los otros dos son de la misma familia
 * —subatributos de shipping restringidos por país— y se listan para que el día
 * que alguien los agregue el feed avise en vez de caerse en silencio.
 */
const ATRIBUTOS_PROHIBIDOS = ['g:region', 'g:location_id', 'g:location_group_name']

/** Sin estos atributos Merchant no aprueba el producto. */
const ATRIBUTOS_OBLIGATORIOS = [
  'g:id',
  'title',
  'link',
  'g:image_link',
  'g:price',
  'g:availability',
  'g:condition',
  'g:brand',
]

/**
 * Cuánto puede achicarse el feed respecto del catálogo antes de avisar.
 *
 * No se exige coincidencia exacta: entre que se lee la base y que se pide el
 * feed puede entrar o salir un producto. Pero una caída grande significa que el
 * feed dejó de armar items, y ésa es la forma silenciosa de desaparecer de
 * Google — el feed responde 200 y está bien formado, sólo que vacío.
 */
const CAIDA_TOLERADA = 0.1

function contar(texto: string, aguja: string): number {
  return texto.split(aguja).length - 1
}

export async function revisarFeed(base?: string): Promise<ProblemaFeed[]> {
  const url = `${(base || process.env.NEXT_PUBLIC_APP_URL || 'https://www.flowthings.com.ar').replace(/\/$/, '')}/api/feed`
  const problemas: ProblemaFeed[] = []

  let xml: string
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
    if (!r.ok) {
      return [{
        clave: 'feed-caido',
        titulo: 'El feed de Google no responde',
        detalle: `${url} contestó ${r.status}. Google no puede leer el catálogo; los productos se van a ir venciendo.`,
      }]
    }
    xml = await r.text()
  } catch (e: any) {
    return [{
      clave: 'feed-caido',
      titulo: 'El feed de Google no responde',
      detalle: `No se pudo pedir ${url}: ${e?.message ?? e}`,
    }]
  }

  const items = xml.split('<item>').slice(1).map(t => t.split('</item>')[0])

  // ── Estructura ────────────────────────────────────────────────────────────
  if (contar(xml, '<item>') !== contar(xml, '</item>') || !xml.includes('</rss>')) {
    problemas.push({
      clave: 'feed-roto',
      titulo: 'El feed está mal formado',
      detalle: 'Las etiquetas no cierran. Google descarta el archivo entero, no el item con el problema.',
    })
  }

  /**
   * Un & suelto rompe el XML y con él todo el feed. Pasa cuando un nombre de
   * producto trae "&" y alguien lo interpola sin escapar.
   */
  const sueltos = (xml.match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g) || []).length
  if (sueltos > 0) {
    problemas.push({
      clave: 'feed-ampersand',
      titulo: 'Hay caracteres sin escapar en el feed',
      detalle: `${sueltos} "&" sueltos. Rompen el XML y Google descarta el feed completo.`,
    })
  }

  // ── Atributos que desaprueban en Argentina ────────────────────────────────
  for (const attr of ATRIBUTOS_PROHIBIDOS) {
    const n = contar(xml, `<${attr}>`)
    if (n > 0) {
      problemas.push({
        clave: `feed-prohibido-${attr}`,
        titulo: `El feed manda ${attr}, que en Argentina es inválido`,
        detalle: `Aparece ${n} vez/veces. Google lo admite sólo en Australia, EE.UU. y Japón; acá desaprueba el producto entero. Es lo que dejó el catálogo sin aprobar en septiembre de 2026.`,
      })
    }
  }

  // ── Atributos obligatorios ────────────────────────────────────────────────
  for (const attr of ATRIBUTOS_OBLIGATORIOS) {
    const faltan = items.filter(it => {
      const m = it.match(new RegExp(`<${attr.replace(':', ':')}>([\\s\\S]*?)</${attr}>`))
      return !m || !m[1].trim()
    }).length
    if (faltan > 0) {
      problemas.push({
        clave: `feed-falta-${attr}`,
        titulo: `${faltan} producto(s) sin ${attr}`,
        detalle: `${attr} es obligatorio: sin él Merchant no aprueba el producto. Son ${faltan} de ${items.length}.`,
      })
    }
  }

  // ── Cantidad ──────────────────────────────────────────────────────────────
  const { data: productos, error } = await supabaseAdmin
    .from('productos')
    .select('id, categorias(slug)')
    .eq('activo', true)
  if (!error && productos) {
    const esperados = productos.filter(
      (p: any) => !CATEGORIAS_PAUSADAS.includes(p.categorias?.slug),
    ).length
    if (esperados > 0 && items.length < esperados * (1 - CAIDA_TOLERADA)) {
      problemas.push({
        clave: 'feed-incompleto',
        titulo: 'Al feed le faltan productos',
        detalle: `Trae ${items.length} y en el catálogo hay ${esperados} activos. Google sólo puede mostrar lo que el feed le da.`,
      })
    }
  }

  return problemas
}

export function htmlDeProblemasFeed(problemas: ProblemaFeed[], base?: string): string {
  const url = `${(base || process.env.NEXT_PUBLIC_APP_URL || 'https://www.flowthings.com.ar').replace(/\/$/, '')}/api/feed`
  const items = problemas
    .map(p => `<li style="margin-bottom:14px">
      <strong style="color:#111">${p.titulo}</strong><br/>
      <span style="color:#444">${p.detalle}</span>
    </li>`)
    .join('')

  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px">
  <h2 style="font-size:18px;color:#b91c1c;margin:0 0 6px">El feed de Google tiene problemas</h2>
  <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 16px">
    Google lee <a href="${url}" style="color:#7C3AED">${url}</a> una vez por día. Mientras esto siga así, los
    productos afectados no se muestran ni en anuncios de Shopping ni en fichas gratuitas.
  </p>
  <ul style="font-size:14px;line-height:1.6;margin:0 0 16px;padding-left:20px">${items}</ul>
  <p style="font-size:13px;color:#666;line-height:1.6;margin:0">
    En septiembre de 2026 un problema de este tipo tuvo el catálogo entero sin aprobar durante ocho días
    sin que nada avisara. Por eso este chequeo existe.
  </p>
</div>`
}
