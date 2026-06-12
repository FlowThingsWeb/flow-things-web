// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require('nodemailer')

// ─── Render ───────────────────────────────────────────────────────────────────

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

// ─── Transport ────────────────────────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendEmail(params: {
  to: string
  asunto: string
  cuerpo: string
  adjuntos?: { filename: string; content: string; encoding: 'base64'; contentType: string }[]
}): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[email] GMAIL_USER o GMAIL_APP_PASSWORD no configurados')
    return
  }
  const transporter = createTransport()
  await transporter.sendMail({
    from: `"Flow Things" <${process.env.GMAIL_USER}>`,
    to: params.to,
    subject: params.asunto,
    html: params.cuerpo,
    attachments: params.adjuntos?.map(a => ({
      filename: a.filename,
      content: a.content,
      encoding: a.encoding,
      contentType: a.contentType,
    })),
  })
}

// ─── Builders de HTML dinámico ────────────────────────────────────────────────

export function buildProductosFilas(
  items: { nombre: string; cantidad: number; precio: number }[]
): string {
  const fmt = (n: number) =>
    '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return items
    .map(
      (i) =>
        `<tr>
          <td style="font-size:14px;color:#111;padding:12px 0;border-bottom:1px solid #f0f0f0;line-height:1.4">${i.nombre}</td>
          <td style="font-size:14px;color:#666;text-align:center;padding:12px 0;border-bottom:1px solid #f0f0f0">${i.cantidad}</td>
          <td style="font-size:14px;color:#111;text-align:right;padding:12px 0;border-bottom:1px solid #f0f0f0;white-space:nowrap">${fmt(i.precio * i.cantidad)}</td>
        </tr>`
    )
    .join('')
}

export function buildDesgloseItems(
  items: { nombre: string; cantidad: number; precio: number }[]
): string {
  const fmt = (n: number) =>
    '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return items
    .map(
      (i) =>
        `<tr>
          <td style="font-size:14px;color:#374151;padding:5px 0">${i.nombre} &times; ${i.cantidad}</td>
          <td style="font-size:14px;color:#374151;text-align:right;padding:5px 0;font-weight:500;white-space:nowrap">${fmt(i.precio * i.cantidad)}</td>
        </tr>`
    )
    .join('')
}

export function buildFilaDescuento(codigo: string | null, monto: number): string {
  if (!monto || monto <= 0) return ''
  const fmt = (n: number) =>
    '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const label = codigo ? `Descuento (${codigo})` : 'Descuento'
  return `<tr>
    <td style="font-size:14px;color:#16a34a;padding:4px 0">&#x1F3F7; ${label}</td>
    <td style="font-size:14px;color:#16a34a;font-weight:600;text-align:right;padding:4px 0">- ${fmt(monto)}</td>
  </tr>`
}

export function buildTrackingBoton(trackingUrl: string, accentColor = '#7C3AED'): string {
  if (!trackingUrl) return ''
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px">
    <tr><td align="center">
      <a href="${trackingUrl}" target="_blank"
        style="display:inline-block;background:${accentColor};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:0.2px">
        &#x1F50D; Ver seguimiento en vivo
      </a>
    </td></tr>
  </table>`
}

// Formatea el medio de pago a partir del objeto payment de MercadoPago
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMedioPago(payment: any): string {
  const type   = payment?.payment_type_id   ?? ''
  const method = payment?.payment_method_id ?? ''
  const cuotas = payment?.installments      ?? 1
  const last4  = payment?.card?.last_four_digits ?? ''

  const brandNames: Record<string, string> = {
    visa: 'Visa', master: 'Mastercard', amex: 'American Express',
    naranja: 'Naranja', cabal: 'Cabal', diners: 'Diners Club',
    argencard: 'Argencard', cencosud: 'Cencosud', cordobesa: 'Cordobesa',
    maestro: 'Maestro',
  }
  const brand = brandNames[method] || method

  if (type === 'credit_card') {
    let result = `Tarjeta de crédito ${brand}`
    if (last4) result += ` terminada en ${last4}`
    result += cuotas > 1 ? ` · ${cuotas} cuotas` : ' · 1 pago'
    return result
  }
  if (type === 'debit_card') {
    let result = `Tarjeta de débito ${brand}`
    if (last4) result += ` terminada en ${last4}`
    return result
  }
  if (type === 'ticket')        return 'Pago en efectivo (Rapipago / Pago Fácil)'
  if (type === 'bank_transfer') return 'Transferencia bancaria'
  if (type === 'account_money') return 'Saldo en Mercado Pago'
  return brand || 'Mercado Pago'
}


// ─── Defaults (re-exportados desde email-constants para uso server-side) ──────
export { DEFAULT_EMAIL_ASUNTO, DEFAULT_EMAIL_CUERPO, DEFAULT_DESPACHO_ASUNTO, DEFAULT_DESPACHO_CUERPO } from './email-constants'
