import { ImageResponse } from 'next/og'
import { getConfig } from '@/lib/config'
import { estadoCyber } from '@/lib/cyber'

/**
 * La imagen que se ve cuando alguien comparte /cyber.
 *
 * Importa más de lo que parece: el 58% del tráfico entra por el webview de
 * Instagram y buena parte de lo que se comparte va por WhatsApp, donde el
 * link es una tarjeta con una imagen, un título y nada más. Hasta ahora esa
 * tarjeta mostraba el banner genérico de la tienda, que no dice que haya una
 * promo.
 *
 * Se dibuja acá en vez de subir un PNG para que el texto salga de la misma
 * configuración que la página: si cambia el título de la promo en /admin, la
 * tarjeta compartida cambia con él y no quedan dos mensajes distintos dando
 * vueltas.
 */

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Ofertas Cyber en Flow Things'

export default async function Image() {
  const cfg = await getConfig()
  const cyber = estadoCyber(cfg)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #2a1049 55%, #9333ea 100%)',
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            color: '#c8ff00',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          Flow Things
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: '18px',
            fontSize: 92,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.05,
          }}
        >
          {cyber.titulo}
        </div>

        {cyber.bajada && (
          <div
            style={{
              display: 'flex',
              marginTop: '24px',
              fontSize: 38,
              color: 'rgba(255,255,255,0.86)',
              maxWidth: '900px',
            }}
          >
            {cyber.bajada}
          </div>
        )}

        {/*
          La promesa que casi nadie más puede hacer en una semana de
          descuentos. Va abajo, en el bloque de color, para que se lea aunque
          la tarjeta salga recortada.
        */}
        <div
          style={{
            display: 'flex',
            marginTop: '40px',
            alignSelf: 'flex-start',
            background: '#c8ff00',
            color: '#0f0f0f',
            fontSize: 34,
            fontWeight: 800,
            padding: '14px 28px',
            borderRadius: '999px',
          }}
        >
          Llega hoy en CABA y alrededores
        </div>
      </div>
    ),
    size,
  )
}
