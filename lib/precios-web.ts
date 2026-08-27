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
 * La tarifa por cercanía no es un precio: es una fórmula. Se cobra una base
 * más un monto por kilómetro de manejo, hasta un radio máximo; más lejos de
 * ese radio el pedido cae a la tarifa plana de la zona.
 *
 * Guardarla como fórmula y no como un número suelto es lo que permite costear
 * con la distancia que se despacha de verdad en vez de asumir siempre el
 * extremo del radio, que es el envío más caro que la tienda llega a aceptar y
 * casi nunca el que sale.
 */
export type TarifaKm = {
  base: number;
  por_km: number;
  radio_max: number;
  gratis_desde: number;
};

/** Lo que sale un envío por cercanía a esa distancia, con el radio como tope. */
export function costoKmDe(t: TarifaKm, km: number): number {
  const efectivo = Math.min(Math.max(km, 0), t.radio_max);
  // Mismo redondeo a $100 que aplica lib/envio.ts al cobrarlo.
  return Math.round((t.base + t.por_km * efectivo) / 100) * 100;
}

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
  // Valores de respaldo. En producción se arman desde la configuración real
  // de la tienda con costeoDesdeConfig().
  zonas: [
    { nombre: "Cercanía (CABA/AMBA)", costo: 14000, gratis_desde: 45000 },
    { nombre: "Buenos Aires", costo: 30000, gratis_desde: 130000 },
    { nombre: "Interior", costo: 40000, gratis_desde: 175000 },
  ],
  tolerancia: 0.03,
};

/**
 * Percentil de una lista de números (0..1). Con lista vacía devuelve null.
 */
function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.ceil(p * orden.length) - 1);
  return orden[Math.max(0, i)];
}

/** Muestras mínimas para creerle al historial en vez del peor caso teórico. */
export const MUESTRAS_KM_MINIMAS = 8;

export type CosteoEnvio = {
  zonas: ZonaEnvio[];
  tarifa_km: TarifaKm | null;
  /** Distancia con la que se costeó el envío por cercanía. */
  km_costeo: number | null;
  /** De dónde salió esa distancia, para poder auditar el precio. */
  fuente_km: "radio máximo" | "historial de envíos" | "configurado a mano" | "sin cercanía";
  muestras_km: number;
};

/**
 * Arma el costeo de envío desde la configuración real de la tienda.
 *
 * Las zonas lejanas tienen tarifa plana y se usan tal cual. CABA y AMBA no:
 * ahí se cobra por distancia, y esa parte variable es la que hay que estimar.
 *
 * Cómo se elige la distancia de costeo, en orden:
 *
 *   1. `envio_km_costeo` si está seteado a mano en la configuración.
 *   2. El percentil 90 de los envíos por cercanía ya despachados, si hay al
 *      menos MUESTRAS_KM_MINIMAS. Cubre 9 de cada 10 pedidos reales.
 *   3. El radio máximo. Es el peor caso y sube el precio de todo lo que pasa
 *      el umbral, pero sin historial es lo único defendible.
 *
 * El paso 2 es el que importa: el local está en Chacarita y casi ningún envío
 * de CABA llega a los 20 km del radio, así que costear siempre en el extremo
 * infla los precios contra un envío que rara vez sale.
 */
