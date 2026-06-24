'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

const STORAGE_KEY = 'ft_reg_banner_dismissed'

export default function RegistrationBanner() {
  const { user, loading } = useAuth()
  const [dismissed, setDismissed] = useState(true) // empieza oculto para evitar flash

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(STORAGE_KEY) === '1'
    setDismissed(wasDismissed)
  }, [])

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setDismissed(true)
  }

  // No mostrar si: cargando, usuario logueado, o fue descartado
  if (loading || user || dismissed) return null

  return (
    <div className="w-full bg-brand-purple text-white text-sm flex items-center justify-center gap-3 px-4 py-2 relative">
      <span className="text-base">🎁</span>
      <span className="font-medium">
        Registrate y obtené{' '}
        <span className="font-bold underline underline-offset-2">10% de descuento</span>{' '}
        en tu primera compra
      </span>
      <Link
        href="/cuenta/registro"
        className="ml-1 bg-white text-brand-purple text-xs font-bold px-3 py-1 rounded-full hover:bg-gray-100 transition-colors whitespace-nowrap"
      >
        Registrarme
      </Link>
      <button
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-1"
        aria-label="Cerrar"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
          <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}
