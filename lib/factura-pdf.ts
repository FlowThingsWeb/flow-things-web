// Generador de PDF de factura — funciona en cliente (browser) y servidor (Node.js)
// Usa jsPDF dinámicamente para que Next.js no lo bundle en el server por defecto

export interface FacturaPDFParams {
  nroComprobante: number
  ptoVenta: number
  cuit: number
  fecha: string
  caeFechaVto: string
  cae: string
  totalNumerico: number
  cliente?: { nombre?: string; cuitDni?: string; direccion?: string; ciudad?: string; cp?: string }
  items: { sku?: string; descripcion: string; cantidad: number; precioUnitario: number }[]
  costoEnvio?: number
}

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

/**
 * Genera el PDF de la factura y retorna el base64 (sin el prefijo data:...;base64,)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateFacturaPDFBase64(p: FacturaPDFParams): Promise<string> {
  // Dynamic import — funciona en cliente y en Node.js (Vercel serverless)
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const nroCbte = `${String(p.ptoVenta).padStart(4, '0')}-${String(p.nroComprobante).padStart(8, '0')}`
  const vtoCAE = fmtFecha(p.caeFechaVto)
  const costoEnvio = p.costoEnvio ?? 0

  // ── Header morado ─────────────────────────────────────────────────────────
  doc.setFillColor(124, 58, 237)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text('Flow Things', 14, 18)
  doc.setFontSize(14)
  doc.text('FACTURA C', W / 2, 18, { align: 'center' })
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text('Comprobante Nro: ' + nroCbte, W - 14, 18, { align: 'right' })

  // ── Info empresa / comprobante ────────────────────────────────────────────
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  let y = 36
  doc.setFont('helvetica', 'bold'); doc.text('Emisor', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text('BARMAN LUCAS · CUIT: ' + p.cuit, 14, y + 5)
  doc.text('Monotributo · Av. Gallardo 160, CABA', 14, y + 10)
  doc.text('Inicio de actividad: 01/04/2026', 14, y + 15)

  doc.setFont('helvetica', 'bold'); doc.text('Datos del comprobante', W / 2 + 5, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Fecha de emisión: ' + p.fecha, W / 2 + 5, y + 5)
  doc.text('Punto de venta: ' + String(p.ptoVenta).padStart(4, '0'), W / 2 + 5, y + 10)
  doc.text('Nro comprobante: ' + String(p.nroComprobante).padStart(8, '0'), W / 2 + 5, y + 15)

  // ── Separador ─────────────────────────────────────────────────────────────
  y += 24
  doc.setDrawColor(200, 200, 200); doc.line(14, y, W - 14, y)

  // ── Cliente ───────────────────────────────────────────────────────────────
  y += 7
  doc.setFont('helvetica', 'bold'); doc.text('Receptor', 14, y)
  doc.setFont('helvetica', 'normal'); y += 5
  doc.text('Nombre: ' + (p.cliente?.nombre || 'Consumidor Final'), 14, y); y += 5
  doc.text('CUIT/DNI: ' + (p.cliente?.cuitDni || '–'), 14, y); y += 5
  doc.text('Condición IVA: Consumidor Final · Condición de venta: Contado', 14, y)

  // ── Tabla items ───────────────────────────────────────────────────────────
  y += 8; doc.line(14, y, W - 14, y); y += 7
  doc.setFillColor(245, 245, 245); doc.rect(14, y - 5, W - 28, 8, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('Descripción', 16, y)
  doc.text('Cant.', 130, y, { align: 'right' })
  doc.text('Precio unit.', 163, y, { align: 'right' })
  doc.text('Subtotal', W - 16, y, { align: 'right' })

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); y += 6

  for (const it of p.items) {
    doc.text(it.descripcion, 16, y)
    doc.text(String(it.cantidad), 130, y, { align: 'right' })
    doc.text(fmtMoneda(it.precioUnitario), 163, y, { align: 'right' })
    doc.text(fmtMoneda(it.cantidad * it.precioUnitario), W - 16, y, { align: 'right' })
    y += 7
    if (y > 240) { doc.addPage(); y = 20 }
  }

  if (costoEnvio > 0) {
    doc.text('Costo de envío', 16, y)
    doc.text('1', 130, y, { align: 'right' })
    doc.text(fmtMoneda(costoEnvio), 163, y, { align: 'right' })
    doc.text(fmtMoneda(costoEnvio), W - 16, y, { align: 'right' })
    y += 7
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  y += 3; doc.line(14, y, W - 14, y); y += 7
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text('TOTAL:', W - 70, y)
  doc.setTextColor(124, 58, 237)
  doc.text(fmtMoneda(p.totalNumerico), W - 16, y, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  y += 6
  doc.text('Son: ' + numeroALetras(p.totalNumerico).toUpperCase(), 14, y)

  // ── CAE ───────────────────────────────────────────────────────────────────
  y += 12; doc.line(14, y, W - 14, y); y += 7
  doc.setFontSize(9); doc.setFont('helvetica', 'bold')
  doc.text('CAE: ' + p.cae, 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Vencimiento CAE: ' + vtoCAE, 14, y + 6)
  doc.text('Moneda: Pesos Argentinos (PES)', 14, y + 12)

  // ── Pie de página ─────────────────────────────────────────────────────────
  doc.setFontSize(7); doc.setTextColor(150, 150, 150)
  doc.text('Comprobante generado por Flow Things · flowthings.com.ar', W / 2, 287, { align: 'center' })

  return doc.output('datauristring').split(',')[1]
}

/**
 * Nombre estándar para el archivo PDF de una factura
 */
export function facturaFileName(nroComprobante: number): string {
  return `FACTURA #${nroComprobante}.pdf`
}
