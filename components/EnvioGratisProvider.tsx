'use client'

import { createContext, useContext } from 'react'
import { UMBRAL_POR_DEFECTO } from '@/lib/envio-gratis'

/**
 * Desde cuánto hay envío gratis, disponible en cualquier tarjeta de producto.
 *
 * Va por contexto y no por prop porque `ProductCard` se dibuja desde cinco
 * lugares distintos —home, catálogo, categoría, relacionados, carrusel— y
 * ninguno de ellos tiene por qué saber de envíos: hacerles pasar el número
 * significaría tocar también a sus padres, que tampoco lo tienen. El valor lo
 * pone `UserShell`, que ya lee la configuración de la tienda.
 *
 * El default existe para que una tarjeta fuera del shell (una prueba, un
 * render aislado) no explote: muestra el mismo umbral que el resto del sitio.
 */
const UmbralEnvioGratis = createContext<number>(UMBRAL_POR_DEFECTO)

export function EnvioGratisProvider({
  umbral,
  children,
}: {
  umbral: number
  children: React.ReactNode
}) {
  return <UmbralEnvioGratis.Provider value={umbral}>{children}</UmbralEnvioGratis.Provider>
}

export function useUmbralEnvioGratis(): number {
  return useContext(UmbralEnvioGratis)
}
