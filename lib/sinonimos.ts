/**
 * Sinónimos entre el vocabulario del proveedor y el que usa la gente.
 *
 * El catálogo viene con los nombres del fabricante: "Canopla", "Block",
 * "Gemas Autoadhesivas". Pero nadie busca "canopla lotso" — busca
 * "cartuchera lotso". Sin esta traducción el producto existe, está activo y
 * aun así es invisible: ni Google ni el buscador del propio sitio lo
 * encuentran, porque la palabra nunca aparece en la página.
 *
 * Se usa en dos lugares:
 *   1. El buscador del sitio, para que "cartuchera" encuentre las canoplas.
 *   2. Los datos estructurados y la descripción de cada ficha, para que la
 *      página contenga el término con el que se busca de verdad.
 *
 * Solo equivalencias reales. Meter términos que no describen el producto es
 * keyword stuffing: Google lo penaliza y al cliente lo hace sentir estafado.
 */

/** Grupos de términos equivalentes. Todos los de un grupo se implican entre sí. */
const GRUPOS: string[][] = [
  // Cada grupo sale de palabras que EXISTEN en el catálogo, cruzadas con el
  // término con el que la gente las busca. Se usan palabras sueltas y no
  // frases: la búsqueda compara palabra por palabra, así que "arena kinetica"
  // como una sola entrada nunca matchearía.
  ['canopla', 'cartuchera', 'estuche', 'portalapices'],
  ['plush', 'peluche'],
  ['airbrush', 'aerografo', 'soplador'],
  ['arena', 'kinetica', 'cinetica'],
  ['construccion', 'armar', 'armable', 'bloques', 'ladrillos'],
  ['diorama', 'maqueta'],
  ['posavasos', 'apoyavasos'],
  ['llavero', 'colgante'],
  ['estilista', 'peluqueria', 'peinados'],
  ['cosmetica', 'maquillaje'],
  ['pupa', 'paleta'],
  ['masa', 'plastilina'],
  ['slime', 'moco'],
  ['gemas', 'stickers', 'calcomanias', 'autoadhesivas'],
  ['muñeco', 'figura', 'juguete'],
  ['set', 'kit'],
  ['caja', 'box'],
  ['cuaderno', 'anotador'],
  ['block', 'bloc'],
  ['carpeta', 'bibliorato'],
  ['separadores', 'divisores'],
  ['mochila', 'morral'],
  ['cristal', 'esfera'],
]

/** Quita tildes y pasa a minúscula, para comparar sin sorpresas. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

// término normalizado → set de equivalentes normalizados.
// Se acumula: un término puede pertenecer a más de un grupo ("bloques" está
// en construcción y también es sinónimo de ladrillos). Si se sobrescribiera,
// el término se quedaría solo con el último grupo y perdería equivalencias.
const MAPA = new Map<string, Set<string>>()
for (const grupo of GRUPOS) {
  const norm = grupo.map(normalizar)
  for (const t of norm) {
    const set = MAPA.get(t) ?? new Set<string>()
    norm.forEach((o) => set.add(o))
    MAPA.set(t, set)
  }
}

/** Todos los equivalentes de un término (incluido el propio). */
export function equivalentesDe(termino: string): string[] {
  const t = normalizar(termino)
  return Array.from(MAPA.get(t) ?? [t])
}

/**
 * ¿El texto contiene esta palabra, o alguno de sus sinónimos?
 * Es lo que permite que "cartuchera" matchee un producto llamado "Canopla".
 */
export function contieneConSinonimos(textoNormalizado: string, palabra: string): boolean {
  return equivalentesDe(palabra).some((e) => textoNormalizado.includes(e))
}

/**
 * Términos alternativos con los que se podría buscar un producto, a partir de
 * su nombre. Sirven para `alternateName` en los datos estructurados.
 *
 * Devuelve el nombre con la palabra reemplazada, no una lista suelta de
 * palabras: "Canopla Box Lotso" → "Cartuchera Box Lotso".
 */
export function nombresAlternativos(nombre: string, max = 3): string[] {
  const alt = new Set<string>()
  const palabras = nombre.split(/\s+/)

  for (const original of palabras) {
    const limpia = normalizar(original).replace(/[^\p{L}]/gu, '')
    const eq = MAPA.get(limpia)
    if (!eq) continue
    for (const sinonimo of eq) {
      if (sinonimo === limpia || sinonimo.includes(' ')) continue
      // Reemplaza solo esa palabra y deja intacto el resto del nombre, para
      // no romper mayúsculas de marca ("LOTSO", "PVC").
      const conMayus = sinonimo.charAt(0).toUpperCase() + sinonimo.slice(1)
      alt.add(nombre.replace(original, conMayus))
      if (alt.size >= max) return Array.from(alt)
    }
  }
  return Array.from(alt)
}

