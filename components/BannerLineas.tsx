'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PiezaResuelta } from '@/lib/bannerLineas'

/**
 * El banner de arriba de la home: una pieza por línea, en carrusel.
 *
 * Por qué las burbujas no son círculos: el isotipo de Flow es un círculo
 * dibujado a mano, torcido, con la F de trazo irregular. Seis círculos de
 * compás le ponían el color de la marca a una estructura ajena. Cada burbuja
 * tiene su deformación y su giro, y ninguna se repite.
 *
 * Por qué `mix-blend-mode: multiply`: las fotos del catálogo están sobre
 * blanco, no recortadas. Multiply deja el blanco del color de lo que tenga
 * debajo, así que sobre la burbuja clara desaparece y el producto queda
 * flotando. El precio de eso es que el producto NO puede salirse de su
 * burbuja: sobre el fondo oscuro, multiply lo ennegrece entero. Por eso cada
 * uno tiene la suya y las medidas de abajo están calculadas para contenerlo.
 */

/** Dónde va cada producto. El centro queda libre para el texto. */
const HUECOS = [
  // grande izquierda
  { burbuja: 'left-2 top-[25%] w-[28.5%] aspect-square', foto: 'left-[3.1%] top-[30.7%] w-[23.3%]', forma: '44% 56% 53% 47% / 55% 44% 56% 45%', giro: '6deg' },
  // chica arriba izquierda
  { burbuja: 'left-[16.7%] -top-[4.3%] w-[15.6%] aspect-square', foto: 'left-[18.1%] -top-[1.1%] w-[12.7%]', forma: '57% 43% 48% 52% / 46% 52% 48% 54%', giro: '-8deg' },
  // chica abajo izquierda
  { burbuja: 'left-[17.9%] -bottom-[4.6%] w-[15.7%] aspect-square', foto: 'left-[19.4%] -bottom-[1.3%] w-[12.7%]', forma: '52% 48% 41% 59% / 50% 56% 44% 50%', giro: '11deg' },
  // grande derecha
  { burbuja: 'right-2 top-[25%] w-[28.5%] aspect-square', foto: 'right-[3.1%] top-[30.7%] w-[23.3%]', forma: '55% 45% 44% 56% / 48% 57% 43% 52%', giro: '-7deg' },
  // chica arriba derecha
  { burbuja: 'right-[16.7%] -top-[4.3%] w-[15.6%] aspect-square', foto: 'right-[18.1%] -top-[1.1%] w-[12.7%]', forma: '48% 52% 57% 43% / 43% 48% 52% 57%', giro: '9deg' },
  // chica abajo derecha
  { burbuja: 'right-[17.9%] -bottom-[4.6%] w-[15.7%] aspect-square', foto: 'right-[19.4%] -bottom-[1.3%] w-[12.7%]', forma: '43% 57% 52% 48% / 56% 46% 54% 44%', giro: '-12deg' },
]

/** En vertical entran tres: el texto necesita su mitad entera. */
const HUECOS_MOVIL = [
  { burbuja: 'left-[4.6%] top-[5.8%] w-[52.8%] aspect-square', foto: 'left-[9%] top-[8.5%] w-[44%]', forma: '44% 56% 53% 47% / 55% 44% 56% 45%', giro: '6deg' },
  { burbuja: 'right-[4.1%] top-[1.3%] w-[36.4%] aspect-square', foto: 'right-[7.2%] top-[3.2%] w-[30.3%]', forma: '57% 43% 48% 52% / 46% 52% 48% 54%', giro: '-8deg' },
  { burbuja: 'right-[7.7%] top-[27.4%] w-[32.8%] aspect-square', foto: 'right-[10.5%] top-[29.2%] w-[27.2%]', forma: '52% 48% 41% 59% / 50% 56% 44% 50%', giro: '11deg' },
]

const FAMILIAS: Record<string, string> = {
  serif: 'font-serif tracking-tight',
  condensada: 'uppercase tracking-wide leading-[0.9]',
  negra: 'font-black uppercase tracking-tighter',
}

/**
 * Cada cuánto pasa sola, según dónde esté el puntero.
 *
 * Afuera son 6 segundos: alcanza para leer tres renglones de reojo y hace
 * que alguien que mira la home dos segundos igual vea más de una línea.
 *
 * Encima son 10, porque el mouse ahí significa que están leyendo esa pieza.
 * No se frena del todo a propósito: el puntero pasa por encima del banner
 * solo, de camino a lo que está más abajo, y una pausa por un roce dejaba a
 * ese visitante sin ver nunca las otras tres.
 */
const MS_AFUERA = 6000
const MS_ENCIMA = 10000

