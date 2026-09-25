'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PROVINCIAS } from '@/lib/format'
import { formatPrecio } from '@/lib/format'
import { leerDestino, guardarDestino } from '@/lib/destino-envio'

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
 * Dónde se cobra por distancia y no por zona.
 *
 * En CABA el envío se cotiza contra los kilómetros reales desde el local
 * (base + $/km), y eso casi siempre sale menos que la tarifa plana de la
 * zona: a 8,4 km son $7.000 contra los $8.000 de la plana. Pero para medir
 * kilómetros hace falta una calle: con provincia y CP solos, la cotización
 * cae a la tarifa plana.
 *
 * Por eso la calle se pide sólo acá. En el resto del país la tarifa es por
 * zona y el dato no cambiaría el número: pedirlo sería un campo más a cambio
 * de nada.
 */
const PROVINCIAS_POR_DISTANCIA = ['CABA']

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
 *   - con el dato ya cargado se muestra en una línea ("A tu zona: $3.600 ·
 *     hasta 48hs"), con un "Cambiar" para corregirlo.
 *
 * La diferencia no es cosmética: para alguien en CABA el envío sale $3.600 y
 * llega en 48hs, cuatro veces menos que la tarifa del interior. Esa es una
 * razón para comprar, y estaba escondida atrás de un botón.
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

  const cotizar = useCallback(async (prov: string, codigo: string, direccion: string) => {
    if (!prov) return
    // La calle sólo entra si sirve para buscarla: a medio escribir daría una
    // distancia inventada, y es mejor la tarifa plana que un número falso.
    const dir = calleUtil(direccion) ? direccion.trim() : ''
    const clave = `${prov}|${codigo.trim()}|${dir}`
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
          ciudad: dir ? prov : undefined,
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
      setDestino([dir, codigo.trim(), prov, 'Argentina'].filter(Boolean).join(', '))
      guardarDestino({ provincia: prov, cp: codigo, direccion: dir })
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
    setEditando(false)
    cotizar(guardado.provincia, guardado.cp, guardado.direccion ?? '')
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
    const t = setTimeout(() => cotizar(provincia, cp, calle), 500)
    return () => clearTimeout(t)
  }, [provincia, cp, calle, editando, cotizar])

  const gratis = resultado?.precio === 0
  const pideCalle = PROVINCIAS_POR_DISTANCIA.includes(provincia)

  return (
    <div className="bg-brand-bg-soft rounded-2xl p-4">
      {/* ── Resultado en una línea (estado normal del visitante que vuelve) ── */}
      {resultado && !editando ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-brand-text">
              📦 Envío a{' '}
              <span className="font-semibold">
                {calleUtil(calle) ? calle.trim() : provincia}
              </span>
              {!calleUtil(calle) && cp.trim() && (
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
            La calle, sólo en CABA y sólo porque cambia el precio.

            Es el único lugar donde el envío se cobra por distancia, así que
            es el único donde el dato sirve para algo. El campo se explica
            solo y queda claro que es opcional: sin él igual hay un número,
            el de la tarifa plana.
          */}
          {pideCalle && (
            <input
              type="text"
              value={calle}
              onChange={(e) => setCalle(e.target.value)}
              placeholder="Calle y altura (ej: Av. Corrientes 1234)"
              aria-label="Calle y altura"
              autoComplete="street-address"
              className="input-dark text-sm w-full mt-2"
            />
          )}

          {/* El estado reemplaza al botón: se cotiza solo, esto cuenta qué pasa. */}
          <p className="text-xs text-brand-text-muted mt-2" aria-live="polite">
            {cargando
              ? 'Calculando…'
              : !provincia
              ? 'Elegí tu provincia y te decimos cuánto sale y cuándo llega.'
              : pideCalle && !calleUtil(calle)
              ? 'En CABA cobramos por distancia: poné tu calle y altura y te damos el precio exacto, que suele ser más barato.'
              : pideCalle
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
