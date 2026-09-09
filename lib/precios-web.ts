/**
 * Precio de venta de la tienda web a partir del costo de reposición.
 *
 * El margen se mide sobre lo FACTURADO, no sobre el costo:
 *
 *   precio − cobro − costo − envío = margen × precio
 *
 * De cada peso que entra, Mercado Pago se lleva 1,49% de comisión y las 3
 * cuotas sin interés 10,49% más: 11,98% antes de tocar la mercadería.
 *
 * El envío es un monto fijo —$15.000 a cualquier punto del país— y ahí está
 * toda la gracia del problema: un porcentaje pesa siempre igual, un monto fijo
 * pesa distinto según el tamaño de la venta. Por eso hay dos márgenes:
 *
 *   - Producto por debajo del umbral: el envío lo paga el cliente, no entra en
 *     la cuenta, y se apunta al margen alto.
 *   - Producto por encima: la tienda regala el envío, así que ese costo entra
 *     en el precio y se pide menos margen, porque el producto ya está
 *     aportando $15.000 a la venta.
 *
 * A diferencia de Mercado Libre acá no hay comisión de marketplace —allá la
 * mediana es del 27,9% del precio—, y por eso la web puede ser bastante más
 * barata sin ganar menos.
 */

export type ConfigPreciosWeb = {
  /** Margen sobre lo facturado cuando el envío lo paga el cliente. */
  margen_propio: number;
  /** Margen sobre lo facturado cuando la tienda absorbe el envío. */
  margen_con_envio: number;
  /**
   * Los mismos dos márgenes, recortados, para cuando el precio normal quedaría
   * por encima del de Mercado Libre.
   *
   * No es una rebaja general: se aplica sólo a esa publicación y sólo mientras
   * dure la situación. Si ML sube, la publicación vuelve sola a los normales.
   *
   * El recorte del de envío es más profundo (3 puntos contra 2) y no es un
   * capricho: arriba del umbral el flete va sumado al costo, así que el mismo
   * recorte pesa menos en proporción. Con 15% el precio bajaba 2,74% y no
   * llegaba a la tolerancia del 3%, así que las seis publicaciones con la
   * brecha más grande contra ML no se movían ni un peso. Con 14% baja 4,05% y
   * sí se mueven.
   *
   *   abajo del umbral   28% → 26%   baja 3,23%
   *   arriba del umbral  17% → 14%   baja 4,05%
   */
  margen_propio_vs_ml: number;
  margen_con_envio_vs_ml: number;
  /** Comisión de Mercado Pago sobre el precio. */
  comision_cobro: number;
  /** Costo de las 3 cuotas sin interés, que paga la tienda. Siempre activas. */
  costo_cuotas: number;
  /** Lo que cuesta un envío. Es el techo: el mismo a cualquier punto del país. */
  envio: number;
  /** Desde qué monto el envío es gratis. */
  umbral_envio_gratis: number;
  /** Diferencia mínima para molestarse en cambiar el precio. */
  tolerancia: number;
};

export const CONFIG_WEB_DEFAULT: ConfigPreciosWeb = {
  margen_propio: 0.28,
  margen_con_envio: 0.17,
  margen_propio_vs_ml: 0.26,
  margen_con_envio_vs_ml: 0.14,
  comision_cobro: 0.0149,
  costo_cuotas: 0.1049,
  envio: 15_000,
  umbral_envio_gratis: 61_000,
  tolerancia: 0.03,
};

/**
 * La configuración editable desde el panel pisa los valores por defecto.
 *
 * Cada parámetro tiene su propia clave `precio_*` y no reutiliza las del
 * checkout. Parece redundante y no lo es: la primera versión caía a
 * `envio_gratis_caba_desde` cuando no encontraba la suya, y ese valor es el
 * umbral que cobra la caja hoy —$45.000—, no el que se usó para fijar los
 * precios. El cron salió calculando con un umbral distinto del que había en el
 * cálculo y recomendó subir doce productos sin motivo.
 *
 * Los dos números tienen que terminar siendo el mismo: el precio de un
 * producto asume quién paga el envío, y la caja decide quién lo paga de
 * verdad. Pero que coincidan tiene que ser una decisión explícita, no un
 * fallback silencioso.
 */
