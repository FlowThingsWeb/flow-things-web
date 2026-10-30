/**
 * La cuenta de los precios del Cyber, separada de la pantalla y del endpoint.
 *
 * Acá no hay base de datos ni fetch: entran números, salen números. Es a
 * propósito — esto decide a cuánto se vende cada cosa durante la promo y
 * cuánto queda de margen, y una cuenta así se prueba sola, sin levantar nada.
 *
 * El margen se mide SOBRE LO FACTURADO, igual que en `precios-web.ts`:
 *
 *   margen = (precio − cobro − costo − envío) / precio
 *
 * Nunca sobre el costo. "Le gano el 30%" sobre un costo de $10.000 es un
 * precio de $13.000 y un margen real del 23%, y esa confusión es justamente
 * la que hace que una promo se vea sana y no lo esté.
 */

/** Comisión de Mercado Pago más el costo de las 3 cuotas sin interés. */
export const COBRO = 0.0149 + 0.1049

export interface ConfigCyber {
  /** Lo que sale un envío. Lo paga la tienda arriba del umbral. */
  envio: number
  /** Desde qué monto el envío es gratis. */
  umbral_envio_gratis: number
  /** Margen mínimo aceptable. Debajo de esto el producto no entra en la promo. */
  piso_margen: number
}

export const CONFIG_CYBER_DEFAULT: ConfigCyber = {
  envio: 15_000,
  umbral_envio_gratis: 61_000,
  /**
   * 8% sobre lo facturado.
   *
   * No es un número redondo elegido de memoria: con el descuento planeado los
   * cinco productos más finos del catálogo caen entre 3,7% y 7,6%, y el resto
   * queda arriba del 10%. El piso en 8% deja afuera exactamente a los que no
   * aguantan y no molesta al resto.
   */
  piso_margen: 0.08,
}

/**
 * El margen que deja vender a ese precio.
 *
 * El envío entra en la cuenta sólo si la tienda lo regala, que depende del
 * precio: por eso el mismo producto puede tener mejor margen MÁS BARATO, si
 * al bajar cruza el umbral y el envío pasa a pagarlo el comprador. Esa
 * frontera es la que hace que el "mismo descuento" no sea el mismo negocio
 * para todos.
 */
export function margenDe(precio: number, costo: number, cfg: ConfigCyber): number {
  if (precio <= 0) return 0
  const envio = precio >= cfg.umbral_envio_gratis ? cfg.envio : 0
  return (precio - precio * COBRO - costo - envio) / precio
}

/**
 * A la centena. El mismo redondeo que usa el ajuste automático de precios:
 * un catálogo con precios a la unidad se lee como un error, no como una
 * oferta.
 */
export const aCentena = (n: number) => Math.round(n / 100) * 100

export interface ProductoCyber {
  id: string
  sku: string | null
  nombre: string
  precio: number
  stock: number
}

export interface FilaCyber {
  id: string
  sku: string | null
  nombre: string
  stock: number
  costo: number | null
  /** El precio con el que arrancó: el respaldo si ya se tocó, el actual si no. */
  precio_original: number
  precio_actual: number
  /** El de lista durante la promo (el original inflado). */
  precio_inflado: number
  /** El que paga el comprador durante la promo. */
  precio_oferta: number
  /** Lo que el comprador ve como descuento: sobre el inflado. */
  descuento_anunciado: number
  /** Lo que el comprador realmente ahorra contra el precio de hoy. */
  descuento_real: number
  margen_actual: number | null
  margen_oferta: number | null
  /** No alcanza el piso: no debería entrar en la promo. */
  bajo_piso: boolean
  /**
   * Hoy tiene envío gratis y con la oferta lo pierde. El comprador ahorra en
   * el producto y paga el flete entero: termina pagando MÁS.
   */
  pierde_envio_gratis: boolean
  /** Cuánto más caro le sale al comprador, si pierde el envío gratis. */
  cuanto_mas_caro: number
  /** Se le recortó el descuento para dejarlo justo en el umbral. */
  clavado_al_umbral: boolean
  /**
   * El precio de oferta no es más barato que el de hoy, o casi.
   *
   * Pasa con los que quedan clavados en el umbral estando ya ahí: el precio
   * no se mueve pero el tachado sí aparece, y el resultado es una ficha que
   * anuncia un descuento que el comprador no recibe. Eso es exactamente lo
   * que no se puede publicar.
   */
  sin_descuento_real: boolean
}

/** Debajo de esto el "descuento" no se nota y no vale la pena anunciarlo. */
export const DESCUENTO_MINIMO = 0.02

export interface Factores {
  /** Cuánto sube el precio de lista. 1,15 = +15%. */
  inflar: number
  /** Cuánto se descuenta sobre el inflado. 0,20 = −20%. */
  descuento: number
  /**
   * Al que hoy tiene envío gratis y con el descuento lo perdería, se le deja
   * el precio justo en el umbral en vez de cruzarlo.
   *
   * Es menos descuento y sin embargo más barato para el comprador: bajar
   * $5.000 un producto de $64.900 le ahorra $5.000 y le agrega $15.000 de
   * flete. Prendido por defecto porque el caso contrario —una "oferta" que
   * sale $10.000 más cara— no es una decisión comercial, es un error.
   */
  cuidar_envio_gratis?: boolean
}

