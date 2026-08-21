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
  let t = nombre
    .replace(/[!¡]+/g, '')           // "NUEVO!!!" → "NUEVO"
    .replace(/\s*-\s*/g, ' - ')      // guiones parejos
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Los nombres repiten la categoría al principio y en el medio
  // ("Slime - SURPRISE MERMAID - Slime Pote..."). Se saca la repetición.
  const partes = t.split(' - ')
  const vistas = new Set<string>()
  const unicas = partes.filter((p) => {
    const clave = normalizar(p)
    if (!clave) return false
    if (vistas.has(clave)) return false
    // Si una parte posterior ya contiene una anterior, sobra.
    for (const v of vistas) {
      if (clave.includes(v) && v.length > 4) return false
    }
    vistas.add(clave)
    return true
  })
  t = unicas.join(' - ')

  if (t.length <= limite) return t

  // Lo que distingue a un producto de sus hermanos está al FINAL: "EN CAJA
  // MEDIANA" vs "CHICA", "HAIR'IFFIC MINI" vs "SQUISHY". Recortar por el
  // final dejaba títulos idénticos entre productos distintos, que para
  // Google es tan malo como que sean largos. Se conserva la última parte y
  // se rellena desde el principio con lo que entre.
  if (unicas.length > 1) {
    const cola = unicas[unicas.length - 1]
    const frente: string[] = []
    let largo = cola.length
    for (const p of unicas.slice(0, -1)) {
      if (largo + p.length + 3 > limite) break
      frente.push(p)
      largo += p.length + 3
    }
    if (frente.length > 0) return limpiarCola([...frente, cola].join(' - '))
    // Ni la primera parte entra junto con la cola: se recorta la primera y
    // se le pega la cola igual, para no perder el diferenciador.
    // Cortar SIEMPRE en palabra completa: "UNICORN DREA" se lee como un
    // error de la página, no como un título.
    const espacio = Math.max(12, limite - cola.length - 3)
    let inicio = unicas[0]
    if (inicio.length > espacio) {
      const cortado = inicio.slice(0, espacio)
      const ultimoEspacio = cortado.lastIndexOf(' ')
      inicio = ultimoEspacio > 3 ? cortado.slice(0, ultimoEspacio) : unicas[0].split(' ')[0]
    }
    return `${limpiarCola(inicio)} - ${cola}`
  }

  const recorte = t.slice(0, limite)
  const porPalabra = recorte.slice(0, recorte.lastIndexOf(' ')).trim() || recorte.trim()
  return limpiarCola(porPalabra)
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
