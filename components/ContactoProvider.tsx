'use client'

import { createContext, useContext } from 'react'

/**
 * El WhatsApp de la tienda, para los lugares de adentro que necesitan ofrecerlo.
 *
 * Mismo criterio que `EnvioGratisProvider`: el número vive en la configuración
 * que lee `UserShell`, y hacérselo pasar como prop al carrito obligaría a tocar
 * también a sus padres, que no tienen por qué saber de contacto. El default
 * vacío hace que, sin shell, el bloque simplemente no se dibuje en vez de
 * mostrar un link roto.
 */
const WhatsAppTienda = createContext<string>('')

export function ContactoProvider({
  telefono,
  children,
}: {
  telefono: string
  children: React.ReactNode
}) {
  return (
    <WhatsAppTienda.Provider value={telefono}>{children}</WhatsAppTienda.Provider>
  )
}

/** Número tal como se escribe, y link de wa.me listo. Vacío si no hay número. */
export function useWhatsApp(): { numero: string; href: string } {
  const telefono = useContext(WhatsAppTienda)
  const num = (telefono || '').replace(/\D/g, '')
  return {
    numero: telefono || '',
    href: num
      ? `https://wa.me/${num}?text=${encodeURIComponent('Hola! Tengo una restricción para recibir mi pedido:')}`
      : '',
  }
}
