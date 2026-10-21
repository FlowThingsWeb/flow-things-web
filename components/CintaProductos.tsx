'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * El riel de productos, andando solo como una cinta.
 *
 * Quieto no se leía como algo que se pueda mover: la última ficha asomaba
 * cortada por el borde, que es la pista de siempre, pero hay que saber
 * leerla. Andando, no hace falta saber nada.
 *
 * Mueve `scrollLeft`, no un `transform`. Es la diferencia entre una cinta y
 * un riel que además anda: como lo que se desplaza es la posición real del
 * contenedor, el dedo y la rueda siguen funcionando igual, y la persona puede
 * agarrarlo en cualquier momento sin que la cinta le pelee el control.
 *
 * Cuándo frena:
 *
 *   - El puntero encima: están mirando una ficha, no el desfile. Suelta el
 *     puntero y sigue.
 *   - El dedo encima: lo mismo, y además escribir `scrollLeft` mientras iOS
 *     tiene su propia inercia andando produce un temblor feo.
 *   - Alguien la desliza a mano: ahí frena y no vuelve a arrancar. Deslizar
 *     es tomar el control, y devolvérselo a la cinta dos segundos después es
 *     sacárselo de nuevo.
 *   - `prefers-reduced-motion`: no arranca nunca.
 *
 * El bucle es sin costura porque la lista viene duplicada: al llegar a la
 * mitad del ancho, resta esa mitad y la posición cae sobre una copia idéntica
 * del mismo punto. No hay salto que ver.
 */

/** Píxeles por segundo. Lento: es una pista de que se puede mover, no un
 *  carrusel que se lleva las fichas puestas antes de poder leerlas. */
const PX_POR_SEGUNDO = 26

export default function CintaProductos({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const caja = useRef<HTMLDivElement>(null)
  const alTocar = useRef(0)
  const [quieta, setQuieta] = useState(false)
  const [tomada, setTomada] = useState(false)

  /*
    Las copias quedan fuera del recorrido del teclado y del lector de
    pantalla.

    Va en su propio efecto, separado del de la animación, porque aquél corta
    temprano cuando la cinta está frenada o cuando el sistema pide menos
    movimiento —y es justamente a quien pide menos movimiento a quien más le
    importa no tabular treinta y seis fichas en vez de doce—.

    `inert` se pone acá y no como prop en el JSX porque React 18 no lo conoce
    como atributo booleano: lo recibe como string vacío, lo trata como false y
    no lo aplica, sin avisar en producción.
  */
  useEffect(() => {
    const fichas = caja.current?.querySelectorAll<HTMLElement>(':scope > ul > li')
    if (!fichas?.length) return
    for (let i = fichas.length / 3; i < fichas.length; i++) {
      fichas[i].setAttribute('inert', '')
    }
  }, [children])

  useEffect(() => {
    const el = caja.current
    if (!el || tomada || quieta) return

    const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (menosMovimiento.matches) return

    /*
      El largo de una vuelta se mide del DOM, no con `scrollWidth / 3`: lo que
      importa es la distancia real entre una ficha y su copia.

      Y la cinta arranca en la SEGUNDA copia, no en el principio. Con dos
      copias y volviendo a cero, al dar la vuelta una media ficha aparecía de
      la nada en el borde izquierdo: en la posición 0 no hay nada a la
      izquierda, pero en el punto de vuelta sí está el final de la copia
      anterior. Con tres copias y saltando de la tercera a la segunda, a los
      dos lados hay exactamente lo mismo y el salto no existe para nadie.
    */
    const fichas = el.querySelectorAll<HTMLElement>(':scope > ul > li')
    const porCopia = fichas.length / 3
    const vuelta = porCopia >= 1 ? fichas[porCopia].offsetLeft - fichas[0].offsetLeft : 0
    if (vuelta <= 0) return


    if (el.scrollLeft < vuelta) el.scrollLeft = vuelta

    let cuadro = 0
    let anterior = 0

    const avanzar = (ahora: number) => {
      if (anterior) {
        const px = ((ahora - anterior) / 1000) * PX_POR_SEGUNDO
        const x = el.scrollLeft + px
        el.scrollLeft = x >= vuelta * 2 ? x - vuelta : x
      }
      anterior = ahora
      cuadro = requestAnimationFrame(avanzar)
    }

    cuadro = requestAnimationFrame(avanzar)
    return () => cancelAnimationFrame(cuadro)
  }, [quieta, tomada])

  return (
    <div
      ref={caja}
      className={`scrollbar-hide overflow-x-auto overscroll-x-contain ${className}`}
      onMouseEnter={() => setQuieta(true)}
      onMouseLeave={() => setQuieta(false)}
      /* Llegar con el teclado también frena: alguien tabulando entre fichas
         no puede perseguir un botón que se corre. */
      onFocusCapture={() => setQuieta(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setQuieta(false)
      }}
      onTouchStart={() => {
        alTocar.current = caja.current?.scrollLeft ?? 0
        setQuieta(true)
      }}
      onTouchEnd={() => {
        /* Tocar no es deslizar. Si el dedo movió la cinta, tomó el control y
           no vuelve a arrancar; si sólo apoyó —para tocar "+ Agregar", por
           ejemplo— la cinta sigue su camino. */
        const movio = Math.abs((caja.current?.scrollLeft ?? 0) - alTocar.current) > 8
        if (movio) setTomada(true)
        else setQuieta(false)
      }}
      /* Rueda o trackpad en horizontal: tomó el control, la cinta se baja. */
      onWheel={(e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) setTomada(true)
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') setTomada(true)
      }}
    >
      {children}
    </div>
  )
}
