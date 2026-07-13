'use client'

import { useEffect, useState } from 'react'
import { formatPrecio } from '@/lib/format'

interface Plan { cuotas: number; monto: number }

/**
 * Muestra el plan de cuotas de Mercado Pago para un monto dado.
 * Prioriza mostrar la mejor opción SIN interés; si no hay, muestra el máximo de cuotas.
 * No renderiza nada si MP no devuelve planes (o falla).
 */
export default function CuotasMP({ amount }: { amount: number }) {
  const [max, setMax] = useState<Plan | null>(null)
  const [sinInteres, setSinInteres] = useState<Plan | null>(null)

  useEffect(() => {
    if (!amount || amount <= 0) return
    let cancelado = false
    fetch(`/api/cuotas?amount=${Math.round(amount)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelado) return
        setMax(d.max ?? null)
        setSinInteres(d.sinInteres ?? null)
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [amount])

  if (!max && !sinInteres) return null

  if (sinInteres) {
    return (
      <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
        <span className="text-sm font-semibold text-green-400">
          {sinInteres.cuotas} cuotas sin interés de {formatPrecio(sinInteres.monto)}
        </span>
        <span className="text-xs text-brand-text-muted">con Mercado Pago</span>
      </div>
    )
  }

  return (
    <p className="text-sm text-brand-text-muted">
      Hasta <span className="font-semibold text-brand-text">{max!.cuotas} cuotas</span> de{' '}
      {formatPrecio(max!.monto)} con Mercado Pago
    </p>
  )
}
