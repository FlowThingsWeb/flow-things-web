'use client'

/**
 * Buscador de dirección con autocompletado de Google Places + mapa con pin
 * arrastrable. Al elegir una dirección (o mover el pin) devuelve los campos
 * parseados por `onCambio`. El costo de envío igual se recalcula en el
 * servidor: esto es solo para cargar la dirección con comodidad.
 *
 * Requiere NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Si no está, no renderiza nada
 * (el carrito sigue funcionando con los campos manuales).
 *
 * Si Google rechaza la key —facturación caída, key vencida, dominio no
 * permitido— el componente se borra solo y avisa por `onFalla`. Ver
 * `marcarAuthFallida` abajo.
 */
import { useEffect, useRef, useState } from 'react'

export type DireccionParseada = {
  direccion: string
  ciudad: string
  provincia: string
  codigo_postal: string
  lat: number
  lng: number
}

// Provincias tal como las espera el <select> del carrito.
const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
]

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function normalizarProvincia(raw: string): string {
  const n = norm(raw)
  if (/ciudad autonoma|autonomous city|\bcaba\b|capital federal/.test(n)) return 'CABA'
  const limpio = raw.replace(/provincia de /i, '').replace(/ province$/i, '').trim()
  const match = PROVINCIAS.find((p) => norm(p) === norm(limpio))
  return match ?? limpio
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any

/**
 * Google rechazó la key.
 *
 * El script del mapa se baja igual con HTTP 200 aunque la key no sirva: el
 * rechazo llega después, y el único aviso es que la API llama a este global.
 * Sin esto el `catch` del componente nunca salta y al cliente le queda el
 * mapa muerto con el cartel de Google encima, justo en el paso de la
 * dirección. Pasó el 5/11/2026 con la facturación del proyecto cortada
 * (BillingNotEnabledMapError).
 *
 * Es module-level y no un estado de React porque Google avisa una sola vez
 * para toda la página, en cualquier momento después de cargar el script.
 */
let authFallo = false
const suscriptoresAuth = new Set<() => void>()

function marcarAuthFallida() {
  authFallo = true
  for (const avisar of suscriptoresAuth) avisar()
}

let scriptPromise: Promise<void> | null = null
function loadGoogle(key: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).google?.maps?.places) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    // Tiene que quedar puesto antes de que el script arranque: la API lo
    // busca con este nombre exacto y no acepta otra forma de enterarse.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).gm_authFailure = marcarAuthFallida
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&language=es&region=AR`
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('No se pudo cargar Google Maps'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseComponents(components: any[], lat: number, lng: number): DireccionParseada {
  const get = (type: string) => components.find((c) => c.types.includes(type))
  const route = get('route')?.long_name ?? ''
  const num = get('street_number')?.long_name ?? ''
  const ciudad =
    get('locality')?.long_name ??
    get('administrative_area_level_2')?.long_name ??
    get('sublocality')?.long_name ??
    ''
  const provincia = normalizarProvincia(get('administrative_area_level_1')?.long_name ?? '')
  const cp = get('postal_code')?.long_name ?? ''
  return {
    direccion: [route, num].filter(Boolean).join(' ').trim(),
    ciudad,
    provincia,
    codigo_postal: cp,
    lat,
    lng,
  }
}

export default function MapaDireccion({
  onCambio,
  onFalla,
}: {
  onCambio: (d: DireccionParseada) => void
  /** Se llama si el buscador no va a funcionar, para abrir la carga a mano. */
  onFalla?: () => void
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const inputRef = useRef<HTMLInputElement>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<G>(null)
  const markerRef = useRef<G>(null)
  const geocoderRef = useRef<G>(null)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [caido, setCaido] = useState(false)

  // Por ref: así avisar al carrito no depende de que el padre memorice la
  // función, y el efecto no se vuelve a correr en cada render.
  const onFallaRef = useRef(onFalla)
  onFallaRef.current = onFalla

  useEffect(() => {
    if (!apiKey) return
    let cancelado = false

    const caerse = () => {
      if (cancelado) return
      setCaido(true)
      onFallaRef.current?.()
    }
    suscriptoresAuth.add(caerse)
    // Ya había fallado antes de montar este componente (volvió al carrito).
    if (authFallo) caerse()

    loadGoogle(apiKey)
      .then(() => {
        if (cancelado || !inputRef.current || !mapDivRef.current) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google
        geocoderRef.current = new google.maps.Geocoder()

        // Mapa centrado en Buenos Aires por defecto.
        const centro = { lat: -34.6037, lng: -58.4438 }
        const map = new google.maps.Map(mapDivRef.current, {
          center: centro,
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
        })
        mapRef.current = map

        const marker = new google.maps.Marker({
          map,
          position: centro,
          draggable: true,
          visible: false,
        })
        markerRef.current = marker

        // Al arrastrar el pin: reverse geocode → actualizar campos.
        marker.addListener('dragend', () => {
          const pos = marker.getPosition()
          if (!pos) return
          geocoderRef.current.geocode(
            { location: { lat: pos.lat(), lng: pos.lng() } },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (results: any[], status: string) => {
              if (status === 'OK' && results?.[0]) {
                onCambio(parseComponents(results[0].address_components, pos.lat(), pos.lng()))
              }
            }
          )
        })

        // Autocompletado sobre el input.
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'ar' },
          fields: ['address_components', 'geometry'],
          types: ['address'],
        })
        ac.addListener('place_changed', () => {
          const place = ac.getPlace()
          if (!place?.geometry?.location) return
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          map.setCenter({ lat, lng })
          map.setZoom(16)
          marker.setPosition({ lat, lng })
          marker.setVisible(true)
          onCambio(parseComponents(place.address_components ?? [], lat, lng))
        })

        setListo(true)
      })
      .catch(() => {
        setError('No se pudo cargar el mapa. Cargá la dirección manualmente abajo.')
        caerse()
      })
    return () => {
      cancelado = true
      suscriptoresAuth.delete(caerse)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  if (!apiKey) return null

  /**
   * Caído: se saca de la página el input y el mapa. El input no autocompleta
   * nada y el div es donde Google dibuja su propio cartel de error; dejarlos
   * sólo hace que el cliente pelee con un buscador que no busca.
   */
  if (caido) {
    return (
      <p className="text-sm text-amber-400">
        El buscador de direcciones no está disponible en este momento. Cargá tu
        dirección a mano acá abajo: el envío se calcula igual.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <label htmlFor="mapa-busqueda" className="block text-sm font-medium text-brand-text-muted">
        Buscá tu dirección en el mapa
      </label>
      <input
        ref={inputRef}
        id="mapa-busqueda"
        type="text"
        className="input-dark"
        placeholder="Empezá a escribir tu dirección…"
        autoComplete="off"
      />
      <div
        ref={mapDivRef}
        className="w-full h-56 rounded-xl overflow-hidden border border-brand-border bg-brand-bg-soft"
      />
      {listo && (
        <p className="text-xs text-brand-text-muted">
          Ajustá el pin si hace falta. Con la dirección exacta calculamos el costo de envío.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
