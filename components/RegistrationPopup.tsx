'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

const STORAGE_KEY = 'ft_popup_dismissed'
/** Días que el popup queda oculto después de cerrarlo. */
const DIAS_OCULTO = 7
const MS_OCULTO = DIAS_OCULTO * 24 * 60 * 60 * 1000

/**
 * ¿Sigue vigente el "no me lo muestres" del visitante?
 * Guardamos el timestamp del descarte en vez de un flag permanente: si
 * alguien lo cierra sin prestar atención, vuelve a verlo a los 7 días en
 * lugar de perderlo para siempre.
 * Los valores viejos (se guardaba un '1') quedan vencidos y el popup se
 * vuelve a mostrar una vez, que es el comportamiento deseado.
 */
function descarteVigente(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return false
  const ts = Number(raw)
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts < MS_OCULTO
}

export default function RegistrationPopup() {
  const { user, loading } = useAuth()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (loading) return
    if (user) return
    if (descarteVigente()) return

    const timer = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [loading, user])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={dismiss}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con gradiente */}
        <div className="bg-gradient-to-br from-brand-purple to-purple-800 px-6 pt-8 pb-6 text-center">
          <span className="text-5xl block mb-3">🎁</span>
          <p className="text-white/80 text-sm font-medium uppercase tracking-widest mb-1">Oferta exclusiva</p>
          <h2 className="text-white text-3xl font-extrabold leading-tight">
            10% OFF
          </h2>
          <p className="text-white/80 text-sm mt-1">en tu primera compra</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-center">
          <p className="text-brand-text text-sm mb-5 leading-relaxed">
            Registrate gratis y el descuento se aplica automáticamente al finalizar tu primera compra.
          </p>

          <Link
            href="/cuenta/registro"
            onClick={dismiss}
            className="block w-full bg-brand-purple hover:bg-brand-purple-light text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Quiero mi 10% de descuento
          </Link>

          <button
            onClick={dismiss}
            className="mt-3 text-xs text-brand-text-muted hover:text-brand-text transition-colors"
          >
            No, gracias
          </button>
        </div>

        {/* Botón cerrar */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