export default function BannerLineas({ piezas }: { piezas: PiezaResuelta[] }) {
  const [activa, setActiva] = useState(0)
  /**
   * `encima` sólo cambia el ritmo; `elegido` lo corta.
   *
   * No son lo mismo. El mouse arriba del banner pasa solo, de camino a lo que
   * está más abajo: eso pide ir más despacio, no parar. Tocar un punto o
   * deslizar con el dedo sí es elegir, y ahí el carrusel no se la saca más de
   * encima a la persona. Eso no vuelve.
   */
  const [encima, setEncima] = useState(false)
  const [elegido, setElegido] = useState(false)
  const toqueX = useRef<number | null>(null)
  const total = piezas.length
  const intervalo = encima ? MS_ENCIMA : MS_AFUERA

  const ir = useCallback(
    (i: number) => setActiva(((i % total) + total) % total),
    [total],
  )

  /**
   * Entrar o salir con el mouse reinicia la cuenta con el ritmo nuevo. Es a
   * propósito: así al apoyar el puntero quedan los 10 segundos enteros para
   * leer, en vez de lo que sobraba de los 6.
   */
  useEffect(() => {
    if (elegido || total < 2) return
    const t = setTimeout(() => setActiva((i) => (i + 1) % total), intervalo)
    return () => clearTimeout(t)
  }, [activa, elegido, intervalo, total])

  // Respeta a quien pidió menos movimiento en el sistema operativo.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) setElegido(true)
  }, [])

  if (total === 0) return null

  return (
    <section
      id="banner-home"
      aria-label="Líneas destacadas"
      aria-roledescription="carrusel"
      className="relative overflow-hidden bg-brand-bg"
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      /* Llegar con el teclado también frena, y seguir de largo lo suelta. */
      onFocus={() => setEncima(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setEncima(false)
        }
      }}
      onTouchStart={(e) => {
        toqueX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        const x0 = toqueX.current
        if (x0 == null) return
        const dx = e.changedTouches[0].clientX - x0
        if (Math.abs(dx) > 45) {
          setElegido(true)
          ir(activa + (dx < 0 ? 1 : -1))
        }
        toqueX.current = null
      }}
    >
      <div className="relative">
        {piezas.map((p, i) => (
          <Pieza
            key={p.id}
            pieza={p}
            visible={i === activa}
            primera={i === 0}
            posicion={i + 1}
            de={total}
          />
        ))}
      </div>

      {total > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 sm:bottom-4">
          {piezas.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setElegido(true)
                ir(i)
              }}
              aria-label={`Ver ${p.titulo}`}
              aria-current={i === activa}
              className={`h-1.5 rounded-full transition-all ${
                i === activa ? 'w-6 bg-brand-neon' : 'w-1.5 bg-white/45 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function Pieza({
  pieza,
  visible,
  primera,
  posicion,
  de,
}: {
  pieza: PiezaResuelta
  visible: boolean
  primera: boolean
  posicion: number
  de: number
}) {
  const claro = pieza.fondo === '#F2F1F4'
  const texto = claro ? '#212121' : '#ffffff'
  const huecos = pieza.burbujaIzq ? HUECOS : null

  return (
    <div
      role="group"
      aria-roledescription="pieza"
      aria-label={`${posicion} de ${de}: ${pieza.titulo}`}
      aria-hidden={!visible}
      className={`${visible ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'} transition-opacity duration-500`}
      style={{ background: pieza.fondo }}
    >
      {/*
        Proporción del arte: 1500×700 en escritorio, más alto en el teléfono.

        El tope de ancho es lo que decide el alto, porque la proporción es
        fija: sin él, en un monitor de 1920 el banner mide 1850 de ancho y 863
        de alto, y no entra en la pantalla. Con 1180 queda en 550, que entra
        en un portátil con lugar para que se asome lo de abajo — y que se
        asome es lo que hace que alguien siga bajando.

        A los costados queda el color plano del fondo, que sigue a sangre. Es
        lo mismo que hace Multiscope: su arte es de 1500 de ancho y en una
        pantalla de 1920 lo muestra a 1009.
      */}
      <div className="relative mx-auto aspect-[390/620] w-full sm:aspect-[1500/700] sm:max-w-[1180px]">
        {/* Los dos arcos del isotipo, agrandados y cortados por el marco. */}
        {pieza.arco && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 hidden aspect-square w-[83%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.7%] border-transparent sm:block"
              style={{ borderBottomColor: pieza.arco, transform: 'translate(-50%,-50%) rotate(28deg)' }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 aspect-square w-[169%] -translate-x-1/2 rounded-full border-[4.6%] border-transparent sm:hidden"
              style={{ borderBottomColor: pieza.arco, top: '-37%', transform: 'translateX(-50%) rotate(24deg)' }}
            />
          </>
        )}

        {/* Escritorio: hasta seis productos, cada uno en su burbuja. */}
        {huecos &&
          pieza.productos.slice(0, 6).map((prod, i) => {
            const h = huecos[i]
            const tinte = i < 3 ? pieza.burbujaIzq : pieza.burbujaDer
            return (
              <div key={prod.sku} className="hidden sm:block">
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute ${h.burbuja}`}
                  style={{ background: tinte, borderRadius: h.forma, transform: `rotate(${h.giro})` }}
                />
                <img
                  src={prod.imagen}
                  alt={prod.nombre}
                  loading={primera && i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  className={`pointer-events-none absolute aspect-square object-contain mix-blend-multiply ${h.foto}`}
                />
              </div>
            )
          })}

        {/* Celular: tres. */}
        {huecos &&
          pieza.productos.slice(0, 3).map((prod, i) => {
            const h = HUECOS_MOVIL[i]
            const tinte = i === 0 ? pieza.burbujaIzq : pieza.burbujaDer
            return (
              <div key={`m-${prod.sku}`} className="sm:hidden">
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute ${h.burbuja}`}
                  style={{ background: tinte, borderRadius: h.forma, transform: `rotate(${h.giro})` }}
                />
                <img
                  src={prod.imagen}
                  alt={prod.nombre}
                  loading={primera && i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  className={`pointer-events-none absolute aspect-square object-contain mix-blend-multiply ${h.foto}`}
                />
              </div>
            )
          })}

        {/* Campaña sin burbujas: los productos van sueltos sobre el fondo claro. */}
        {!huecos &&
          pieza.productos.slice(0, 12).map((prod, i) => (
            <img
              key={prod.sku}
              src={prod.imagen}
              alt={prod.nombre}
              loading="lazy"
              decoding="async"
              className={`pointer-events-none absolute aspect-square w-[17%] object-contain mix-blend-multiply ${DISPERSOS[i % DISPERSOS.length]}`}
              style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (5 + (i % 4) * 2)}deg)` }}
            />
          ))}

        {/* La columna central: título, bajada, botón y beneficios. */}
        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-6 text-center sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[29%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:gap-4 sm:px-0">
          {pieza.logo ? (
            <img
              src={pieza.logo}
              alt={pieza.titulo}
              className="h-auto w-[56%] max-w-[310px] sm:w-[72%]"
              loading={primera ? 'eager' : 'lazy'}
            />
          ) : (
            <h2
              className={`text-[2.3rem] font-bold leading-[0.95] sm:text-[3.6rem] ${FAMILIAS[pieza.familia ?? ''] ?? ''}`}
              style={{ color: texto }}
            >
              {pieza.titulo}
            </h2>
          )}

          {!pieza.logo && (
            <span
              aria-hidden="true"
              className="block h-1.5 w-16 bg-brand-neon"
              style={{ borderRadius: '60% 40% 55% 45% / 50% 50% 50% 50%', transform: 'rotate(-1.5deg)' }}
            />
          )}

          <p
            className="text-[1.05rem] font-semibold leading-snug sm:text-[1.3rem]"
            style={{ color: texto }}
          >
            {pieza.bajada.map((l, i) => (
              <span key={i} className="block">
                {l}
              </span>
            ))}
          </p>

          <Link
            href={pieza.href}
            className={`rounded-full px-10 py-4 text-sm font-extrabold tracking-wider transition-transform hover:scale-[1.03] ${
              claro ? 'bg-brand-purple text-white' : 'bg-brand-neon text-[#212121]'
            }`}
          >
            {pieza.cta}
          </Link>

          <p
            className="text-xs font-semibold leading-snug sm:text-[0.95rem]"
            style={{ color: claro ? '#4A4552' : 'rgba(255,255,255,0.92)' }}
          >
            <span className="block sm:inline">3 cuotas sin interés</span>
            <span className="hidden sm:inline"> · </span>
            <span className="block sm:inline">Envío gratis desde $61.000</span>
          </p>
        </div>
      </div>
    </div>
  )
}

/** Posiciones del desparramo de campaña, alrededor del hueco del centro. */
const DISPERSOS = [
  'left-[1.5%] -top-[2.5%]', 'left-[16%] top-[5%]', 'left-[33%] -top-[6%]',
  'right-[33%] top-[1.5%]', 'right-[13%] -top-[4.5%]', '-right-[1%] top-[18%]',
  'right-[3%] -bottom-[5%]', 'right-[20%] -bottom-[7%]', 'left-[38%] -bottom-[8%]',
  'left-[20%] -bottom-[6%]', 'left-[1.5%] -bottom-[4%]', '-left-[2%] top-[34%]',
]
