/**
 * Generador de PDF de factura — funciona en cliente (browser) y servidor (Node.js).
 * Replica fielmente el layout HTML de generarHTMLFactura (lib/afip-layout).
 * Usa jsPDF + qrcode. No necesita puppeteer ni html2canvas.
 */

export interface FacturaPDFParams {
  nroComprobante: number
  ptoVenta:       number
  cuit:           number
  fecha:          string       // "12/6/2026"
  fechaISO?:      string       // "2026-06-12" (para QR AFIP)
  caeFechaVto:    string       // "20260622"
  cae:            string
  totalNumerico:  number
  cliente?: {
    nombre?:    string
    cuitDni?:   string
    direccion?: string
    ciudad?:    string
    cp?:        string
  }
  items: { sku?: string; descripcion: string; cantidad: number; precioUnitario: number }[]
  costoEnvio?: number
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtMoneda(n: number): string {
  return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtFecha(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`
}

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
  if (miles > 0) resultado += miles === 1 ? 'mil ' : `${menorMil(miles)} mil `
  const resto = entero % 1000
  if (resto > 0) resultado += menorMil(resto) + ' '

  resultado = resultado.trim() + (entero === 1 ? ' peso' : ' pesos')
  if (centavos > 0) resultado += ` con ${centavos} centavos`
  return resultado
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const ext = url.split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${btoa(binary)}`
  } catch {
    return null
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateFacturaPDFBase64(p: FacturaPDFParams): Promise<string> {
  const { jsPDF } = await import('jspdf')

  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W    = 210   // page width
  const ML   = 10    // left margin
  const MR   = 10    // right margin
  const CW   = W - ML - MR  // content width = 190mm
  const costoEnvio = p.costoEnvio ?? 0
  const nroCbte = `${String(p.ptoVenta).padStart(4, '0')}-${String(p.nroComprobante).padStart(8, '0')}`

  // Fetch logo & QR in parallel
  const [logoDataUrl, QRCode] = await Promise.all([
    fetchAsDataUrl('https://flow-things-web.vercel.app/logo.png'),
    import('qrcode').then(m => m.default),
  ])

  const qrObj = {
    ver: 1,
    fecha: p.fechaISO ?? p.fecha.split('/').reverse().join('-'),
    cuit: p.cuit, ptoVta: p.ptoVenta, tipoCmp: 11,
    nroCmp: p.nroComprobante, importe: p.totalNumerico,
    moneda: 'PES', ctz: 1, tipoDocRec: 99, nroDocRec: 0,
    tipoCodAut: 'E', codAut: Number(p.cae),
  }
  const qrAfipUrl = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(qrObj))}`
  const qrDataUrl: string = await QRCode.toDataURL(qrAfipUrl, { width: 200, margin: 1 })

  // ─── Colors & helpers ─────────────────────────────────────
  const setBorder = () => { doc.setDrawColor(51, 51, 51); doc.setLineWidth(0.4) }
  const setGray   = () => doc.setTextColor(80, 80, 80)
  const setBlack  = () => doc.setTextColor(0, 0, 0)
  const setPurple = () => doc.setTextColor(124, 58, 237)

  let y = ML

  // ─── HEADER (logo | C box | datos) ────────────────────────
  const hdrH   = 40
  const leftW  = 68   // empresa section width
  const midW   = 28   // C box section width
  const rightX = ML + leftW + midW  // start of right section

  setBorder()
  doc.rect(ML, y, CW, hdrH)
  doc.line(ML + leftW,        y, ML + leftW,        y + hdrH)
  doc.line(ML + leftW + midW, y, ML + leftW + midW, y + hdrH)

  // Left: logo + company info
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', ML + 2, y + 2, 22, 11) } catch {}
  }
  setBlack()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text('Flow Things', ML + 2, y + 18)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text('Monotributo', ML + 2, y + 23)
  doc.setFontSize(7)
  doc.text('GALLARDO ANGEL AV. 160', ML + 2, y + 28)
  doc.text('Ciudad Autonoma Buenos Aires', ML + 2, y + 32)
  doc.text('CP: 1405 CABA AR', ML + 2, y + 36)

  // Center: Original / C / 011
  const midCX = ML + leftW + midW / 2
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setBlack()
  doc.text('Original', midCX, y + 8, { align: 'center' })

  // Big "C" box
  setBorder(); doc.setLineWidth(1.2)
  const boxX = ML + leftW + 5
  const boxY = y + 10
  const boxS = midW - 10
  doc.rect(boxX, boxY, boxS, boxS)
  doc.setLineWidth(0.4)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); setBlack()
  doc.text('C', midCX, boxY + boxS * 0.72, { align: 'center' })

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text('011', midCX, y + hdrH - 3, { align: 'center' })

  // Right: factura data
  const rx = rightX + 3
  const lineH = 5.4
  doc.setFontSize(8); setBlack()
  const rows: [string, string][] = [
    ['FACTURA:', nroCbte],
    ['Fecha de Emisión:', p.fecha],
    ['Fecha de Vencimiento:', p.fecha],
    ['CUIT:', String(p.cuit)],
    ['Ing. Brutos C.M:', String(p.cuit)],
    ['Inicio de Actividad:', '01/04/2026'],
    ['Razón social:', 'BARMAN LUCAS'],
  ]
  rows.forEach(([label, value], i) => {
    const ry = y + 7 + i * lineH
    doc.setFont('helvetica', 'bold');  doc.text(label, rx, ry)
    doc.setFont('helvetica', 'normal'); doc.text(value, rx + 38, ry)
  })

  y += hdrH

  // ─── CLIENTE ──────────────────────────────────────────────
  const cliH  = 30
  const cliMX = ML + CW / 2

  setBorder()
  doc.rect(ML, y, CW, cliH)
  doc.line(cliMX, y, cliMX, y + cliH)

  const nombre   = p.cliente?.nombre    || 'Consumidor Final'
  const cuitDni  = p.cliente?.cuitDni   || '–'
  const direccion = p.cliente?.direccion || '–'
  const ciudad   = p.cliente?.ciudad    || '–'

  const cliRows: [string, string][] = [
    ['Nombre:', nombre],
    ['CUIT/DNI/CUIL:', cuitDni],
    ['Dirección:', direccion],
    ['Ciudad:', ciudad],
    ['Localidad:', ''],
  ]
  doc.setFontSize(8)
  cliRows.forEach(([label, val], i) => {
    const cy = y + 6 + i * 5
    doc.setFont('helvetica', 'bold'); doc.text(label, ML + 3, cy)
    doc.setFont('helvetica', 'normal'); if (val) doc.text(val, ML + 28, cy)
  })

  const rightCliRows: [string, string][] = [
    ['IVA:', 'Consumidor Final'],
    ['CP:', p.cliente?.cp || '–'],
    ['Tel:', ''],
    ['Condición de Venta:', 'Contado'],
    ['Método de pago:', 'Mercado Pago'],
  ]
  rightCliRows.forEach(([label, val], i) => {
    const cy = y + 6 + i * 5
    doc.setFont('helvetica', 'bold'); doc.text(label, cliMX + 3, cy)
    doc.setFont('helvetica', 'normal'); if (val) doc.text(val, cliMX + 36, cy)
  })

  y += cliH

  // ─── ITEMS TABLE ──────────────────────────────────────────
  const colSku  = ML + 3
  const colDesc = ML + 16
  const colQty  = ML + CW * 0.60
  const colUp   = ML + CW * 0.75
  const colSub  = ML + CW - 3
  const rowH    = 7

  // Header
  doc.setFillColor(245, 245, 245)
  doc.rect(ML, y, CW, rowH, 'FD')
  setGray(); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  doc.text('SKU',                colSku,  y + 5)
  doc.text('DESCRIPCIÓN',        colDesc, y + 5)
  doc.text('CANTIDAD',           colQty,  y + 5, { align: 'right' })
  doc.text('PRECIO UNITARIO',    colUp,   y + 5, { align: 'right' })
  doc.text('IMPORTE SUBTOTAL',   colSub,  y + 5, { align: 'right' })
  y += rowH

  // Item rows
  setBlack(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  setBorder()
  for (const item of p.items) {
    doc.text(item.sku || '–',                          colSku,  y + 5)
    doc.text(item.descripcion.substring(0, 48),        colDesc, y + 5)
    doc.text(String(item.cantidad),                    colQty,  y + 5, { align: 'right' })
    doc.text(fmtMoneda(item.precioUnitario),            colUp,   y + 5, { align: 'right' })
    doc.text(fmtMoneda(item.cantidad * item.precioUnitario), colSub, y + 5, { align: 'right' })
    doc.line(ML, y + rowH, ML + CW, y + rowH)
    y += rowH
  }

  // Costo envío row
  const envioFmt = costoEnvio > 0 ? fmtMoneda(costoEnvio) : '0.00'
  doc.text('–',        colSku,  y + 5)
  doc.text('Costo Envío', colDesc, y + 5)
  doc.text('–',        colQty,  y + 5, { align: 'right' })
  doc.text('–',        colUp,   y + 5, { align: 'right' })
  doc.text(envioFmt,   colSub,  y + 5, { align: 'right' })
  doc.line(ML, y + rowH, ML + CW, y + rowH)
  y += rowH

  // Empty filler rows
  y += rowH * 2

  // Bottom border of table
  doc.rect(ML, y - rowH * 9 - hdrH - cliH + hdrH + cliH, CW, y - (ML + hdrH + cliH), '')
  // Actually just draw a rect around the table area
  setBorder()
  const tableTop = ML + hdrH + cliH
  doc.rect(ML, tableTop, CW, y - tableTop)

  // ─── FOOTER (QR | totales) ────────────────────────────────
  const footH = 48
  const qrSecW = 52  // QR section width

  setBorder()
  doc.rect(ML, y, CW, footH)
  doc.line(ML + qrSecW, y, ML + qrSecW, y + footH)

  // QR image
  try { doc.addImage(qrDataUrl, 'PNG', ML + 3, y + 3, 34, 34) } catch {}

  // CAE text
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold'); setBlack()
  doc.text('CAE:', ML + 3, y + 40)
  doc.setFont('helvetica', 'normal')
  doc.text(p.cae, ML + 12, y + 40)
  doc.setFont('helvetica', 'bold')
  doc.text('Vencimiento CAE:', ML + 3, y + 46)
  doc.setFont('helvetica', 'normal')
  doc.text(fmtFecha(p.caeFechaVto), ML + 34, y + 46)

  // Totals (right side)
  const totX = ML + qrSecW + 4
  const totR = ML + CW - 3
  const totalFmt = fmtMoneda(p.totalNumerico)
  const letras = 'Importe en Letras: ' + numeroALetras(p.totalNumerico)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal'); setBlack()

  doc.text('Importe Subtotal',         totX, y + 10)
  doc.text(totalFmt,                   totR, y + 10, { align: 'right' })
  setBorder(); doc.line(totX, y + 12, totR, y + 12)

  doc.text('Importe Otros Impuestos',  totX, y + 19)
  doc.text('–',                        totR, y + 19, { align: 'right' })
  doc.line(totX, y + 21, totR, y + 21)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('Importe Total',            totX, y + 29)
  setPurple()
  doc.text(totalFmt,                   totR, y + 29, { align: 'right' })
  setBlack()

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text(letras, totX, y + 37)

  y += footH

  // ─── MONEDA ───────────────────────────────────────────────
  setBorder()
  doc.rect(ML, y, CW, 8)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setBlack()
  doc.text('Moneda:', totR - 36, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.text('Pesos Argentinos', totR, y + 5, { align: 'right' })

  return doc.output('datauristring').split(',')[1]
}

export function facturaFileName(nroComprobante: number): string {
  return `FACTURA #${nroComprobante}.pdf`
}
