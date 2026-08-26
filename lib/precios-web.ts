/**
 * Precio de venta de la tienda web a partir del costo de reposición.
 *
 *   precio × (1 − comisión de cobro) − envío − costo con IVA = ganancia
 *
 * A diferencia de Mercado Libre acá no hay comisión de marketplace: sólo la de
 * Mercado Pago por procesar el cobro. Por eso los márgenes de la web son —y
 * deben ser— bastante más altos que los de ML.
 *
 * El envío se cuenta cuando el precio supera el umbral de envío gratis de la
 * zona de referencia: arriba de ese monto lo paga la tienda.
 */

/** Una zona de envío, con lo que cuesta y desde cuánto la paga la tienda. */
export type ZonaEnvio = { nombre: string; costo: number; gratis_desde: number };

/**
 * Un escalón del plan de cuotas sin interés: a partir de cierto monto se
 * habilitan más cuotas, y cuantas más cuotas, más caro le sale a la tienda.
 * El recargo lo paga la tienda, no el comprador.
 */
export type EscalonCuotas = { cuotas: number; costo: number; desde: number };

export type ConfigPreciosWeb = {
  /** Margen mínimo sobre el costo con IVA, ya descontados cobro y envío. */
  margen_min: number;
  /** Margen al que se apunta. No es techo: lo que vende bien no se toca. */
  margen_objetivo: number;
  /** Comisión de Mercado Pago sobre el precio. */
  comision_cobro: number;
  /**
   * Escalones de cuotas sin interés activos en la cuenta de Mercado Pago. Se
   * aplica el más alto que el monto alcance: se asume que el comprador elige
   * el máximo de cuotas disponible, que es lo más caro para la tienda.
   */
  escalones_cuotas: EscalonCuotas[];
  /** Ventana para considerar que un producto "se está vendiendo". */
  dias_ventana_ventas: number;
  /** Cuántas unidades tiene que haber vendido en esa ventana para no tocarlo. */
  ventas_minimas: number;
  /** Zonas con sus costos y umbrales de envío gratis. */
  zonas: ZonaEnvio[];
  /** Diferencia mínima para molestarse en cambiar el precio. */
  tolerancia: number;
};

export const CONFIG_WEB_DEFAULT: ConfigPreciosWeb = {
  margen_min: 0.2,
  margen_objetivo: 0.4,
  comision_cobro: 0.0149,
  // Planes activos hoy en la cuenta de Mercado Pago, de menor a mayor monto.
  escalones_cuotas: [
    { cuotas: 2, costo: 0.0779, desde: 95000 },
    { cuotas: 3, costo: 0.1049, desde: 115000 },
    { cuotas: 6, costo: 0.1869, desde: 311000 },
  ],
  // Una venta en la última semana alcanza para dejar el precio quieto.
  dias_ventana_ventas: 7,
  ventas_minimas: 1,
  // Los mismos valores que cobra la tienda hoy, por zona.
  zonas: [
    { nombre: "CABA", costo: 7500, gratis_desde: 45000 },
    { nombre: "GBA", costo: 15000, gratis_desde: 65000 },
    { nombre: "AMBA", costo: 20000, gratis_desde: 90000 },
    { nombre: "Buenos Aires", costo: 30000, gratis_desde: 130000 },
    { nombre: "Interior", costo: 40000, gratis_desde: 175000 },
  ],
  tolerancia: 0.03,
};

/**
 * Cuánto puede costarle el envío a la tienda a ese precio, en el peor caso.
 *
 * Cada zona tiene su umbral: a $50.000 el envío es gratis para CABA (y lo paga
 * la tienda) pero el cliente del interior todavía lo paga. Se toma la zona más
 * cara entre las que ya superaron su umbral, así el margen mínimo se cumple
 * vendas a donde vendas. Con dos órdenes en la web no hay historial para
 * ponderar por zona real; cuando lo haya, esto se puede afinar.
 */
export function costoEnvioDe(precio: number, zonas: ZonaEnvio[]): number {
  return zonas.reduce(
    (peor, z) => (precio >= z.gratis_desde && z.costo > peor ? z.costo : peor),
    0,
  );
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
  margen_actual_pct: number;
  margen_nuevo_pct: number;
  comision_monto: number;
  comision_pct: number;
  costo_envio: number;
  ganancia: number;
  unidades_vendidas: number;
  cambia: boolean;
  direccion: "sube" | "baja" | "igual";
  nota: string;
};

const aCentena = (n: number) => Math.ceil(n / 100) * 100;
const redondear1 = (n: number) => Math.round(n * 1000) / 10;

