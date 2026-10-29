'use client'

import { useEffect, useState } from 'react'
import { Moped } from '@phosphor-icons/react/dist/ssr'

/**
 * "CABA y alrededores · Llega hoy".
 *
 * La promesa de entrega antes de que el comprador cargue nada. Es el dato que
 * más empuja a comprar y el que más tarde aparecía: hasta ahora había que
 * escribir el código postal en el estimador para enterarse.
 *
 * Por qué se pide al servidor y no se calcula acá: la hora que vale es la de
 * Buenos Aires, no la del visitante. Un comprador con el reloj mal puesto, o
 * mirando desde otro huso, vería un día que no es. Y por qué no viene en el
 * HTML: la ficha se cachea 5 minutos, así que un "Llega hoy" generado a las
 * 12:58 seguiría en pantalla a las 13:02.
 */

export interface Entrega {
  hoy: boolean
  etiqueta: string
  cobertura: string
}

/**
 * Pide la entrega una sola vez por ficha.
 *
 * Lo usa la tira de arriba y también la barra fija de abajo en mobile, que es
 * la que queda bajo el pulgar: una sola llamada para los dos.
 *
 * Si falla, devuelve null y no se dibuja nada. Es un agregado, no un dato del
 * producto: una promesa de entrega que no se pudo confirmar no se muestra.
 */
export function useEntregaEnElDia(): Entrega | null {
  const [entrega, setEntrega] = useState<Entrega | null>(null)

  useEffect(() => {
    let vigente = true
    fetch('/api/envio/entrega', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vigente || !d?.activo) return
        setEntrega({ hoy: !!d.hoy, etiqueta: String(d.etiqueta), cobertura: String(d.cobertura) })
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [])

  return entrega
}

/**
 * La tira de la ficha de producto.
 *
 * Va con los colores que ya tiene la página: el bloque neutro de siempre
 * (`bg-brand-bg-soft` con su borde) y el lima reservado para el día en que
 * llega. El lima no se usa para todo el texto a propósito: en esta ficha el
 * lima ya es el color del precio, y dos cosas verdes del mismo tamaño compiten
 * entre sí. Acá sólo lo lleva el dato que cambia.
 */
export default function EntregaEnElDia({ entrega }: { entrega: Entrega | null }) {
  if (!entrega) return null

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 motion-safe:animate-[fadeIn_.3s_ease-out] ${
        entrega.hoy
          ? 'border-brand-neon/35 bg-brand-neon/5'
          : 'border-brand-border bg-brand-bg-soft'
      }`}
    >
      <Moped
        weight="fill"
        className={`h-5 w-5 shrink-0 ${entrega.hoy ? 'text-brand-neon' : 'text-brand-text-muted'}`}
        aria-hidden
      />
      <p className="min-w-0 text-sm leading-tight">
        <span className={`font-semibold ${entrega.hoy ? 'text-brand-neon' : 'text-brand-text'}`}>
          {entrega.etiqueta}
        </span>
        <span className="text-brand-text-muted"> en {entrega.cobertura}</span>
      </p>
    </div>
  )
}
