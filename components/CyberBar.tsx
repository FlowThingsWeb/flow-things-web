'use client'

import { Lightning } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { useEntregaEnElDia } from '@/components/EntregaEnElDia'

/**
 * La barra de las Ofertas Cyber. Reemplaza a la de beneficios mientras dura.
 *
 * No hay cuenta regresiva, y no es un olvido: la promo no tiene fecha de fin
 * —se apaga a mano cuando se decide— así que cualquier reloj que mostrara
 * "termina en 2 días 14 horas" estaría inventando un número. Un contador
 * falso es la clase de detalle que el comprador comprueba: vuelve al día
 * siguiente, ve que terminaba y sigue ahí, y a partir de ahí no le cree nada
 * más a la tienda.
 *
 * La urgencia la da lo único que sí tiene reloj de verdad: el cadete sale a
 * las 13. "Comprá antes de las 13 y llega hoy" es urgente, es cierto, y es
 * algo que casi nadie más puede ofrecer.
 */
export default function CyberBar({
  titulo,
  bajada,
}: {
  titulo: string
  bajada: string
}) {
  const entrega = useEntregaEnElDia()

  return (
    <Link
      href="/cyber"
      className="block w-full bg-gradient-to-r from-brand-purple via-fuchsia-600 to-brand-purple text-white"
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium sm:text-sm">
        <Lightning weight="fill" className="h-4 w-4 shrink-0 text-brand-neon" aria-hidden />
        <span className="font-bold uppercase tracking-wide">{titulo}</span>
        {bajada && (
          /*
            En teléfono entra una sola línea y la bajada es lo primero que
            sobra: el título ya dice que hay promo, y el 82% del tráfico
            entra por ahí. En pantalla grande entra todo.
          */
          <span className="hidden text-white/90 sm:inline">· {bajada}</span>
        )}
        {/*
          El único reloj honesto que hay acá. Aparece sólo cuando el envío en
          el día está prendido y de verdad llega hoy.
        */}
        {entrega?.hoy && (
          <span className="hidden shrink-0 rounded-full bg-brand-neon px-2 py-0.5 text-[11px] font-bold text-black md:inline">
            {entrega.etiqueta}
          </span>
        )}
      </div>
    </Link>
  )
}
