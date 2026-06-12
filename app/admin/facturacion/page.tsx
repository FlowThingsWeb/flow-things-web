'use client'

import { useState } from 'react'

export default function FacturacionAdminPage() {
  const [testing, setTesting] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError] = useState('')

  const handlePrueba = async () => {
    setTesting(true)
    setError('')
    setResultado(null)
    try {
      const res = await fetch('/api/admin/factura-prueba', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconocido')
      setResultado(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Facturación electrónica</h1>
        <p className="text-brand-text-muted mt-1 text-sm">
          Integración con AFIP · Factura C automática en cada venta aprobada.
        </p>
      </div>

      {/* Estado de configuración */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-white mb-4">Estado de la integración</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <span className="text-brand-text">Certificado AFIP configurado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <span className="text-brand-text">Factura C automática al aprobar pago</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✅</span>
            <span className="text-brand-text">CAE guardado en cada orden</span>
          </div>
        </div>
      </div>

      {/* Prueba de facturación */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-2">Factura de prueba</h2>
        <p className="text-brand-text-muted text-sm mb-5">
          Emite una Factura C de $1.000 en el entorno de <span className="text-yellow-400 font-medium">homologación</span> de AFIP (no tiene efecto real ni fiscal).
        </p>

        <button
          onClick={handlePrueba}
          disabled={testing}
          className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
        >
          {testing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Emitiendo...
            </>
          ) : (
            '🧾 Emitir factura de prueba'
          )}
        </button>

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 rounded-xl p-4">
            <p className="text-red-400 text-sm font-medium">Error</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        {resultado && (
          <div className="mt-4 bg-green-900/20 border border-green-700 rounded-xl p-4 space-y-2">
            <p className="text-green-400 font-semibold">✅ Factura emitida correctamente</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mt-2">
              <span className="text-brand-text-muted">Ambiente</span>
              <span className="text-yellow-400 font-medium">{resultado.ambiente}</span>
              <span className="text-brand-text-muted">Punto de venta</span>
              <span className="text-white">{resultado.ptoVenta}</span>
              <span className="text-brand-text-muted">Nro comprobante</span>
              <span className="text-white">{resultado.nroComprobante}</span>
              <span className="text-brand-text-muted">Importe</span>
              <span className="text-white">{resultado.importe}</span>
              <span className="text-brand-text-muted">Fecha</span>
              <span className="text-white">{resultado.fecha}</span>
              <span className="text-brand-text-muted">CAE</span>
              <span className="text-brand-neon font-mono text-xs">{resultado.cae}</span>
              <span className="text-brand-text-muted">Vto. CAE</span>
              <span className="text-white">{resultado.caeFechaVto}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