export const FACTORES_DEFAULT: Factores = {
  inflar: 1.15,
  descuento: 0.2,
  cuidar_envio_gratis: true,
}

/**
 * Lo que ya quedó hecho de la promo para este producto, si el paso 1 corrió.
 */
export interface Guardado {
  /** El precio con el que arrancó todo, antes de inflarlo. */
  precioOriginal?: number | null
  /**
   * El precio de lista que de verdad se cobró, tal como quedó guardado.
   *
   * Manda sobre el recalculado: si entre el paso 1 y el paso 2 alguien mueve
   * el porcentaje de inflado en la pantalla, el tachado tiene que seguir
   * siendo el número que estuvo vigente y no el que daría la cuenta nueva.
   * Un tachado que nunca se cobró es exactamente lo que no se puede publicar.
   */
  precioInflado?: number | null
}

/**
 * Simula la promo sobre un producto, sin tocar nada.
 *
 * `precioOriginal` es el precio con el que arrancó todo. Importa cuando el
 * primer paso ya se dio: ahí `precio` es el inflado y calcular el descuento
 * sobre él sería correcto, pero calcular el "ahorro real" contra él sería
 * mentira — el comprador compara contra lo que valía antes, no contra lo que
 * valió dos días.
 */
export function simular(
  p: ProductoCyber,
  costo: number | null,
  factores: Factores,
  cfg: ConfigCyber,
  guardado?: Guardado | number | null,
): FilaCyber {
  // Acepta el número suelto por compatibilidad con las llamadas viejas.
  const g: Guardado =
    typeof guardado === 'number' ? { precioOriginal: guardado } : (guardado ?? {})
  const original = g.precioOriginal ?? p.precio
  const inflado = g.precioInflado ?? aCentena(original * factores.inflar)
  const sinClavar = aCentena(inflado * (1 - factores.descuento))

  /**
   * El que cruza el umbral hacia abajo se queda clavado en el umbral.
   *
   * Un producto de $64.900 bajado a $59.700 le ahorra $5.200 al comprador y
   * le suma $15.000 de flete. Dejarlo en $61.000 es menos descuento y es
   * casi $10.000 más barato para él.
   */
  const cuidar = factores.cuidar_envio_gratis !== false
  const cruzaHaciaAbajo = original >= cfg.umbral_envio_gratis && sinClavar < cfg.umbral_envio_gratis
  const clavado = cuidar && cruzaHaciaAbajo
  const oferta = clavado ? cfg.umbral_envio_gratis : sinClavar

  const margenActual = costo == null ? null : margenDe(p.precio, costo, cfg)
  const margenOferta = costo == null ? null : margenDe(oferta, costo, cfg)

  const pierde = original >= cfg.umbral_envio_gratis && oferta < cfg.umbral_envio_gratis

  return {
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    stock: p.stock,
    costo,
    precio_original: original,
    precio_actual: p.precio,
    precio_inflado: inflado,
    precio_oferta: oferta,
    descuento_anunciado: inflado > 0 ? (inflado - oferta) / inflado : 0,
    descuento_real: original > 0 ? (original - oferta) / original : 0,
    margen_actual: margenActual,
    margen_oferta: margenOferta,
    /**
     * Sin costo no se puede decir que esté bajo el piso, pero tampoco que no:
     * entra como "bajo piso" para que quede desmarcado y alguien lo mire. Un
     * producto sin costo en el CRM es un producto del que no sabemos si
     * perdemos plata al venderlo.
     */
    bajo_piso: margenOferta == null || margenOferta < cfg.piso_margen,
    pierde_envio_gratis: pierde,
    cuanto_mas_caro: pierde ? cfg.envio - (original - oferta) : 0,
    clavado_al_umbral: clavado,
    sin_descuento_real: original > 0 && (original - oferta) / original < DESCUENTO_MINIMO,
  }
}

/**
 * El precio de oferta que conserva el envío gratis.
 *
 * Para los que quedan apenas abajo del umbral: en vez de "ahorrás $5.000 y
 * pagás $15.000 de flete", se los deja justo en el umbral. Es menos descuento
 * y es más barato para el comprador, que es lo único que importa.
 */
export function precioQueConservaEnvioGratis(cfg: ConfigCyber): number {
  return cfg.umbral_envio_gratis
}

export interface ResumenCyber {
  total: number
  elegidos: number
  bajo_piso: number
  pierden_envio_gratis: number
  sin_costo: number
  margen_promedio_actual: number
  margen_promedio_oferta: number
}

export function resumir(filas: FilaCyber[], elegidos: Set<string>): ResumenCyber {
  const conCosto = filas.filter((f) => f.margen_actual != null && f.margen_oferta != null)
  const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  return {
    total: filas.length,
    elegidos: elegidos.size,
    bajo_piso: filas.filter((f) => f.bajo_piso).length,
    pierden_envio_gratis: filas.filter((f) => f.pierde_envio_gratis).length,
    sin_costo: filas.filter((f) => f.costo == null).length,
    margen_promedio_actual: prom(conCosto.map((f) => f.margen_actual!)),
    margen_promedio_oferta: prom(conCosto.map((f) => f.margen_oferta!)),
  }
}
