'use client'

import { useEffect, useState } from 'react'
import { formatPrecio } from '@/lib/format'

interface Plan { cuotas: number; monto: number }
interface Proximo { cuotas: number; falta: number; min: number }

/**
 * Muestra las cuotas de Mercado Pago para un monto:
 *  - la mejor opción SIN interés que aplica al monto,
 *  - cuánto falta para el siguiente tramo sin interés (nudge de upsell),
 *  - o, si no hay tramo sin interés, hasta cuántas cuotas (con interés).
 * No renderiza nada si el endpoint no devuelve datos.
 */
export default function CuotasMP({ amount }: { amount: number }) {
  const [sinInteres, setSinInteres] = useState<Plan | null>(null)
  const [proximo, setProximo] = useState<Proximo | null>(null)
  const [max, setMax] = useState<Plan | null>(null)

  useEffect(() => {
    if (!amount || amount <= 0) return
    let cancelado = false
    fetch(`/api/cuotas?amount=${Math.round(amount)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelado) return
        setSinInteres(d.sinInteres ?? null)
        setProximo(d.proximo ?? null)
        setMax(d.max ?? null)
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [amount])

  if (!sinInteres && !max) return null

  // El nudge del próximo tramo solo si falta poco (no más del 50% del monto
  // actual); si no, es ruido para tickets chicos.
  const mostrarProximo = proximo && proximo.falta <= amount * 0.5

  return (
    <div className="space-y-1">
      {sinInteres ? (
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
          <span className="text-sm font-semibold text-green-400">
            {sinInteres.cuotas} cuotas sin interés de {formatPrecio(sinInteres.monto)}
          </span>
          <span className="text-xs text-brand-text-muted">con Mercado Pago</span>
        </div>
      ) : (
        max && (
          <p className="text-sm text-brand-text-muted">
            Hasta <span className="font-semibold text-brand-text">{max.cuotas} cuotas</span> de{' '}
            {formatPrecio(max.monto)} con Mercado Pago
          </p>
        )
      )}

      {mostrarProximo && (
        <p className="text-xs text-brand-text-muted">
          Agregá{' '}
          <span className="font-semibold text-brand-neon">
            {formatPrecio(proximo!.falta)}
          </span>{' '}
          para pagar en{' '}
          <span className="font-semibold">{proximo!.cuotas} cuotas sin interés</span>
        </p>
      )}
    </div>
  )
}
