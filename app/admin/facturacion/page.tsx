'use client'

import { useState } from 'react'

interface FacturaResultado {
  cae: string
  caeFechaVto: string
  nroComprobante: number
  ptoVenta: number
  cuit: number
  fecha: string
  fechaISO: string
  importe: string
  totalNumerico: number
  ambiente: string
  // datos de orden real (opcionales)
  cliente?: { nombre?: string; cuitDni?: string; direccion?: string; ciudad?: string; cp?: string }
  items?: { sku?: string; descripcion: string; cantidad: number; precioUnitario: number }[]
  costoEnvio?: number
}

// Número a palabras en español
function numeroALetras(n: number): string {
  const unidades = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
    'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
  const centenas = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

  function menorMil(num: number): string {
    if (num === 0) return ''
    if (num === 100) return 'cien'
    if (num < 30) return unidades[num]
    if (num < 100) {
      const d = Math.floor(num / 10)
      const u = num % 10
      return u === 0 ? decenas[d] : `${decenas[d]} y ${unidades[u]}`
    }
    const c = Math.floor(num / 100)
    const resto = num % 100
    const base = c === 1 && resto > 0 ? 'ciento' : centenas[c]
    return resto === 0 ? base : `${base} ${menorMil(resto)}`
  }

  const entero = Math.floor(n)
  const centavos = Math.round((n - entero) * 100)

  if (entero === 0) return 'cero pesos'

  let resultado = ''
  if (entero >= 1000000) {
    const m = Math.floor(entero / 1000000)
    resultado += m === 1 ? 'un millón ' : `${menorMil(m)} millones `
  }
  const miles = Math.floor((entero % 1000000) / 1000)
  if (miles > 0) {
    resultado += miles === 1 ? 'mil ' : `${menorMil(miles)} mil `
  }
  const resto = entero % 1000
  if (resto > 0) resultado += menorMil(resto) + ' '

  resultado = resultado.trim() + (entero === 1 ? ' peso' : ' pesos')
  if (centavos > 0) resultado += ` con ${centavos} centavos`
  return resultado
}

