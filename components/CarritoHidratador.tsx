'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/lib/store'

/**
 * Carga el carrito guardado en el navegador, después del primer render.
 *
 * El store tiene `skipHydration` para que el primer render del navegador sea
 * idéntico al HTML del servidor —que no puede conocer el carrito de nadie—.
 * Sin eso, cualquiera con algo en el carrito rompía la hidratación de React y
 * la página entera se volvía a dibujar en el navegador.
 *
 * Va primero dentro de UserShell: los efectos corren en orden de montaje, así
 * que el carrito ya está cargado cuando CartSync mira qué sincronizar.
 */
export default function CarritoHidratador() {
  useEffect(() => {
    useCartStore.persist.rehydrate()
  }, [])

  return null
}
