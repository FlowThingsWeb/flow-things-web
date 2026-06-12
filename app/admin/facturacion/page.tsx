'use client'

import { useState } from 'react'

interface FacturaResultado {
  cae: string
  caeFechaVto: string
  nroComprobante: number
  ptoVenta: number
  fecha: string
  importe: string
  ambiente: string
}

function generarHTMLFactura(r: FacturaResultado, cuit: string): string {
  const vto = r.caeFechaVto
    ? `${r.caeFechaVto.slice(0, 4)}-${r.caeFechaVto.slice(4, 6)}-${r.caeFechaVto.slice(6, 8)}`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Factura C N° ${String(r.ptoVenta).padStart(4,'0')}-${String(r.nroComprobante).padStart(8,'0')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
    .header { display: flex; justify-content: space-between; border: 2px solid #111; margin-bottom: 0; }
    .header-left { padding: 16px; flex: 1; border-right: 2px solid #111; }
    .header-center { padding: 16px 24px; text-align: center; border-right: 2px solid #111; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .header-right { padding: 16px; flex: 1; }
    .letra { font-size: 48px; font-weight: bold; border: 3px solid #111; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
    .tipo-cbte { font-size: 13px; font-weight: bold; }
    .empresa { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
    .section { border: 1px solid #111; padding: 10px 14px; margin-bottom: 0; border-top: 0; }
    .section:first-of-type { border-top: 2px solid #111; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 16px; }
    .label { color: #555; font-size: 10px; }
    .value { font-weight: bold; font-size: 11px; }
    .cae-section { border: 2px solid #111; padding: 12px 14px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
    .cae-label { font-size: 10px; color: #555; }
    .cae-value { font-weight: bold; font-size: 13px; letter-spacing: 1px; }
    .total-row { display: flex; justify-content: flex-end; border: 1px solid #111; border-top: 2px solid #111; padding: 10px 14px; }
    .total-label { font-size: 12px; margin-right: 24px; }
    .total-value { font-size: 16px; font-weight: bold; }
    .footer { margin-top: 10px; font-size: 9px; color: #777; text-align: center; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="empresa">Flow Things</div>
      <div>Librería y Juguetería</div>
      <div style="margin-top:6px">Domicilio comercial: Argentina</div>
      <div>CUIT: ${cuit}</div>
      <div style="margin-top:4px"><strong>Condición frente al IVA:</strong> Monotributo</div>
    </div>
    <div class="header-center">
      <div class="letra">C</div>
      <div class="tipo-cbte">FACTURA</div>
      <div style="margin-top:8px;font-size:10px">Cod. 11</div>
    </div>
    <div class="header-right">
      <div class="label">N° de comprobante</div>
      <div class="value" style="font-size:14px">${String(r.ptoVenta).padStart(4,'0')}-${String(r.nroComprobante).padStart(8,'0')}</div>
      <div style="margin-top:8px" class="label">Fecha de emisión</div>
      <div class="value">${r.fecha}</div>
      <div style="margin-top:8px" class="label">Punto de venta</div>
      <div class="value">${r.ptoVenta}</div>
    </div>
  </div>

  <div class="section" style="border-top:2px solid #111">
    <div class="grid2">
      <div>
        <div class="label">Razón social / Nombre</div>
        <div class="value">Consumidor Final</div>
      </div>
      <div>
        <div class="label">Condición IVA receptor</div>
        <div class="value">Consumidor Final</div>
      </div>
    </div>
  </div>

  <div class="section" style="margin-top:16px;border-top:1px solid #111">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:1px solid #111">
          <th style="text-align:left;padding:4px 0;font-size:10px;color:#555">Descripción</th>
          <th style="text-align:right;padding:4px 0;font-size:10px;color:#555">Cant.</th>
          <th style="text-align:right;padding:4px 0;font-size:10px;color:#555">Precio unit.</th>
          <th style="text-align:right;padding:4px 0;font-size:10px;color:#555">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 0">${r.importe.includes('prueba') ? 'Factura de prueba — Flow Things' : 'Productos Flow Things'}</td>
          <td style="text-align:right;padding:6px 0">1</td>
          <td style="text-align:right;padding:6px 0">${r.importe}</td>
          <td style="text-align:right;padding:6px 0">${r.importe}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="total-row">
    <span class="total-label">TOTAL</span>
    <span class="total-value">${r.importe}</span>
  </div>

  <div class="cae-section">
    <div>
      <div class="cae-label">CAE</div>
      <div class="cae-value">${r.cae}</div>
    </div>
    <div>
      <div class="cae-label">Fecha de vencimiento del CAE</div>
      <div class="value">${vto}</div>
    </div>
    <div>
      <div class="cae-label">Comprobante autorizado por AFIP</div>
      <div class="value" style="color:green">✔ VÁLIDO</div>
    </div>
  </div>

  <div class="footer">
    Comprobante generado electrónicamente. CAE otorgado por AFIP - ARCA.
    Flow Things · flowthings.com.ar
  </div>

  <script>window.onload = () => { window.print() }</script>
</body>
</html>`
}

export default function FacturacionAdminPage() {
  const [testing, setTesting] = useState(false)
  const [resultado, setResultado] = useState<FacturaResultado | null>(null)
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

  const handleDescargarPDF = () => {
    if (!resultado) return
    const html = generarHTMLFactura(resultado, '20462126701')
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
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

      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-2">Factura de prueba</h2>
        <p className="text-brand-text-muted text-sm mb-5">
          Emite una Factura C de <span className="text-white font-medium">$1</span> real en AFIP para verificar que la integración funciona correctamente.
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
          <div className="mt-4 bg-green-900/20 border border-green-700 rounded-xl p-4 space-y-3">
            <p className="text-green-400 font-semibold">✅ Factura emitida correctamente</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
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
            <button
              onClick={handleDescargarPDF}
              className="mt-2 w-full bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              📄 Descargar PDF
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
