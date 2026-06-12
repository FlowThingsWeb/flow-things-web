'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useCartStore } from '@/lib/store'

function ExitoContent() {
  const searchParams = useSearchParams()
  const ordenId = searchParams.get('orden_id')
  const pending = searchParams.get('pending')
  const clearCart = useCartStore((s) => s.clearCart)

  // Limpiar el carrito solo si el pago fue aprobado.
  // Si está pendiente no lo limpiamos: si el pago termina rechazado, el usuario recupera su carrito.
  useEffect(() => {
    if (!pending) clearCart()
  }, [pending, clearCart])

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="bg-white rounded-3xl p-10 shadow-card">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">{pending ? '⏳' : '✅'}</span>
        </div>

        <h1 className="text-2xl font-bold text-brand-text mb-3">
          {pending ? '¡Pago en proceso!' : '¡Gracias por tu compra!'}
        </h1>

        <p className="text-brand-text-muted mb-6">
          {pending
            ? 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.'
            : 'Recibimos tu pedido correctamente. Te enviaremos un email con los detalles.'}
        </p>

        {ordenId && (
          <p className="text-xs text-brand-text-light bg-brand-bg-soft rounded-lg px-4 py-2 mb-8 font-mono">
            Orden: {ordenId}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/productos"
            className="bg-brand-purple hover:bg-brand-purple-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Seguir comprando
          </Link>
          <Link
            href="/"
            className="border border-brand-border text-brand-text hover:bg-brand-bg-soft font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ExitoPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-brand-text-muted">Cargando...</div>}>
      <ExitoContent />
    </Suspense>
  )
}