/**
 * Título corto para el <title> de la ficha, sin tocar el nombre que se
 * muestra en la página.
 *
 * Los nombres vienen del proveedor y son largos y a los gritos: repiten la
 * categoría, encadenan guiones y meten "!!!". 52 de las 90 páginas del sitio
 * pasaban los 60 caracteres que muestra Google, así que el título se cortaba
 * a la mitad justo donde estaba la información que distingue al producto.
 *
 * @param limite Caracteres útiles antes del " | Flow Things" del template.
 */
export function tituloSeo(nombre: string, limite = 52): string {
  const limpio = nombre
    .replace(/[!¡]+/g, '')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  let partes = limpio.split(' - ').filter((p) => p.trim().length > 0)

  // Los nombres del proveedor repiten la categoría: "Slime - BAG SLIME -
  // Slime En Bolsa Reutilizable - 6 Colores". Se descarta el segmento CORTO
  // que ya está contenido en otro más largo, nunca al revés: quedarse con
  // "Slime" y tirar "Slime En Bolsa Reutilizable" borra justamente las
  // palabras con las que la gente busca el producto.
  partes = partes.filter((p, i) => {
    const a = normalizar(p)
    return !partes.some((otra, j) => {
      if (i === j) return false
      const b = normalizar(otra)
      if (a === b) return j < i // duplicado exacto: se queda el primero
      return b.includes(a) && b.length > a.length
    })
  })

  const unir = (xs: string[]) => xs.join(' - ')
  if (unir(partes).length <= limite) return unir(partes)

  // Todavía largo: se van soltando los segmentos MÁS CORTOS del medio, que
  // son los que menos información aportan ("6 Colores", "En Caja"). El
  // primero y el último se protegen: uno trae la marca y el otro es el que
  // distingue al producto de sus hermanos.
  const trabajo = [...partes]
  while (unir(trabajo).length > limite && trabajo.length > 2) {
    let idx = 1
    for (let i = 1; i < trabajo.length - 1; i++) {
      if (trabajo[i].length < trabajo[idx].length) idx = i
    }
    // Si el segmento del medio es MÁS largo que el último, el que sobra es
    // el último. Sin esto, "Slime - SURPRISE MERMAID - Slime Pote
    // C/Sorpresa - 12 Sirenas" terminaba en "SURPRISE MERMAID - 12 Sirenas":
    // un producto de slime cuyo título no dice "slime".
    const ultimo = trabajo.length - 1
    if (trabajo[idx].length > trabajo[ultimo].length) idx = ultimo
    trabajo.splice(idx, 1)
  }
  if (unir(trabajo).length <= limite) return limpiarCola(unir(trabajo))

  // Ni con dos segmentos entra: se recorta el primero en palabra completa y
  // se conserva el último entero.
  if (trabajo.length > 1) {
    const cola = trabajo[trabajo.length - 1]
    const espacio = Math.max(12, limite - cola.length - 3)
    let inicio = trabajo[0]
    if (inicio.length > espacio) {
      const cortado = inicio.slice(0, espacio)
      const sp = cortado.lastIndexOf(' ')
      inicio = sp > 3 ? cortado.slice(0, sp) : inicio.split(' ')[0]
    }
    return `${limpiarCola(inicio)} - ${cola}`
  }

  const recorte = unir(trabajo).slice(0, limite)
  const sp = recorte.lastIndexOf(' ')
  return limpiarCola(sp > 0 ? recorte.slice(0, sp) : recorte)
}

/**
 * Saca de la cola las palabras que quedaron colgando tras el recorte.
 * Un título que termina en "PVC Con" o "DESPLEGABLE 5" se lee como un error.
 */
function limpiarCola(t: string): string {
  const colgantes = new Set([
    'con', 'c/', 'de', 'del', 'en', 'y', 'para', 'por', 'a', 'el', 'la',
    'los', 'las', 'un', 'una', 'al', 'sin',
  ])
  let out = t.trim()
  for (;;) {
    const partes = out.split(' ')
    const ultima = normalizar(partes[partes.length - 1])
    // Una palabra conectora, o un número suelto que era parte de algo mayor
    // ("5 PISOS" cortado en "5"), no aportan nada al final del título.
    if (partes.length > 2 && (colgantes.has(ultima) || /^\d+$/.test(ultima))) {
      partes.pop()
      out = partes.join(' ')
      continue
    }
    break
  }
  return out.replace(/[\s\-–—,]+$/, '').trim()
}