export function configDesdeSitio(
  sitio: Record<string, string | undefined>,
  base: ConfigPreciosWeb = CONFIG_WEB_DEFAULT,
): ConfigPreciosWeb {
  const num = (v: string | undefined, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  return {
    ...base,
    envio: num(sitio.precio_costo_envio, base.envio),
    umbral_envio_gratis: num(sitio.precio_umbral_envio_gratis, base.umbral_envio_gratis),
    margen_propio: num(sitio.precio_margen_propio, base.margen_propio),
    margen_con_envio: num(sitio.precio_margen_con_envio, base.margen_con_envio),
  };
}

/**
 * ¿El umbral con el que se fijaron los precios coincide con el que cobra la
 * caja? Si no, hay productos cuyo precio asume que el cliente paga el envío y
 * a los que la tienda se lo termina regalando.
 */
export function umbralDesalineado(
  sitio: Record<string, string | undefined>,
  cfg: ConfigPreciosWeb,
): { checkout: number; precios: number } | null {
  const caja = Number(
    sitio.envio_km_gratis_desde ?? sitio.envio_gratis_caba_desde,
  );
  if (!Number.isFinite(caja) || caja <= 0) return null;
  if (caja === cfg.umbral_envio_gratis) return null;
  return { checkout: caja, precios: cfg.umbral_envio_gratis };
}

export type ProductoWeb = {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
};

export type AjustePrecio = {
  id: string;
  sku: string;
  nombre: string;
  costo_con_iva: number;
  precio_actual: number;
  precio_nuevo: number;
  /** true si a este precio la tienda regala el envío. */
  absorbe_envio: boolean;
  /** Margen sobre lo facturado, al precio actual y al nuevo. */
  margen_actual_pct: number;
  margen_nuevo_pct: number;
  cuotas_monto: number;
  comision_monto: number;
  envio_monto: number;
  /** Lo que queda por unidad al precio nuevo. */
  ganancia: number;
  /** Precio efectivo del mismo SKU en Mercado Libre, si hay publicación. */
  precio_ml: number | null;
  /**
   * El precio nuevo queda por encima del de ML: la web deja de ser la opción
   * barata. Se evalúa DESPUÉS de haber cedido margen, así que acá quedan sólo
   * los que ni con el margen recortado alcanzan.
   */
  mas_caro_que_ml: boolean;
  /** Está usando los márgenes recortados porque el normal superaba a ML. */
  cede_ante_ml: boolean;
  cambia: boolean;
  direccion: "sube" | "baja" | "igual";
  nota: string;
};

/** A la centena, para que el precio se lea como precio y no como cuenta. */
const aCentena = (n: number) => Math.round(n / 100) * 100;
const redondear1 = (n: number) => Math.round(n * 1000) / 10;

/**
 * El precio que deja el margen pedido, con el envío adentro o afuera.
 *
 * Con el envío afuera:  precio = costo / (1 − cobro − margen)
 * Con el envío adentro: precio = (costo + envío) / (1 − cobro − margen)
 */
export function precioParaMargen(
  costoConIva: number,
  margen: number,
  cfg: ConfigPreciosWeb,
  conEnvio: boolean,
): number {
  const cobro = cfg.comision_cobro + cfg.costo_cuotas;
  const resto = 1 - cobro - margen;
  // Un margen imposible (cobro + margen ≥ 100%) devolvería un precio negativo
  // o infinito. Se corta acá antes de que llegue a la tienda.
  if (resto <= 0) return Number.POSITIVE_INFINITY;
  return (costoConIva + (conEnvio ? cfg.envio : 0)) / resto;
}

/** Margen sobre lo facturado a un precio dado. */
export function margenDe(
  precio: number,
  costoConIva: number,
  cfg: ConfigPreciosWeb,
): number {
  if (precio <= 0) return 0;
  const cobro = cfg.comision_cobro + cfg.costo_cuotas;
  const envio = precio >= cfg.umbral_envio_gratis ? cfg.envio : 0;
  return (precio - precio * cobro - costoConIva - envio) / precio;
}

export function calcularPrecioWeb(
  producto: ProductoWeb,
  costoConIva: number,
  cfg: ConfigPreciosWeb = CONFIG_WEB_DEFAULT,
  /** Precio efectivo del mismo SKU en ML, ya con promociones. null si no hay. */
  precioMl: number | null = null,
): AjustePrecio {
  /**
   * Precio para un par de márgenes dado.
   *
   * De qué lado del umbral cae el producto se decide con el precio del margen
   * alto, que es el que tendría si el cliente pagara el envío. Si ese precio ya
   * cruza el umbral, el producto va a regalar envío igual, así que se lo vuelve
   * a calcular con el flete adentro y el margen bajo.
   */
  const objetivoCon = (margenPropio: number, margenConEnvio: number) => {
    const propio = aCentena(precioParaMargen(costoConIva, margenPropio, cfg, false));
    const absorbe = propio >= cfg.umbral_envio_gratis;
    return {
      precio: absorbe
        ? aCentena(precioParaMargen(costoConIva, margenConEnvio, cfg, true))
        : propio,
      absorbe,
    };
  };

  const normal = objetivoCon(cfg.margen_propio, cfg.margen_con_envio);

  /**
   * Ceder margen cuando la web quedaría más cara que Mercado Libre.
   *
   * La comparación es contra el precio NORMAL, no contra el precio que tiene
   * hoy ni contra el recortado. Es lo que hace que la regla sea estable.
   *
   * Comparando contra el precio ya recortado pasaría esto: una publicación
   * apenas 1% arriba de ML baja al margen recortado y queda 2% ABAJO; a la
   * corrida siguiente ya no está más cara que ML, así que vuelve al margen
   * normal y queda arriba otra vez; y a la siguiente vuelve a bajar. El precio
   * oscilaría entre dos valores en cada corrida, para siempre — el mismo
   * círculo vicioso que hubo con los precios de lista de ML.
   *
   * Contra el precio normal no hay oscilación posible: el normal sale del costo
   * y no se mueve porque hayamos recortado. La publicación vuelve sola a los
   * márgenes de siempre cuando ML sube por encima de él, que es exactamente la
   * condición pedida.
   */
  const cedeAnteMl = precioMl != null && normal.precio > precioMl;
  const objetivo = cedeAnteMl
    ? objetivoCon(cfg.margen_propio_vs_ml, cfg.margen_con_envio_vs_ml)
    : normal;

  const precioNuevo = objetivo.precio;
  const absorbe = objetivo.absorbe;

  const cuotas = precioNuevo * cfg.costo_cuotas;
  const comision = precioNuevo * cfg.comision_cobro;
  const envio = absorbe ? cfg.envio : 0;
  const ganancia = precioNuevo - cuotas - comision - costoConIva - envio;

  const margenActual = margenDe(producto.precio, costoConIva, cfg);
  const margenNuevo = precioNuevo > 0 ? ganancia / precioNuevo : 0;

  const diferencia = Math.abs(precioNuevo - producto.precio) / producto.precio;
  const cambia = diferencia > cfg.tolerancia;

  const objetivoPct = absorbe
    ? (cedeAnteMl ? cfg.margen_con_envio_vs_ml : cfg.margen_con_envio)
    : (cedeAnteMl ? cfg.margen_propio_vs_ml : cfg.margen_propio);
  const nota =
    (absorbe
      ? `Arriba de ${cfg.umbral_envio_gratis.toLocaleString("es-AR")}: la tienda paga el envío, `
      : `Abajo de ${cfg.umbral_envio_gratis.toLocaleString("es-AR")}: el envío lo paga el cliente, `) +
    `objetivo ${(objetivoPct * 100).toFixed(0)}%` +
    (cedeAnteMl ? " (recortado porque el precio normal superaba a ML)" : "");

  return {
    id: producto.id,
    sku: producto.sku,
    nombre: producto.nombre,
    costo_con_iva: costoConIva,
    precio_actual: producto.precio,
    precio_nuevo: precioNuevo,
    absorbe_envio: absorbe,
    margen_actual_pct: redondear1(margenActual),
    margen_nuevo_pct: redondear1(margenNuevo),
    cuotas_monto: Math.round(cuotas),
    comision_monto: Math.round(comision),
    envio_monto: envio,
    ganancia: Math.round(ganancia),
    precio_ml: precioMl,
    /**
     * No se fuerza el precio para quedar debajo de ML.
     *
     * Bajarlo rompería el margen que es el objetivo de todo esto, y en los
     * casos que aparecen el problema no es el precio sino el costo de
     * reposición: son productos donde ML cobra poca comisión y por eso su
     * precio queda difícil de igualar. Se marcan para mirarlos con el
     * proveedor, no se tocan solos.
     */
    mas_caro_que_ml: precioMl != null && precioNuevo >= precioMl,
    cede_ante_ml: cedeAnteMl,
    cambia,
    direccion:
      precioNuevo > producto.precio ? "sube" : precioNuevo < producto.precio ? "baja" : "igual",
    nota,
  };
}
