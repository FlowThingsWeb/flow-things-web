/**
 * Lógica de cálculo de envío (compartida entre /api/envio/cotizar y /api/checkout).
 * Centralizar aquí evita que la lógica de precios se duplique.
 */
import { getConfig } from '@/lib/config'
import { distanciaManejoKm, geocodificar, type UbicacionGeo } from '@/lib/google-maps'

export type ZonaEnvio = 'caba' | 'amba' | 'bsas' | 'interior'

/**
 * Partidos del AMBA (1er y 2do cordón del conurbano bonaerense) con sus rangos
 * de código postal de 4 dígitos. Se usa para separar el conurbano del resto de
 * la provincia de Buenos Aires.
 *
 * ⚠️ La Plata queda EXCLUIDA a propósito (Gran La Plata / 3er cordón) → cae en
 * "Resto de Buenos Aires". Para incluir o sacar un partido, editá esta lista.
 */
const AMBA_PARTIDOS: { partido: string; cordon: 1 | 2; cp: [number, number] }[] = [
  // ── 1er cordón ──
  { partido: 'Vicente López',       cordon: 1, cp: [1602, 1609] },
  { partido: 'San Isidro',          cordon: 1, cp: [1607, 1646] },
  { partido: 'General San Martín',  cordon: 1, cp: [1650, 1655] },
  { partido: 'Tres de Febrero',     cordon: 1, cp: [1670, 1688] },
  { partido: 'Morón',               cordon: 1, cp: [1704, 1708] },
  { partido: 'Hurlingham',          cordon: 1, cp: [1686, 1688] },
  { partido: 'Ituzaingó',           cordon: 1, cp: [1712, 1714] },
  { partido: 'La Matanza',          cordon: 1, cp: [1751, 1778] },
  { partido: 'Lanús',               cordon: 1, cp: [1822, 1832] },
  { partido: 'Lomas de Zamora',     cordon: 1, cp: [1828, 1838] },
  { partido: 'Avellaneda',          cordon: 1, cp: [1868, 1876] },
  // ── 2do cordón ──
  { partido: 'Tigre',               cordon: 2, cp: [1617, 1649] },
  { partido: 'San Fernando',        cordon: 2, cp: [1646, 1649] },
  { partido: 'Malvinas Argentinas', cordon: 2, cp: [1610, 1620] },
  { partido: 'José C. Paz',         cordon: 2, cp: [1665, 1667] },
  { partido: 'San Miguel',          cordon: 2, cp: [1661, 1667] },
  { partido: 'Moreno',              cordon: 2, cp: [1740, 1744] },
  { partido: 'Merlo',               cordon: 2, cp: [1722, 1730] },
  { partido: 'Ezeiza',              cordon: 2, cp: [1802, 1809] },
  { partido: 'Esteban Echeverría',  cordon: 2, cp: [1842, 1842] },
  { partido: 'Almirante Brown',     cordon: 2, cp: [1846, 1852] },
  { partido: 'Quilmes',             cordon: 2, cp: [1878, 1889] },
  { partido: 'Berazategui',         cordon: 2, cp: [1880, 1894] },
  { partido: 'Florencio Varela',    cordon: 2, cp: [1888, 1896] },
]

/** Extrae los 4 dígitos del CP, soportando formato viejo (1878) y CPA (B1878ABC). */
function parseCP(cp?: string | null): number | null {
  if (!cp) return null
  const m = String(cp).match(/\d{4}/)
  return m ? Number(m[0]) : null
}

/** True si el CP pertenece a algún partido del AMBA (1er/2do cordón). */
export function esAMBA(codigoPostal?: string | null): boolean {
  const n = parseCP(codigoPostal)
  if (n === null) return false
  return AMBA_PARTIDOS.some(({ cp }) => n >= cp[0] && n <= cp[1])
}

/**
 * Determina la zona de envío a partir de la provincia y el código postal.
 * - CABA → caba
 * - Buenos Aires + CP del conurbano (1er/2do cordón) → amba
 * - Buenos Aires + resto → bsas
 * - Otras provincias → interior
 *
 * Si viene provincia Buenos Aires sin CP identificable, cae en 'bsas' (resto)
 * para no aplicar por error la tarifa AMBA.
 */
export function getZonaEnvio(provincia: string, codigoPostal?: string | null): ZonaEnvio {
  if (provincia === 'CABA') return 'caba'
  if (provincia === 'Buenos Aires') return esAMBA(codigoPostal) ? 'amba' : 'bsas'
  return 'interior'
}

