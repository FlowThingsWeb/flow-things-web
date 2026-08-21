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
  ['canopla', 'cartuchera', 'estuche', 'portalapices', 'portalápices'],
  ['cuaderno', 'cuaderno escolar'],
  ['carpeta', 'carpeta escolar'],
  ['block', 'anotador', 'bloc'],
  ['separadores', 'separadores de materia'],
  ['etiquetas', 'etiquetas escolares'],
  ['peluche', 'muñeco de peluche', 'plush'],
  ['muñeco', 'figura', 'figurita'],
  ['bloques', 'ladrillos', 'set de construccion', 'set de construcción', 'bloques armables'],
  ['gemas', 'gemas autoadhesivas', 'stickers', 'calcomanias', 'calcomanías'],
  ['masa', 'plastilina', 'masa moldeable'],
  ['slime', 'moco'],
  ['maquillaje', 'cosmetica', 'cosmética', 'make up'],
  ['organizador', 'cartuchera organizador'],
  ['juego de mesa', 'juego de mesa familiar'],
  ['mochila', 'morral'],
]

/** Quita tildes y pasa a minúscula, para comparar sin sorpresas. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

// término normalizado → set de equivalentes normalizados
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