export function calcularPrecioWeb(
  producto: ProductoWeb,
  costoConIva: number,
  unidadesVendidas: number,
  cfg: ConfigPreciosWeb = CONFIG_WEB_DEFAULT,
): AjustePrecio {
  const envioDe = (precio: number) => costoEnvioDe(precio, cfg.zonas);

  /**
   * Comisión total sobre el precio. Arriba del mínimo del plan se suma el
   * costo de las cuotas sin interés.
   *
   * Ojo con esto: el mínimo de Mercado Pago aplica al TOTAL de la compra, no
   * al producto. Acá se evalúa contra el precio del producto solo, que es el
   * dato disponible cuando se fija el precio. Para un carrito de varios
   * productos que juntos superen el mínimo, el costo real puede ser mayor que
   * el calculado.
   */
  const escalonDe = (precio: number): EscalonCuotas | null =>
    [...cfg.escalones_cuotas]
      .sort((a, b) => a.desde - b.desde)
      .reduce<EscalonCuotas | null>((alcanzado, e) => (precio >= e.desde ? e : alcanzado), null);

  const comisionDe = (precio: number) =>
    cfg.comision_cobro + (escalonDe(precio)?.costo ?? 0);

  // El envío depende del precio y el precio del envío. Con cinco umbrales, una
  // pasada no basta: se itera hasta que el precio deja de moverse.
  function precioParaMargen(margen: number): number {
    let p = (costoConIva * (1 + margen)) / (1 - cfg.comision_cobro);
    for (let i = 0; i < 8; i++) {
      const siguiente = (costoConIva * (1 + margen) + envioDe(p)) / (1 - comisionDe(p));
      if (Math.abs(siguiente - p) < 1) break;
      p = siguiente;
    }
    return p;
  }

  const margenDe = (precio: number) =>
    (precio * (1 - comisionDe(precio)) - envioDe(precio) - costoConIva) / costoConIva;

  const piso = precioParaMargen(cfg.margen_min);
  const objetivo = precioParaMargen(cfg.margen_objetivo);
  const margenActual = margenDe(producto.precio);
  const vendio = unidadesVendidas >= cfg.ventas_minimas;

  let precioNuevo: number;
  let nota: string;

  if (margenActual < cfg.margen_min) {
    // Al piso y no al objetivo: es lo mínimo para no perder plata, y subir de
    // más arriesga la venta de algo que quizás ya se estaba vendiendo.
    precioNuevo = aCentena(piso);
    nota = `Deja ${(margenActual * 100).toFixed(0)}%, por debajo del piso: se sube al mínimo`;
  } else if (vendio) {
    // Vende y deja margen: el precio ya está validado por el mercado.
    precioNuevo = producto.precio;
    nota = `Vendió ${unidadesVendidas} unidad(es) en ${cfg.dias_ventana_ventas} días y deja ${(margenActual * 100).toFixed(0)}%: no se toca`;
  } else if (margenActual > cfg.margen_objetivo) {
    precioNuevo = aCentena(objetivo);
    nota = `Sin ventas y con ${(margenActual * 100).toFixed(0)}%: se baja al objetivo`;
  } else {
    precioNuevo = producto.precio;
    nota = "El margen está dentro del rango";
  }

  /**
   * Cada escalón de cuotas es un acantilado: cruzarlo suma su costo de golpe
   * (7,79, 10,49 o 18,69 puntos). Cuando el precio cae apenas por encima de
   * uno, conviene quedarse abajo — lo mismo que pasa con los umbrales de envío.
   */
  const escalonActual = escalonDe(precioNuevo);
  if (escalonActual) {
    const justoDebajo = Math.floor((escalonActual.desde - 1) / 100) * 100;
    const ganancia = (p: number) => p * (1 - comisionDe(p)) - envioDe(p) - costoConIva;
    if (ganancia(justoDebajo) > ganancia(precioNuevo) && margenDe(justoDebajo) >= cfg.margen_min) {
      precioNuevo = justoDebajo;
      nota += `. Se queda bajo los ${escalonActual.desde.toLocaleString("es-AR")} de las ${escalonActual.cuotas} cuotas sin interés: cruzarlo cuesta ${(escalonActual.costo * 100).toFixed(2)} puntos`;
    }
  }

  // Cambiar el precio por dos pesos no aporta y ensucia el historial. Pero la
  // tolerancia no puede tapar un margen por debajo del piso: ahí se corrige
  // aunque el ajuste sea chico, que es justamente el caso de los productos que
  // quedaron a uno o dos puntos del mínimo.
  const cambio = Math.abs(precioNuevo - producto.precio) / producto.precio;
  const bajoPiso = margenActual < cfg.margen_min;
  const cambia = cambio > 0 && (bajoPiso || cambio >= cfg.tolerancia);
  if (!cambia) precioNuevo = producto.precio;

  return {
    id: producto.id,
    sku: producto.sku,
    nombre: producto.nombre,
    costo_con_iva: costoConIva,
    precio_actual: producto.precio,
    precio_nuevo: precioNuevo,
    margen_actual_pct: redondear1(margenActual),
    margen_nuevo_pct: redondear1(margenDe(precioNuevo)),
    comision_monto: Math.round(precioNuevo * comisionDe(precioNuevo)),
    comision_pct: redondear1(comisionDe(precioNuevo)),
    costo_envio: envioDe(precioNuevo),
    ganancia: Math.round(
      precioNuevo * (1 - comisionDe(precioNuevo)) - envioDe(precioNuevo) - costoConIva,
    ),
    unidades_vendidas: unidadesVendidas,
    cambia,
    direccion:
      precioNuevo > producto.precio ? "sube" : precioNuevo < producto.precio ? "baja" : "igual",
    nota,
  };
}