/** Sin acentos, minúsculas, sin ruido: para comparar nombres de lugares. */
function normalizar(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bpartido de\b|\bciudad de\b|\bcdad\.?\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const esCABA = (provincia: string | null) => normalizar(provincia).includes('autonoma')
const esProvinciaBA = (provincia: string | null) => {
  const n = normalizar(provincia)
  return n.includes('buenos aires') && !n.includes('autonoma')
}

/**
 * ¿La dirección que resolvió Google es la que declaró el comprador?
 *
 * Distance Matrix acepta texto libre y resuelve lo más parecido que encuentra,
 * sin avisar. En el conurbano eso es una trampa: media docena de calles se
 * llaman igual en todos los partidos, así que "Av. San Martín 2000, Florencio
 * Varela" resolvía a la Av. San Martín de CABA y cotizaba un envío de 35 km
 * como si fuera de 3, con la tienda comiéndose la diferencia.
 *
 * Se rechaza —y se cae a la tarifa plana de la zona, que es la conservadora—
 * cuando hay evidencia de que resolvió otro lugar:
 *
 *   1. Provincia distinta. Es el caso grave: CABA y provincia son
 *      jurisdicciones separadas y confundirlas cambia la tarifa entera.
 *   2. `partial_match`: Google mismo avisa que no pudo matchear la dirección.
 *   3. Código postal distinto Y nombre de localidad que tampoco coincide. Dos
 *      señales independientes en contra; una sola puede ser un CP mal tipeado
 *      o una diferencia de nomenclatura, y no alcanza para cobrar de más.
 *
 * Al revés no se rechaza: si falta el dato no se asume lo peor, porque una
 * validación demasiado estricta le cobra tarifa plana a un cliente de CABA que
 * tenía la dirección bien.
 */
export function ubicacionCoincide(
  geo: UbicacionGeo,
  declarado: { provincia: string; localidad?: string | null; codigoPostal?: string | null },
): { ok: true } | { ok: false; motivo: string } {
  const esperaCABA = declarado.provincia === 'CABA'
  const esperaBA = declarado.provincia === 'Buenos Aires'

  if (esperaCABA && !esCABA(geo.provincia)) {
    return { ok: false, motivo: `declaró CABA y resolvió "${geo.provincia}"` }
  }
  if (esperaBA && !esProvinciaBA(geo.provincia)) {
    return { ok: false, motivo: `declaró Buenos Aires y resolvió "${geo.provincia}"` }
  }
  if (geo.parcial) {
    return { ok: false, motivo: 'Google marcó la dirección como coincidencia parcial' }
  }

  const cpDeclarado = parseCP(declarado.codigoPostal)
  const cpResuelto = parseCP(geo.codigo_postal)
  if (cpDeclarado !== null && cpResuelto !== null && cpDeclarado !== cpResuelto) {
    const dicho = normalizar(declarado.localidad)
    const candidatos = [geo.localidad, geo.partido].map(normalizar).filter(Boolean)
    const coincideNombre =
      dicho.length > 2 && candidatos.some((c) => c.includes(dicho) || dicho.includes(c))
    if (!coincideNombre) {
      return {
        ok: false,
        motivo: `CP ${cpDeclarado} vs ${cpResuelto} y localidad "${declarado.localidad ?? ''}" vs "${geo.localidad ?? geo.partido ?? ''}"`,
      }
    }
  }

  return { ok: true }
}

export interface OpcionEnvio {
  id: string
  nombre: string
  /** Lo que paga el cliente. Es 0 cuando el pedido superó el umbral. */
  precio: number
  /**
   * Lo que le cuesta el envío a la tienda, pague o no el cliente. Cuando el
   * envío es gratis, `precio` es 0 pero esto no: es la plata que sale del
   * margen. Es el número que necesita el pricing, y el único que se puede
   * comparar contra lo que el modelo de costeo asume.
   */
  costo_tienda: number
  /**
   * Kilómetros de manejo hasta el destino, sólo cuando se cobró por cercanía.
   * `null` con tarifa plana. Guardarlo es lo que permite reemplazar el peor
   * caso teórico del costeo por la distancia que se despacha de verdad.
   */
  km: number | null
  tiempo_estimado: string
  descripcion: string | null
}

/**
 * Calcula el costo de envío server-side a partir de la provincia, el subtotal y
 * el código postal (necesario para distinguir AMBA del resto de Buenos Aires).
 * Retorna `null` si la provincia no se puede determinar.
 */
export async function calcularEnvio(
  provincia: string | null | undefined,
  subtotal: number,
  codigoPostal?: string | null,
  destino?: { direccion?: string | null; localidad?: string | null }
): Promise<OpcionEnvio | null> {
  if (!provincia) return null

  const cfg = await getConfig()
  const zona = getZonaEnvio(provincia, codigoPostal)

  // Compat: el valor viejo 'gba' (cuando toda la provincia era una sola zona)
  // se usa como fallback para AMBA y Resto BA hasta que se configuren aparte.
  const num = (v: string | undefined, def: number) => Number(v) || def

  // ── Envío por cercanía (km): reemplaza CABA/AMBA cuando está activo ──
  // Si falla (sin key, dirección no ubicable, resuelta en otra jurisdicción, o
  // fuera de radio) cae a la tarifa plana de la zona (el bloque de abajo).
  if (
    (zona === 'caba' || zona === 'amba') &&
    cfg.envio_km_activo === '1' &&
    cfg.envio_km_origen?.trim() &&
    destino?.direccion?.trim()
  ) {
    const destinoStr = [destino.direccion, destino.localidad, provincia, codigoPostal, 'Argentina']
      .filter((s) => s && String(s).trim())
      .join(', ')

    // Geocodificar primero y recién después medir: así se puede verificar que
    // Google resolvió la jurisdicción declarada antes de creerle la distancia,
    // y la medición sale contra coordenadas exactas en vez de texto ambiguo.
    const geo = await geocodificar(destinoStr)
    const veredicto = geo
      ? ubicacionCoincide(geo, { provincia, localidad: destino.localidad, codigoPostal })
      : null

    if (geo && veredicto && !veredicto.ok) {
      // Cae a tarifa plana, que es la conservadora: cobrar de menos por una
      // dirección mal resuelta lo paga la tienda entero.
      console.warn('[envio] geocodificación descartada:', veredicto.motivo, '—', destinoStr)
    }

    const km =
      geo && veredicto?.ok
        ? await distanciaManejoKm(cfg.envio_km_origen, `${geo.lat},${geo.lng}`)
        : null

    if (km != null) {
      const radioMax = num(cfg.envio_km_radio_max, 0)
      if (radioMax <= 0 || km <= radioMax) {
        const base = num(cfg.envio_km_base, 0)
        const porKm = num(cfg.envio_km_por_km, 0)
        const gratisDesde = num(cfg.envio_km_gratis_desde, 0)
        const esGratis = subtotal > 0 && gratisDesde > 0 && subtotal >= gratisDesde
        // Redondeo a $100 para precios prolijos.
        const bruto = base + porKm * km
        const costoTienda = Math.round(bruto / 100) * 100
        const precio = esGratis ? 0 : costoTienda
        return {
          id: 'cercania',
          nombre: cfg.envio_km_nombre || 'Envío a domicilio',
          precio,
          costo_tienda: costoTienda,
          km,
          tiempo_estimado: cfg.envio_km_tiempo || '',
          descripcion: esGratis
            ? '¡Envío gratis por superar el mínimo!'
            : `A ${km.toFixed(1)} km de nuestro local`,
        }
      }
      // fuera de radio → sigue a tarifa plana
    }
    // km no calculable → sigue a tarifa plana
  }

  const zonas: Record<ZonaEnvio, { precio: number; gratis_desde: number; tiempo: string; nombre: string; id: string }> = {
    caba: {
      precio:       num(cfg.envio_precio_caba, 2500),
      gratis_desde: num(cfg.envio_gratis_caba_desde, 40000),
      tiempo:       cfg.envio_tiempo_caba || '24-48 hs hábiles',
      nombre:       'Envío a CABA',
      id:           'caba',
    },
    amba: {
      precio:       num(cfg.envio_precio_amba ?? cfg.envio_precio_gba, 3500),
      gratis_desde: num(cfg.envio_gratis_amba_desde ?? cfg.envio_gratis_gba_desde, 60000),
      tiempo:       cfg.envio_tiempo_amba || cfg.envio_tiempo_gba || '48-72 hs hábiles',
      nombre:       'Envío AMBA (Gran Buenos Aires)',
      id:           'amba',
    },
    bsas: {
      precio:       num(cfg.envio_precio_bsas ?? cfg.envio_precio_gba, 5000),
      gratis_desde: num(cfg.envio_gratis_bsas_desde ?? cfg.envio_gratis_gba_desde, 90000),
      tiempo:       cfg.envio_tiempo_bsas || '3-5 días hábiles',
      nombre:       'Envío Provincia de Buenos Aires',
      id:           'bsas',
    },
    interior: {
      precio:       num(cfg.envio_precio_interior, 6000),
      gratis_desde: num(cfg.envio_gratis_interior_desde, 120000),
      tiempo:       cfg.envio_tiempo_interior || '3-7 días hábiles',
      nombre:       'Envío al interior del país',
      id:           'interior',
    },
  }

  const opcion = zonas[zona]
  const esGratis = subtotal > 0 && opcion.gratis_desde > 0 && subtotal >= opcion.gratis_desde
  const precioFinal = esGratis ? 0 : opcion.precio

  return {
    id:              opcion.id,
    nombre:          opcion.nombre,
    precio:          precioFinal,
    costo_tienda:    opcion.precio,
    km:              null,
    tiempo_estimado: opcion.tiempo,
    descripcion:     esGratis ? '¡Envío gratis por superar el mínimo!' : null,
  }
}
