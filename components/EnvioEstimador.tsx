'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PROVINCIAS } from '@/lib/format'
import { formatPrecio } from '@/lib/format'
import { leerDestino, guardarDestino } from '@/lib/destino-envio'
import { getZonaEnvio, seCobraPorDistancia } from '@/lib/zonas-envio'

interface Resultado {
  nombre: string
  precio: number
  tiempo_estimado: string
  descripcion?: string
}

/** Los CP argentinos son 4 dígitos; el CPA los trae adentro (B1878ABC). */
function cpValido(cp: string): boolean {
  return /\d{4}/.test(cp)
}

/**
 * ¿La calle alcanza para buscarla en el mapa?
 *
 * Se pide altura porque sin número Google resuelve el centro de la calle, y
 * una avenida de CABA mide 10 km de punta a punta.
 */
function calleUtil(calle: string): boolean {
  const c = calle.trim()
  return c.length >= 5 && /\d/.test(c)
}

/** La localidad alcanza cuando es un nombre y no una inicial suelta. */
function localidadUtil(localidad: string): boolean {
  return localidad.trim().length >= 3
}

type CampoFaltante = 'cp' | 'calle' | 'localidad'

/**
 * Qué datos le faltan al comprador para que le podamos dar el precio exacto.
 *
 * En CABA y el AMBA el envío se cobra por kilómetros desde el local y no por
 * tarifa plana, y casi siempre sale menos: en General San Martín son $8.400 a
 * 10,7 km contra los $15.000 de la tarifa AMBA. Pero medir kilómetros pide
 * una dirección, y cada zona pide algo distinto:
 *
 *   - CABA: alcanza la calle. La localidad es "CABA" y el servidor ni siquiera
 *     la valida, porque Google devuelve "Buenos Aires" para los 48 barrios.
 *   - AMBA: hace falta ADEMÁS el partido. Sin él Google resuelve las calles
 *     homónimas en CABA —media docena de avenidas se repiten en todos los
 *     partidos— y el servidor descarta la cotización por cambio de
 *     jurisdicción. Y antes del partido hace falta el CP: es lo que distingue
 *     el conurbano del resto de la provincia.
 *   - El resto del país: nada. La tarifa es por zona y ningún dato extra
 *     cambiaría el número, así que pedirlo sería un campo a cambio de nada.
 *
 * Todo lo que devuelve es opcional: sin completarlo igual hay un precio, el
 * de la tarifa plana. Lo que falta sólo significa "todavía podés pagar menos".
 */
function camposQueFaltan(
  provincia: string,
  cp: string,
  calle: string,
  localidad: string,
): { faltan: CampoFaltante[]; porDistancia: boolean; localidadExigida: boolean } {
  const zona = getZonaEnvio(provincia, cp)
  const porDistancia = seCobraPorDistancia(zona)
  const localidadExigida = zona === 'amba'

  // En provincia de Buenos Aires el CP es lo que decide si es AMBA. Sin CP la
  // zona da 'bsas' y no se cobra por distancia, así que se lo pide primero.
  if (provincia === 'Buenos Aires' && !cpValido(cp)) {
    return { faltan: ['cp'], porDistancia: false, localidadExigida: false }
  }
  if (!porDistancia) return { faltan: [], porDistancia, localidadExigida }

  const faltan: CampoFaltante[] = []
  if (!calleUtil(calle)) faltan.push('calle')
  if (localidadExigida && !localidadUtil(localidad)) faltan.push('localidad')
  return { faltan, porDistancia, localidadExigida }
}

/**
 * Cuánto sale el envío a tu casa, dicho antes de comprar y no después.
 *
 * Antes esto era un formulario: elegí provincia, escribí el CP, apretá
 * "Calcular". Tres gestos para un dato que decide la compra, repetidos en cada
 * producto, y arriba de todo el estimador quedaba DEBAJO del botón de agregar
 * al carrito — o sea, después del momento en que hace falta. El resultado es
 * que casi nadie lo usaba y el costo real aparecía recién en el checkout, con
 * el carrito ya armado y los datos personales ya cargados: el peor lugar
 * posible para una sorpresa de $15.000.
 *
 * Ahora:
 *   - el destino se recuerda entre productos y entre visitas (ver
 *     `lib/destino-envio`), así que se pregunta una vez y no una por ficha;
 *   - cotiza solo apenas hay provincia —y CP, si lo escribieron—, sin botón;
 *   - con el dato ya cargado se muestra en una línea ("Envío a CABA: $8.000 ·
 *     hasta 24hs"), con un "Cambiar" para corregirlo.
 *
 * La diferencia no es cosmética: para alguien en CABA el envío sale $7.000 y
 * llega en 48hs, la mitad que la tarifa del interior. Esa es una razón para
 * comprar, y estaba escondida atrás de un botón.
 *
 * En CABA y en el AMBA se cobra por kilómetros desde el local y no por zona,
 * y ahí el estimador pide la dirección — ver `camposQueFaltan` más abajo.
 *
 * Con `NEXT_PUBLIC_GOOGLE_MAPS_KEY` configurada muestra además el destino en
 * un mapa (Embed API: un iframe, sin librería ni JS de terceros). Si la clave
 * no está, el estimador funciona igual — el envío se cotiza contra nuestra
 * propia tabla de zonas, así que el mapa es confirmación visual, no parte del
 * cálculo.
 */