export function costeoDesdeConfig(
  cfg: Record<string, string | undefined>,
  kmObservados: number[] = [],
): CosteoEnvio {
  const num = (v: string | undefined, def = 0) => Number(v) || def;
  const zonas: ZonaEnvio[] = [];

  let tarifaKm: TarifaKm | null = null;
  let kmCosteo: number | null = null;
  let fuente: CosteoEnvio["fuente_km"] = "sin cercanía";

  if (cfg.envio_km_activo === "1") {
    tarifaKm = {
      base: num(cfg.envio_km_base),
      por_km: num(cfg.envio_km_por_km),
      radio_max: num(cfg.envio_km_radio_max, 20),
      gratis_desde: num(cfg.envio_km_gratis_desde, 45000),
    };

    const manual = Number(cfg.envio_km_costeo);
    const p90 = percentil(kmObservados, 0.9);

    if (manual > 0) {
      kmCosteo = Math.min(manual, tarifaKm.radio_max);
      fuente = "configurado a mano";
    } else if (p90 != null && kmObservados.length >= MUESTRAS_KM_MINIMAS) {
      kmCosteo = Math.min(p90, tarifaKm.radio_max);
      fuente = "historial de envíos";
    } else {
      kmCosteo = tarifaKm.radio_max;
      fuente = "radio máximo";
    }

    zonas.push({
      nombre: `Cercanía (costeado a ${kmCosteo.toFixed(1)} km)`,
      costo: costoKmDe(tarifaKm, kmCosteo),
      gratis_desde: tarifaKm.gratis_desde,
    });
  }

  /**
   * Las cuatro zonas de tarifa plana que realmente cobra lib/envio.ts.
   *
   * CABA y AMBA quedan igual aunque la cercanía esté activa: son el respaldo
   * cuando la dirección no se puede ubicar o cae fuera del radio, y en AMBA
   * la tarifa plana es más cara que cualquier envío por km, así que manda ella.
   *
   * Ojo: acá NO va ninguna zona "GBA". `envio_precio_gba` es un valor viejo de
   * cuando toda la provincia era una sola zona; hoy sólo sobrevive como
   * fallback de AMBA y Resto BA, que ya tienen su propia tarifa. Tratarlo como
   * zona propia inventaba un escalón de $15.000 que nadie cobra.
   */
  zonas.push(
    {
      nombre: "CABA (tarifa de respaldo)",
      costo: num(cfg.envio_precio_caba, 8000),
      gratis_desde: num(cfg.envio_gratis_caba_desde, 45000),
    },
    {
      nombre: "AMBA",
      costo: num(cfg.envio_precio_amba ?? cfg.envio_precio_gba, 20000),
      gratis_desde: num(cfg.envio_gratis_amba_desde ?? cfg.envio_gratis_gba_desde, 90000),
    },
    {
      nombre: "Provincia de Buenos Aires",
      costo: num(cfg.envio_precio_bsas ?? cfg.envio_precio_gba, 30000),
      gratis_desde: num(cfg.envio_gratis_bsas_desde ?? cfg.envio_gratis_gba_desde, 130000),
    },
    {
      nombre: "Interior",
      costo: num(cfg.envio_precio_interior, 40000),
      gratis_desde: num(cfg.envio_gratis_interior_desde, 175000),
    },
  );

  // Sin duplicados: si dos zonas cuestan lo mismo desde el mismo monto, una
  // sola alcanza para el costeo.
  const vistas = new Set<string>();
  const unicas = zonas.filter((z) => {
    const clave = `${z.costo}::${z.gratis_desde}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });

  return {
    zonas: unicas,
    tarifa_km: tarifaKm,
    km_costeo: kmCosteo,
    fuente_km: fuente,
    muestras_km: kmObservados.length,
  };
}

/** Atajo cuando sólo hacen falta las zonas. */
export function zonasDesdeConfig(
  cfg: Record<string, string | undefined>,
  kmObservados: number[] = [],
): ZonaEnvio[] {
  return costeoDesdeConfig(cfg, kmObservados).zonas;
}

/**
 * Escalones de cuotas sin interés desde la configuración.
 *
 * Los mínimos se editan en el panel de admin (`cuotas_sin_interes`) y tienen
 * que coincidir con los de Mercado Pago. El costo de cada plan no está en ese
 * JSON, así que se toma del escalón equivalente en la config de precios.
 */
export function escalonesDesdeConfig(
  cfg: Record<string, string | undefined>,
  base: EscalonCuotas[] = CONFIG_WEB_DEFAULT.escalones_cuotas,
): EscalonCuotas[] {
  try {
    const planes = JSON.parse(cfg.cuotas_sin_interes ?? "[]") as { cuotas: number; min: number }[];
    if (!Array.isArray(planes) || planes.length === 0) return base;
    return planes
      .map((p) => {
        const conocido = base.find((e) => e.cuotas === Number(p.cuotas));
        // Un plan nuevo sin costo conocido se ignora: costear en 0 sería peor
        // que no verlo, porque daría un margen inflado.
        if (!conocido) return null;
        return { ...conocido, desde: Number(p.min) || conocido.desde };
      })
      .filter((e): e is EscalonCuotas => e !== null)
      .sort((a, b) => a.desde - b.desde);
  } catch {
    return base;
  }
}

/**
 * Cuánto le cuesta el envío a la tienda a ese precio, tomando la zona más cara
 * entre las que ya cruzaron su umbral de envío gratis.
 *
 * Cada zona tiene su propio umbral: a $50.000 el envío ya es gratis para
 * cercanía (y lo paga la tienda) pero el cliente del interior todavía lo paga.
 * Mirar la peor zona alcanzada hace que el margen mínimo se cumpla vendas a
 * donde vendas, sin saber de antemano a qué dirección va el paquete.
 *
 * Es deliberadamente conservador: mientras no haya historial para ponderar por
 * zona real, cobra de más antes que de menos.
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

export type SugerenciaUmbral = {
  tipo: "envio" | "cuotas";
  nombre: string;
  umbral_actual: number;
  umbral_sugerido: number;
  productos_afectados: number;
  plata_en_juego: number;
  detalle: string;
};

/**
 * ¿Conviene mover los umbrales de envío gratis o de cuotas sin interés?
 *
 * Cada umbral crea una zona muerta justo por encima: un producto a $46.000
 * cruza los $45.000 de envío gratis y la tienda paga el envío entero, con lo
 * que termina dejando menos que uno de $44.000. Cuando hay varios productos
 * ahí arriba, subir el umbral recupera esa plata sin tocar ningún precio.
 *
 * El umbral sugerido deja fuera a todos los afectados: se pone justo por
 * encima del más caro del grupo.
 */
export function recomendarUmbrales(
  precios: number[],
  cfg: ConfigPreciosWeb = CONFIG_WEB_DEFAULT,
): SugerenciaUmbral[] {
  const sugerencias: SugerenciaUmbral[] = [];
  // Hasta acá el costo de cruzar todavía no se compensó con el precio de más.
  const ANCHO_ZONA_MUERTA = 1.35;

  for (const zona of cfg.zonas) {
    const afectados = precios.filter(
      (p) => p >= zona.gratis_desde && p < zona.gratis_desde * ANCHO_ZONA_MUERTA,
    );
    if (afectados.length === 0) continue;

    const masCaro = Math.max(...afectados);
    sugerencias.push({
      tipo: "envio",
      nombre: zona.nombre,
      umbral_actual: zona.gratis_desde,
      umbral_sugerido: Math.ceil((masCaro + 1000) / 1000) * 1000,
      productos_afectados: afectados.length,
      // Suma del envío de todos los afectados: lo que costaría vender uno de
      // cada uno. Sirve para ordenar por dónde hay más plata en juego.
      plata_en_juego: afectados.length * zona.costo,
      detalle:
        `${afectados.length} producto(s) entre ${zona.gratis_desde.toLocaleString("es-AR")} y ` +
        `${Math.round(masCaro).toLocaleString("es-AR")} activan el envío gratis de ${zona.nombre} ` +
        `y la tienda paga ${zona.costo.toLocaleString("es-AR")} en cada venta`,
    });
  }

  for (const escalon of cfg.escalones_cuotas) {
    const afectados = precios.filter(
      (p) => p >= escalon.desde && p < escalon.desde * ANCHO_ZONA_MUERTA,
    );
    if (afectados.length === 0) continue;

    const masCaro = Math.max(...afectados);
    const costoPromedio = afectados.reduce((suma, p) => suma + p * escalon.costo, 0);
    sugerencias.push({
      tipo: "cuotas",
      nombre: `${escalon.cuotas} cuotas sin interés`,
      umbral_actual: escalon.desde,
      umbral_sugerido: Math.ceil((masCaro + 1000) / 1000) * 1000,
      productos_afectados: afectados.length,
      plata_en_juego: Math.round(costoPromedio),
      detalle:
        `${afectados.length} producto(s) entre ${escalon.desde.toLocaleString("es-AR")} y ` +
        `${Math.round(masCaro).toLocaleString("es-AR")} habilitan ${escalon.cuotas} cuotas ` +
        `y cuestan ${(escalon.costo * 100).toFixed(2)}% extra por venta`,
    });
  }

  // Primero donde hay más plata en juego.
  return sugerencias.sort((a, b) => b.plata_en_juego - a.plata_en_juego);
}
