/**
 * El envío gratis como gancho de venta, no como letra chica.
 *
 * La tienda tenía un umbral por zona —CABA, AMBA, interior— y los mostraba los
 * tres juntos: "Envío gratis en CABA desde $61.000 · AMBA desde $61.000 ·
 * Interior del país desde $61.000". Tres números iguales ocupando dos renglones
 * para decir una sola cosa. Peor: obligan al que lee a averiguar en qué zona
 * está antes de entender si le conviene.
 *
 * Ahora es un solo número para todo el país. Los umbrales por zona siguen
 * existiendo en la configuración del checkout —ahí se cobra de verdad— pero de
 * cara al cliente hay uno solo, y es el más alto de los tres: prometer el más
 * bajo sería prometer algo que después la caja no cumple.
 */

/**
 * Cuánto puede faltar para que valga la pena decirlo.
 *
 * "Sumá $2.000 y tenés envío gratis" mueve una compra. "Sumá $48.000" no: le
 * recuerda al que está mirando un producto de $13.000 que está lejísimos, y lo
 * que era un beneficio pasa a ser una barrera. Debajo de este umbral relativo
 * se muestra el número del envío gratis a secas, sin la cuenta.
 *
 * 35% del umbral: con el envío gratis en $61.000, el empujón aparece a partir
 * de los $39.650 de carrito.
 */
export const CERCA_DEL_UMBRAL = 0.35

export type EstadoEnvioGratis =
  /** Ya lo tiene: se anuncia y listo. */
  | { estado: 'gratis'; falta: 0; umbral: number }
  /** Le falta poco: conviene decirle cuánto. */
  | { estado: 'cerca'; falta: number; umbral: number }
  /** Le falta mucho: se menciona el beneficio sin la cuenta. */
  | { estado: 'lejos'; falta: number; umbral: number }

/**
 * El umbral que se le promete al cliente: el más alto de los que cobra la caja.
 *
 * Si algún día vuelven a diferir por zona, esto sigue siendo verdad para todos:
 * "desde X hay envío gratis" se cumple en cualquier provincia.
 */
export function umbralEnvioGratis(
  cfg: Record<string, string | undefined>,
  porDefecto = 61_000,
): number {
  const valores = [
    cfg.envio_gratis_interior_desde,
    cfg.envio_gratis_bsas_desde,
    cfg.envio_gratis_amba_desde,
    cfg.envio_gratis_gba_desde,
    cfg.envio_gratis_caba_desde,
  ]
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0)

  return valores.length ? Math.max(...valores) : porDefecto
}

/** En qué punto está este monto respecto del envío gratis. */
export function estadoEnvioGratis(
  monto: number,
  umbral: number,
  cerca = CERCA_DEL_UMBRAL,
): EstadoEnvioGratis {
  if (!(umbral > 0)) return { estado: 'lejos', falta: 0, umbral }
  if (monto >= umbral) return { estado: 'gratis', falta: 0, umbral }
  const falta = Math.ceil(umbral - monto)
  return {
    estado: falta <= umbral * cerca ? 'cerca' : 'lejos',
    falta,
    umbral,
  }
}