export default function EnvioEstimador({ precio }: { precio: number }) {
  const [provincia, setProvincia] = useState('')
  const [cp, setCp] = useState('')
  const [calle, setCalle] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState('')
  // Se congela al cotizar: si después tocan el select, el mapa no tiene que
  // saltar a otra provincia mientras sigue mostrando el precio viejo.
  const [destino, setDestino] = useState('')
  /** Form abierto: al entrar con un destino recordado arranca cerrado. */
  const [editando, setEditando] = useState(true)

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

  /**
   * Cada cotización lleva número. Las respuestas pueden llegar desordenadas
   * —se escribe el CP mientras vuelve la consulta anterior— y sin esto la
   * lenta pisaría a la nueva.
   */
  const pedido = useRef(0)
  /** Último destino ya cotizado: evita repetir la consulta por el mismo dato. */
  const ultimo = useRef('')

  const cotizar = useCallback(async (
    prov: string,
    codigo: string,
    direccion: string,
    loc: string,
  ) => {
    if (!prov) return
    /**
     * La dirección sólo se manda cuando está completa para la zona.
     *
     * Incompleta no sirve de nada y encima hace daño: en el AMBA, "Av. Ricardo
     * Balbín 2500, 1650, Buenos Aires" sin el partido lo resuelve en la Av.
     * Ricardo Balbín de CABA, el servidor detecta que cambió de jurisdicción y
     * cae a la tarifa plana igual — pero recién después de gastar una consulta
     * al geocodificador. Mejor no preguntar hasta poder preguntar bien.
     */
    const { faltan, localidadExigida } = camposQueFaltan(prov, codigo, direccion, loc)
    const completa = faltan.length === 0
    const dir = completa ? direccion.trim() : ''
    // En CABA la localidad es la provincia misma; en el AMBA es el partido.
    const ciudad = completa ? (localidadExigida ? loc.trim() : prov) : ''

    const clave = `${prov}|${codigo.trim()}|${dir}|${ciudad}`
    if (clave === ultimo.current) return
    ultimo.current = clave
    const nro = ++pedido.current
    setCargando(true); setError('')
    try {
      const r = await fetch('/api/envio/cotizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provincia: prov,
          codigo_postal: codigo,
          direccion: dir || undefined,
          ciudad: ciudad || undefined,
          subtotal: precio,
        }),
      })
      const d = await r.json()
      if (nro !== pedido.current) return
      if (!r.ok || d.error) { ultimo.current = ''; setError(d.error || 'No se pudo calcular.'); return }
      const op = d.opciones?.[0]
      if (!op) { ultimo.current = ''; setError('No hay envío disponible para esa zona.'); return }
      setResultado({
        nombre: op.nombre,
        precio: op.precio,
        tiempo_estimado: op.tiempo_estimado,
        descripcion: op.descripcion,
      })
      // Lo más preciso que haya: calle si la dieron, si no el CP, si no la
      // provincia sola.
      setDestino([dir, ciudad, codigo.trim(), prov, 'Argentina'].filter(Boolean).join(', '))
      guardarDestino({
        provincia: prov,
        cp: codigo,
        direccion: dir,
        localidad: localidadExigida ? ciudad : '',
      })
    } catch {
      ultimo.current = ''
      if (nro === pedido.current) setError('Error de conexión. Probá de nuevo.')
    } finally {
      if (nro === pedido.current) setCargando(false)
    }
  }, [precio])

  /** Destino recordado: se cotiza al entrar, sin pedir nada. */
  useEffect(() => {
    const guardado = leerDestino()
    if (!guardado) return
    setProvincia(guardado.provincia)
    setCp(guardado.cp)
    setCalle(guardado.direccion ?? '')
    setLocalidad(guardado.localidad ?? '')
    setEditando(false)
    cotizar(guardado.provincia, guardado.cp, guardado.direccion ?? '', guardado.localidad ?? '')
  }, [cotizar])

  /**
   * Cotiza sola mientras escriben.
   *
   * Espera medio segundo desde la última tecla para no disparar una consulta
   * por dígito del CP, y sólo cotiza con el CP completo o sin CP: "18" no es
   * un código postal a medio escribir que valga la pena preguntar.
   */
  useEffect(() => {
    if (!editando || !provincia) return
    if (cp.trim() && !cpValido(cp)) return
    const t = setTimeout(() => cotizar(provincia, cp, calle, localidad), 500)
    return () => clearTimeout(t)
  }, [provincia, cp, calle, localidad, editando, cotizar])

  const gratis = resultado?.precio === 0
  const { faltan, porDistancia, localidadExigida } = camposQueFaltan(provincia, cp, calle, localidad)
  /** La dirección que se mostró en el resultado, cuando la hubo. */
  const dirCompleta = porDistancia && faltan.length === 0

  return (
    <div className="bg-brand-bg-soft rounded-2xl p-4">
      {/* ── Resultado en una línea (estado normal del visitante que vuelve) ── */}
      {resultado && !editando ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-brand-text">
              📦 Envío a{' '}
              <span className="font-semibold">
                {dirCompleta
                  ? [calle.trim(), localidadExigida ? localidad.trim() : null]
                      .filter(Boolean)
                      .join(', ')
                  : provincia}
              </span>
              {!dirCompleta && cp.trim() && (
                <span className="text-brand-text-muted"> ({cp.trim()})</span>
              )}
              {': '}
              <span className={`font-bold ${gratis ? 'text-green-400' : 'text-brand-neon'}`}>
                {gratis ? '¡Gratis!' : formatPrecio(resultado.precio)}
              </span>
            </p>
            <p className="text-xs text-brand-text-muted truncate">
              {resultado.tiempo_estimado}
              {resultado.descripcion && ` · ${resultado.descripcion}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="text-xs font-semibold text-brand-purple hover:underline whitespace-nowrap flex-shrink-0"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold text-brand-text mb-3">📦 ¿Cuánto sale el envío a tu casa?</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              aria-label="Provincia"
              className="input-dark text-sm flex-1"
            >
              <option value="">Elegí tu provincia</option>
              {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              type="text"
              inputMode="numeric"
              value={cp}
              onChange={(e) => setCp(e.target.value)}
              placeholder="Código postal"
              aria-label="Código postal"
              className="input-dark text-sm sm:w-36"
            />
          </div>

          {/*
            La dirección, sólo donde cambia el precio: CABA y AMBA.

            Son las dos zonas donde el envío se cobra por kilómetros, así que
            son las dos donde el dato sirve para algo. En el AMBA hace falta
            además el partido, porque sin él Google resuelve la calle homónima
            de CABA. Los campos son opcionales: sin completarlos igual hay un
            número, el de la tarifa plana.
          */}
          {porDistancia && (
            <div className={`flex flex-col ${localidadExigida ? 'sm:flex-row' : ''} gap-2 mt-2`}>
              <input
                type="text"
                value={calle}
                onChange={(e) => setCalle(e.target.value)}
                placeholder="Calle y altura (ej: Av. Corrientes 1234)"
                aria-label="Calle y altura"
                autoComplete="street-address"
                className="input-dark text-sm flex-1"
              />
              {localidadExigida && (
                <input
                  type="text"
                  value={localidad}
                  onChange={(e) => setLocalidad(e.target.value)}
                  placeholder="Localidad o partido"
                  aria-label="Localidad o partido"
                  autoComplete="address-level2"
                  className="input-dark text-sm sm:w-48"
                />
              )}
            </div>
          )}

          {/* El estado reemplaza al botón: se cotiza solo, esto cuenta qué pasa. */}
          <p className="text-xs text-brand-text-muted mt-2" aria-live="polite">
            {cargando
              ? 'Calculando…'
              : !provincia
              ? 'Elegí tu provincia y te decimos cuánto sale y cuándo llega.'
              : faltan.includes('cp')
              ? 'Poné tu código postal: si estás en el AMBA cotizamos por distancia y suele salir menos.'
              : faltan.length > 0
              ? `En ${localidadExigida ? 'el AMBA' : 'CABA'} cobramos por distancia: ${
                  faltan.includes('calle') && faltan.includes('localidad')
                    ? 'poné tu calle, altura y partido'
                    : faltan.includes('calle')
                    ? 'poné tu calle y altura'
                    : 'poné tu localidad o partido'
                } y te damos el precio exacto, que suele ser más barato.`
              : porDistancia
              ? 'Listo: éste es el costo hasta tu puerta.'
              : !cp.trim()
              ? 'Agregá tu código postal para un cálculo más preciso.'
              : !cpValido(cp)
              ? 'Completá el código postal (4 dígitos) para el cálculo exacto.'
              : 'Listo: éste es el costo de envío a tu domicilio.'}
          </p>
        </>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

      {resultado && editando && !error && (
        <div className="mt-3 flex items-center justify-between bg-brand-bg-card border border-brand-border rounded-xl px-3 py-2.5">
          <div>
            <p className="text-sm text-brand-text">{resultado.nombre}</p>
            <p className="text-xs text-brand-text-muted">{resultado.tiempo_estimado}</p>
          </div>
          <span className={`text-sm font-bold ${gratis ? 'text-green-400' : 'text-brand-neon'}`}>
            {gratis ? '¡Gratis!' : formatPrecio(resultado.precio)}
          </span>
        </div>
      )}

      {resultado && editando && mapsKey && destino && (
        <div className="mt-3 overflow-hidden rounded-xl border border-brand-border">
          <iframe
            title={`Mapa de ${destino}`}
            src={`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${encodeURIComponent(destino)}&zoom=11`}
            className="w-full h-40 block border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}
