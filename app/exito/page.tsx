'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { useCartStore } from '@/lib/store'

function ExitoContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const ordenId = searchParams.get('orden_id')
  const pending = searchParams.get('pending')
  const clearCart = useCartStore((s) => s.clearCart)
  const [verified, setVerified] = useState(false)

  // Sin orden_id no hay nada que mostrar — redirigir al catálogo
  useEffect(() => {
    if (!ordenId && !pending) {
      router.replace('/productos')
    }
  }, [ordenId, pending, router])

  // Verificar el estado real de la orden en DB antes de limpiar el carrito.
  // Evita que alguien navegue a /exito?orden_id=xxx manualmente y borre su carrito.
  useEffect(() => {
    if (pending || !ordenId) return

    fetch(`/api/ordenes/estado?id=${ordenId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.estado === 'approved') {
          clearCart()
          setVerified(true)
        }
        // Si el estado no es 'approved' (ej: aún pending), no borrar el carrito
      })
      .catch(() => {
        // No limpiar el carrito si la consulta falla — conservarlo por seguridad.
        // MP redirige a /exito solo tras pago aprobado (auto_return: 'approved'),
        // pero preferimos no borrar datos ante una falla de red transitoria.
        setVerified(true)
      })
  }, [ordenId, pending, clearCart])

  if (!ordenId && !pending) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 flex justify-center">
        <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

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
