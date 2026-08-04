'use client'

/**
 * Buscador de dirección con autocompletado de Google Places + mapa con pin
 * arrastrable. Al elegir una dirección (o mover el pin) devuelve los campos
 * parseados por `onCambio`. El costo de envío igual se recalcula en el
 * servidor: esto es solo para cargar la dirección con comodidad.
 *
 * Requiere NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Si no está, no renderiza nada
 * (el carrito sigue funcionando con los campos manuales).
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

let scriptPromise: Promise<void> | null = null
function loadGoogle(key: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).google?.maps?.places) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
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
}: {
  onCambio: (d: DireccionParseada) => void
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const inputRef = useRef<HTMLInputElement>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<G>(null)
  const markerRef = useRef<G>(null)
  const geocoderRef = useRef<G>(null)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  useEffect(() => {
    if (!apiKey) return
    let cancelado = false
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
      .catch(() => setError('No se pudo cargar el mapa. Cargá la dirección manualmente abajo.'))
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  if (!apiKey) return null

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
