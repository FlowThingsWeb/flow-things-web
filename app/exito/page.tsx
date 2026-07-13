'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { useCartStore } from '@/lib/store'
import { formatPrecio } from '@/lib/format'

interface ItemResumen {
  nombre: string
  cantidad: number
  precio: number
  imagen_url?: string | null
}

function ExitoContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const ordenId = searchParams.get('orden_id')
  const pending = searchParams.get('pending')
  const clearCart = useCartStore((s) => s.clearCart)

  const [items, setItems] = useState<ItemResumen[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [envio, setEnvio] = useState(0)
  const [descuento, setDescuento] = useState(0)
  const [aprobado, setAprobado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const trackedRef = useRef(false)
  const cuponProxima = process.env.NEXT_PUBLIC_CUPON_POSTCOMPRA

  // Sin orden_id no hay nada que mostrar — redirigir al catálogo
  useEffect(() => {
    if (!ordenId && !pending) {
      router.replace('/productos')
    }
  }, [ordenId, pending, router])

  // Traer estado + resumen de la orden. El webhook puede tardar unos segundos en
  // marcar la orden como 'approved', así que reintentamos (poll) hasta confirmarlo
  // y recién ahí limpiamos el carrito. Evita que quede sin vaciarse por timing.
  useEffect(() => {
    if (!ordenId) return
    let cancelado = false
    let intentos = 0
    const MAX_INTENTOS = 15 // ~30s

    async function poll() {
      try {
        const r = await fetch(`/api/ordenes/estado?id=${ordenId}`)
        const data = await r.json()
        if (cancelado) return
        if (Array.isArray(data.items)) setItems(data.items)
        if (typeof data.total === 'number') setTotal(data.total)
        if (typeof data.envio === 'number') setEnvio(data.envio)
        if (typeof data.descuento === 'number') setDescuento(data.descuento)
        if (data.estado === 'approved') {
          clearCart()
          setAprobado(true)
          // Evento de conversión para analytics (GA4 + Meta Pixel), una sola vez.
          if (!trackedRef.current) {
            trackedRef.current = true
            const total = Number(data.total) || 0
            const w = window as any
            try { w.gtag?.('event', 'purchase', { transaction_id: ordenId, value: total, currency: 'ARS' }) } catch {}
            try { w.fbq?.('track', 'Purchase', { value: total, currency: 'ARS' }) } catch {}
          }
          return // pago confirmado — dejar de pollear
        }
      } catch {
        // falla de red transitoria — reintentar
      }
      intentos++
      if (!cancelado && intentos < MAX_INTENTOS) {
        setTimeout(poll, 2000)
      }
    }

    poll()
    return () => { cancelado = true }
  }, [ordenId, clearCart])

  if (!ordenId && !pending) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 flex justify-center">
        <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="bg-brand-bg-card border border-brand-border rounded-3xl p-8 sm:p-10">
        {/* Ícono */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${pending ? 'bg-amber-400/15' : 'bg-green-500/15'}`}>
          <span className="text-3xl">{pending ? '⏳' : '✅'}</span>
        </div>

        {/* Título + mensaje */}
        <h1 className="text-2xl font-bold text-brand-text text-center mb-2">
          {pending ? '¡Pago en proceso!' : '¡Gracias por tu compra!'}
        </h1>
        <p className="text-brand-text-muted text-center text-sm mb-6">
          {pending
            ? 'Tu pago está siendo procesado. Te notificaremos por email cuando se confirme.'
            : 'Recibimos tu pedido correctamente. Te enviamos un email con los detalles.'}
        </p>

        {/* Número de orden */}
        {ordenId && (
          <p className="text-xs text-brand-text-light bg-brand-bg-soft rounded-lg px-4 py-2.5 mb-6 font-mono text-center tracking-wider">
            Orden #{ordenId.slice(0, 8).toUpperCase()}
          </p>
        )}

        {/* Cupón para la próxima compra */}
        {aprobado && cuponProxima && (
          <div className="border border-dashed border-brand-purple rounded-2xl p-4 mb-6 text-center bg-brand-purple/5">
            <p className="text-xs text-brand-text-muted mb-2">🎁 Un regalo para tu próxima compra:</p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono font-bold text-brand-purple text-lg tracking-wider">{cuponProxima}</span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(cuponProxima).then(() => {
                    setCopiado(true)
                    setTimeout(() => setCopiado(false), 2000)
                  })
                }}
                className="text-xs bg-brand-purple/15 text-brand-purple-light hover:bg-brand-purple hover:text-white px-2.5 py-1 rounded-lg transition-colors"
              >
                {copiado ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        )}

        {/* Resumen de la compra */}
        {items.length > 0 && (
          <div className="border-t border-brand-border pt-5 mb-6">
            <h2 className="text-sm font-semibold text-brand-text mb-3">Resumen del pedido</h2>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="relative w-11 h-11 bg-brand-bg-soft rounded-lg overflow-hidden flex-shrink-0">
                    {it.imagen_url ? (
                      <Image src={it.imagen_url} alt={it.nombre} fill className="object-cover" sizes="44px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-base">📦</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-brand-text line-clamp-1">{it.nombre}</p>
                    <p className="text-xs text-brand-text-muted">x{it.cantidad}</p>
                  </div>
                  <span className="text-sm font-semibold text-brand-text whitespace-nowrap">
                    {formatPrecio(it.precio * it.cantidad)}
                  </span>
                </div>
              ))}
            </div>

            {total != null && (
              <div className="border-t border-brand-border mt-4 pt-3 space-y-2">
                {descuento > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-text-muted">Descuento</span>
                    <span className="text-green-400">− {formatPrecio(descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-brand-text-muted">Envío</span>
                  <span className="text-brand-text">{envio > 0 ? formatPrecio(envio) : 'Gratis'}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-brand-border">
                  <span className="font-semibold text-brand-text">Total</span>
                  <span className="font-bold text-lg text-brand-text">{formatPrecio(total)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/productos"
            className="flex-1 text-center bg-brand-purple hover:bg-brand-purple-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Seguir comprando
          </Link>
          <Link
            href="/"
            className="flex-1 text-center border border-brand-border text-brand-text-muted hover:text-brand-text hover:bg-brand-bg-soft font-semibold px-6 py-3 rounded-xl transition-colors"
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