function fmtFecha(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`
}

function fmtMoneda(n: number): string {
  return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function generarQRData(r: FacturaResultado): string {
  const obj = {
    ver: 1,
    fecha: r.fechaISO,
    cuit: r.cuit,
    ptoVta: r.ptoVenta,
    tipoCmp: 11,
    nroCmp: r.nroComprobante,
    importe: r.totalNumerico,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: 99,
    nroDocRec: 0,
    tipoCodAut: 'E',
    codAut: Number(r.cae),
  }
  return btoa(JSON.stringify(obj))
}

function generarHTMLFactura(r: FacturaResultado): string {
  const nroCbte = `${String(r.ptoVenta).padStart(4, '0')}-${String(r.nroComprobante).padStart(8, '0')}`
  const vtoCAE = fmtFecha(r.caeFechaVto)
  const totalFmt = fmtMoneda(r.totalNumerico)
  const letras = numeroALetras(r.totalNumerico)
  const qrData = generarQRData(r)
  const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrData}`
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrUrl)}`
  const logoUrl = 'https://flow-things-web.vercel.app/logo.png'

  const cliente = r.cliente
  const items = r.items || [{ sku: '–', descripcion: 'Factura de prueba – Flow Things', cantidad: 1, precioUnitario: r.totalNumerico }]
  const costoEnvio = r.costoEnvio ?? 0

  const itemsHTML = items.map(it => `
    <tr>
      <td>${it.sku || '–'}</td>
      <td>${it.descripcion}</td>
      <td class="right">${it.cantidad}</td>
      <td class="right">${fmtMoneda(it.precioUnitario)}</td>
      <td class="right">${fmtMoneda(it.cantidad * it.precioUnitario)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Factura C ${nroCbte}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size:11px; color:#111; background:#fff; }
    .page { max-width:800px; margin:0 auto; padding:20px; }

    /* HEADER */
    .header { display:flex; border:1.5px solid #333; }
    .h-left  { flex:1; padding:14px 16px; border-right:1.5px solid #333; }
    .h-mid   { padding:12px 20px; text-align:center; border-right:1.5px solid #333; display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:110px; }
    .h-right { flex:1; padding:14px 16px; }
    .logo    { height:48px; width:auto; margin-bottom:4px; }
    .empresa-nombre { font-size:18px; font-weight:bold; margin-bottom:2px; }
    .empresa-sub    { font-size:11px; color:#444; margin-bottom:6px; }
    .empresa-dir    { font-size:9.5px; color:#555; line-height:1.4; }
    .letra-box { border:2.5px solid #333; width:60px; height:60px; display:flex; align-items:center; justify-content:center; font-size:44px; font-weight:bold; margin-bottom:4px; }
    .original-tag { font-size:11px; margin-bottom:6px; color:#333; }
    .cod-tag  { font-size:10px; color:#555; margin-top:2px; }
    .h-right .row { margin-bottom:4px; font-size:11px; }
    .h-right .row strong { font-weight:bold; }

    /* CLIENTE */
    .cliente { display:flex; border:1.5px solid #333; border-top:0; }
    .cli-left  { flex:1; padding:12px 16px; border-right:1.5px solid #333; }
    .cli-right { flex:1; padding:12px 16px; }
    .cli-row   { margin-bottom:5px; font-size:11px; }
    .cli-row strong { font-weight:bold; }

    /* TABLA ITEMS */
    .items-section { border:1.5px solid #333; border-top:0; }
    table { width:100%; border-collapse:collapse; }
    thead tr { border-bottom:1px solid #999; background:#f5f5f5; }
    thead th { padding:6px 8px; font-size:9.5px; text-transform:uppercase; font-weight:bold; color:#333; text-align:left; }
    thead th.right { text-align:right; }
    tbody tr { border-bottom:1px solid #eee; }
    tbody td { padding:7px 8px; font-size:11px; }
    td.right { text-align:right; }
    tbody tr:last-child { border-bottom:none; }

    /* FOOTER */
    .footer-row { display:flex; border:1.5px solid #333; border-top:0; min-height:160px; }
    .qr-section { padding:14px 16px; border-right:1.5px solid #333; width:200px; }
    .qr-section img { display:block; margin-bottom:8px; }
    .cae-text { font-size:10px; margin-bottom:3px; }
    .cae-text strong { font-weight:bold; }
    .totales { flex:1; padding:14px 16px; }
    .total-line { display:flex; justify-content:space-between; padding:5px 0; font-size:12px; }
    .total-line.border-top { border-top:1px solid #ccc; }
    .total-line.grande { font-weight:bold; font-size:13px; border-top:1.5px solid #333; padding-top:7px; margin-top:2px; }
    .letras { font-size:10px; color:#333; margin-top:8px; }
    .letras strong { font-weight:bold; }
    .moneda-row { text-align:right; border:1.5px solid #333; border-top:0; padding:6px 16px; font-size:11px; }
    .moneda-row strong { font-weight:bold; }

    @page { size:A4; margin:0; }
    @media print {
      body { padding:12mm 15mm; }
      .page { padding:0; max-width:none; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="h-left">
      <img src="${logoUrl}" class="logo" alt="Flow Things" onerror="this.style.display='none'"/>
      <div class="empresa-nombre">Flow Things</div>
      <div class="empresa-sub">Monotributo</div>
      <div class="empresa-dir">GALLARDO ANGEL AV. 160 Ciudad Autonoma Buenos Aires,<br>CP: 1405 CIUDAD AUTONOMA BUENOS AIRES AR</div>
    </div>
    <div class="h-mid">
      <div class="original-tag">Original</div>
      <div class="letra-box">C</div>
      <div class="cod-tag">011</div>
    </div>
    <div class="h-right">
      <div class="row"><strong>FACTURA:</strong> ${nroCbte}</div>
      <div class="row"><strong>Fecha de Emisión:</strong> ${r.fecha}</div>
      <div class="row"><strong>Fecha de Vencimiento:</strong> ${r.fecha}</div>
      <div class="row"><strong>CUIT:</strong> ${r.cuit}</div>
      <div class="row"><strong>Ing. Brutos C.M:</strong> ${r.cuit}</div>
      <div class="row"><strong>Inicio de Actividad:</strong> 01/04/2026</div>
      <div class="row"><strong>Razón social:</strong> BARMAN LUCAS</div>
    </div>
  </div>

  <!-- CLIENTE -->
  <div class="cliente">
    <div class="cli-left">
      <div class="cli-row"><strong>Nombre:</strong> ${cliente?.nombre || 'Consumidor Final'}</div>
      <div class="cli-row"><strong>CUIT/DNI/CUIL:</strong> ${cliente?.cuitDni || '–'}</div>
      <div class="cli-row"><strong>Dirección:</strong> ${cliente?.direccion || '–'}</div>
      <div class="cli-row"><strong>Ciudad:</strong> ${cliente?.ciudad || '–'}</div>
      <div class="cli-row"><strong>Localidad:</strong></div>
    </div>
    <div class="cli-right">
      <div class="cli-row"><strong>IVA:</strong> Consumidor Final</div>
      <div class="cli-row"><strong>CP:</strong> ${cliente?.cp || '–'}</div>
      <div class="cli-row"><strong>Tel:</strong></div>
      <div class="cli-row"><strong>Condición de Venta:</strong> Contado</div>
      <div class="cli-row"><strong>Método de pago:</strong> Mercado Pago</div>
    </div>
  </div>

  <!-- ITEMS -->
  <div class="items-section">
    <table>
      <thead>
        <tr>
          <th style="width:60px">SKU</th>
          <th>Descripción</th>
          <th class="right" style="width:70px">Cantidad</th>
          <th class="right" style="width:110px">Precio Unitario</th>
          <th class="right" style="width:110px">Importe Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
        <tr>
          <td>–</td>
          <td>Costo Envío</td>
          <td class="right">–</td>
          <td class="right">–</td>
          <td class="right">${costoEnvio > 0 ? fmtMoneda(costoEnvio) : '0.00'}</td>
        </tr>
        <tr style="height:20px"><td colspan="5"></td></tr>
        <tr style="height:20px"><td colspan="5"></td></tr>
      </tbody>
    </table>
  </div>

  <!-- FOOTER -->
  <div class="footer-row">
    <div class="qr-section">
      <img src="${qrImgUrl}" width="130" height="130" alt="QR AFIP"/>
      <div class="cae-text"><strong>CAE:</strong> ${r.cae}</div>
      <div class="cae-text"><strong>Vencimiento CAE:</strong> ${vtoCAE}</div>
    </div>
    <div class="totales">
      <div class="total-line">
        <span>Importe Subtotal</span>
        <span>${totalFmt}</span>
      </div>
      <div class="total-line border-top">
        <span>Importe Otros Impuestos</span>
        <span>–</span>
      </div>
      <div class="total-line grande">
        <span>Importe Total</span>
        <span>${totalFmt}</span>
      </div>
      <div class="letras"><strong>Importe en Letras:</strong> ${letras}</div>
    </div>
  </div>

  <div class="moneda-row"><strong>Moneda:</strong> Pesos Argentinos</div>

</div>
<script>
  // Esperar que el QR cargue antes de imprimir
  window.onload = function() {
    var imgs = document.querySelectorAll('img')
    var loaded = 0
    var total = imgs.length
    if (total === 0) { window.print(); return; }
    imgs.forEach(function(img) {
      if (img.complete) { loaded++; if (loaded === total) window.print(); }
      else {
        img.onload = img.onerror = function() { loaded++; if (loaded === total) window.print(); }
      }
    })
  }
</script>
</body>
</html>`
}

export default function FacturacionAdminPage() {
  const [testing, setTesting] = useState(false)
  const [resultado, setResultado] = useState<FacturaResultado | null>(null)
  const [error, setError] = useState('')
  const [emailTest, setEmailTest] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

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

  const handleEnviarEmail = async () => {
    if (!emailTest || !resultado) return
    setSendingEmail(true)
    setEmailMsg('Generando PDF...')
    try {
      // Generar PDF cliente-side con jsPDF
      let pdfBase64: string | undefined
      try {
        const { jsPDF } = await import('jspdf')
        const r = resultado
        const nroCbte = `${String(r.ptoVenta).padStart(4,'0')}-${String(r.nroComprobante).padStart(8,'0')}`
        const vtoCAE = fmtFecha(r.caeFechaVto)
        const items = r.items || [{ sku:'–', descripcion:'Factura de prueba – Flow Things', cantidad:1, precioUnitario:r.totalNumerico }]

        const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
        const W = 210

        // Header morado
        doc.setFillColor(124, 58, 237)
        doc.rect(0, 0, W, 28, 'F')
        doc.setTextColor(255,255,255)
        doc.setFontSize(18); doc.setFont('helvetica','bold')
        doc.text('Flow Things', 14, 18)
        doc.setFontSize(14)
        doc.text('FACTURA C', W/2, 18, { align:'center' })
        doc.setFontSize(10); doc.setFont('helvetica','normal')
        doc.text('Comprobante Nro: ' + nroCbte, W-14, 18, { align:'right' })

        // Info empresa / comprobante
        doc.setTextColor(0,0,0)
        doc.setFontSize(9)
        let y = 36
        doc.setFont('helvetica','bold'); doc.text('Emisor', 14, y)
        doc.setFont('helvetica','normal')
        doc.text('BARMAN LUCAS · CUIT: ' + r.cuit, 14, y+5)
        doc.text('Monotributo · Av. Gallardo 160, CABA', 14, y+10)
        doc.text('Inicio de actividad: 01/04/2026', 14, y+15)

        doc.setFont('helvetica','bold'); doc.text('Datos del comprobante', W/2+5, y)
        doc.setFont('helvetica','normal')
        doc.text('Fecha de emisión: ' + r.fecha, W/2+5, y+5)
        doc.text('Punto de venta: ' + String(r.ptoVenta).padStart(4,'0'), W/2+5, y+10)
        doc.text('Nro comprobante: ' + String(r.nroComprobante).padStart(8,'0'), W/2+5, y+15)

        // Línea separadora
        y += 24
        doc.setDrawColor(200,200,200); doc.line(14, y, W-14, y)

        // Cliente
        y += 7
        doc.setFont('helvetica','bold'); doc.text('Receptor', 14, y)
        doc.setFont('helvetica','normal'); y += 5
        doc.text('Nombre: ' + (r.cliente?.nombre || 'Consumidor Final'), 14, y); y += 5
        doc.text('CUIT/DNI: ' + (r.cliente?.cuitDni || '–'), 14, y); y += 5
        doc.text('Condición IVA: Consumidor Final · Condición de venta: Contado', 14, y)

        // Línea
        y += 8; doc.line(14, y, W-14, y)

        // Tabla items — header
        y += 7
        doc.setFillColor(245,245,245); doc.rect(14, y-5, W-28, 8, 'F')
        doc.setFont('helvetica','bold'); doc.setFontSize(8)
        doc.text('Descripción', 16, y)
        doc.text('Cant.', 130, y, { align:'right' })
        doc.text('Precio unit.', 163, y, { align:'right' })
        doc.text('Subtotal', W-16, y, { align:'right' })

        // Tabla items — filas
        doc.setFont('helvetica','normal'); doc.setFontSize(9); y += 6
        for (const it of items) {
          doc.text(it.descripcion, 16, y)
          doc.text(String(it.cantidad), 130, y, { align:'right' })
          doc.text(fmtMoneda(it.precioUnitario), 163, y, { align:'right' })
          doc.text(fmtMoneda(it.cantidad * it.precioUnitario), W-16, y, { align:'right' })
          y += 7
          if (y > 240) { doc.addPage(); y = 20 }
        }

        // Total
        y += 3; doc.line(14, y, W-14, y); y += 7
        doc.setFont('helvetica','bold'); doc.setFontSize(11)
        doc.text('TOTAL:', W-70, y)
        doc.setTextColor(124,58,237)
        doc.text(fmtMoneda(r.totalNumerico), W-16, y, { align:'right' })
        doc.setTextColor(0,0,0)
        doc.setFontSize(8); doc.setFont('helvetica','normal')
        y += 6
        doc.text('Son: ' + numeroALetras(r.totalNumerico).toUpperCase(), 14, y)

        // CAE
        y += 12; doc.line(14, y, W-14, y); y += 7
        doc.setFontSize(9); doc.setFont('helvetica','bold')
        doc.text('CAE: ' + r.cae, 14, y)
        doc.setFont('helvetica','normal')
        doc.text('Vencimiento CAE: ' + vtoCAE, 14, y+6)
        doc.text('Moneda: Pesos Argentinos (PES)', 14, y+12)

        // Footer
        doc.setFontSize(7); doc.setTextColor(150,150,150)
        doc.text('Comprobante generado por Flow Things · flowthings.com.ar', W/2, 287, { align:'center' })

        pdfBase64 = doc.output('datauristring').split(',')[1]
      } catch (pdfErr) {
        console.warn('No se pudo generar PDF, se enviará sin adjunto:', pdfErr)
      }

      setEmailMsg('Enviando...')
      const res = await fetch('/api/admin/factura-prueba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTest, facturaData: resultado, pdfBase64 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconocido')
      setEmailMsg(pdfBase64 ? '✅ Email enviado con la factura adjunta' : '✅ Email enviado (sin adjunto PDF)')
    } catch (e: any) {
      setEmailMsg('❌ ' + e.message)
    } finally {
      setSendingEmail(false)
    }
  }

  const handleDescargarPDF = () => {
    if (!resultado) return
    const html = generarHTMLFactura(resultado)
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
          {['Certificado AFIP configurado', 'Factura C automática al aprobar pago', 'CAE guardado en cada orden'].map(t => (
            <div key={t} className="flex items-center gap-2">
              <span className="text-green-400">✅</span>
              <span className="text-brand-text">{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-2">Factura de prueba</h2>
        <p className="text-brand-text-muted text-sm mb-5">
          Emite una Factura C de <span className="text-white font-medium">$1</span> real en AFIP con tu CAE y genera el PDF con tu logo.
        </p>

        <button
          onClick={handlePrueba}
          disabled={testing}
          className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
        >
          {testing ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Emitiendo...</>
          ) : '🧾 Emitir factura de prueba'}
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
              <span className="text-brand-text-muted">Punto de venta</span><span className="text-white">{resultado.ptoVenta}</span>
              <span className="text-brand-text-muted">Nro comprobante</span><span className="text-white">{resultado.nroComprobante}</span>
              <span className="text-brand-text-muted">Fecha</span><span className="text-white">{resultado.fecha}</span>
              <span className="text-brand-text-muted">CAE</span><span className="text-brand-neon font-mono text-xs">{resultado.cae}</span>
              <span className="text-brand-text-muted">Vto. CAE</span><span className="text-white">{fmtFecha(resultado.caeFechaVto)}</span>
            </div>
            <button
              onClick={handleDescargarPDF}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              📄 Ver / Descargar PDF
            </button>
            <div className="pt-2 space-y-2">
              <p className="text-white text-sm font-medium">Enviar email de prueba</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailTest}
                  onChange={e => setEmailTest(e.target.value)}
                  placeholder="destinatario@ejemplo.com"
                  className="flex-1 bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple placeholder:text-brand-text-muted"
                />
                <button
                  onClick={handleEnviarEmail}
                  disabled={sendingEmail || !emailTest}
                  className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-sm whitespace-nowrap"
                >
                  {sendingEmail ? 'Enviando...' : '✉️ Enviar'}
                </button>
              </div>
              {emailMsg && (
                <p className={`text-sm ${emailMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                  {emailMsg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
