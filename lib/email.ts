import { formatMonto } from './format'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require('nodemailer')

// ─── Render ───────────────────────────────────────────────────────────────────

/** Escapa caracteres HTML para evitar inyección al interpolar texto del usuario. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

// Claves cuyos valores son fragmentos HTML construidos por nosotros (no se escapan).
// El resto se escapa por defecto, incluyendo datos del comprador (nombre, etc.).
const HTML_VAR_KEYS = new Set([
  'productos_filas',
  'desglose_items',
  'fila_descuento',
  'tracking_boton',
])

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key]
    if (val == null) return `{{${key}}}`
    return HTML_VAR_KEYS.has(key) ? val : escapeHtml(val)
  })
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

// Copia oculta de TODOS los mails salientes (factura, venta, envío, promo,
// cumpleaños, etc.) a la casilla del comercio. Configurable por env.
const EMAIL_BCC = process.env.EMAIL_COPIA_BCC || 'contacto@flowthings.com.ar'

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
  // No duplicar si el destinatario ya es la propia casilla de copia.
  const bcc = EMAIL_BCC && params.to.toLowerCase() !== EMAIL_BCC.toLowerCase()
    ? EMAIL_BCC
    : undefined
  await transporter.sendMail({
    from: `"Flow Things" <${process.env.GMAIL_USER}>`,
    to: params.to,
    bcc,
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
  const fmt = formatMonto
  return items
    .map(
      (i) =>
        `<tr>
          <td style="font-size:14px;color:#111;padding:12px 0;border-bottom:1px solid #f0f0f0;line-height:1.4">${escapeHtml(i.nombre)}</td>
          <td style="font-size:14px;color:#666;text-align:center;padding:12px 0;border-bottom:1px solid #f0f0f0">${i.cantidad}</td>
          <td style="font-size:14px;color:#111;text-align:right;padding:12px 0;border-bottom:1px solid #f0f0f0;white-space:nowrap">${fmt(i.precio * i.cantidad)}</td>
        </tr>`
    )
    .join('')
}

export function buildDesgloseItems(
  items: { nombre: string; cantidad: number; precio: number }[]
): string {
  const fmt = formatMonto
  return items
    .map(
      (i) =>
        `<tr>
          <td style="font-size:14px;color:#374151;padding:5px 0">${escapeHtml(i.nombre)} &times; ${i.cantidad}</td>
          <td style="font-size:14px;color:#374151;text-align:right;padding:5px 0;font-weight:500;white-space:nowrap">${fmt(i.precio * i.cantidad)}</td>
        </tr>`
    )
    .join('')
}

export function buildFilaDescuento(codigo: string | null, monto: number): string {
  if (!monto || monto <= 0) return ''
  const fmt = formatMonto
  const label = codigo ? `Descuento (${escapeHtml(codigo)})` : 'Descuento'
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


// ─── Difusiones: envuelve el contenido en la plantilla de marca ───────────────

/**
 * Envuelve el HTML de contenido de una difusión en el diseño de marca de Flow
 * Things (header con logo + área de contenido + footer). El `contenido` es HTML
 * autoría del admin (confiable) — no se escapa.
 */
export function buildDifusionHtml(contenido: string, opts?: { preheader?: string }): string {
  const preheader = opts?.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>`
    : ''
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ede9f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
${preheader}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ede9f7">
<tr><td align="center" style="padding:36px 16px 48px">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(80,0,200,0.13)">
  <tr><td style="background:linear-gradient(135deg,#5b21b6 0%,#7C3AED 60%,#9333ea 100%);padding:28px 40px 24px;text-align:center">
    <img src="https://flow-things-web.vercel.app/logo-light.png" height="56" alt="Flow Things" style="display:block;margin:0 auto"/>
  </td></tr>
  <tr><td style="background:#ffffff;padding:36px 40px;color:#1a0040;font-size:16px;line-height:1.6">
    ${contenido}
  </td></tr>
  <tr><td style="background:#ffffff;padding:0 40px 32px;text-align:center">
    <a href="https://flowthings.com.ar/productos" style="display:inline-block;background:#7C3AED;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:12px">Ver catálogo</a>
  </td></tr>
  <tr><td style="background:#ffffff;padding:0 40px 28px;text-align:center;font-size:13px;color:#6b7280">
    &#x1F4E7; <a href="mailto:contacto@flowthings.com.ar" style="color:#7C3AED;text-decoration:none;font-weight:600">contacto@flowthings.com.ar</a>
    &nbsp;&#183;&nbsp; &#x1F4AC; <a href="https://wa.me/5491156075633" style="color:#7C3AED;text-decoration:none;font-weight:600">+54 9 11 5607-5633</a>
  </td></tr>
  <tr><td style="background:#1e0050;padding:24px 40px;text-align:center">
    <p style="margin:0;font-size:12px;color:#c4b5fd">&copy; ${new Date().getFullYear()} Flow Things &#183; Librer&#xED;a &amp; Juguer&#xED;a</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

// ─── Defaults (re-exportados desde email-constants para uso server-side) ──────
export { DEFAULT_EMAIL_ASUNTO, DEFAULT_EMAIL_CUERPO, DEFAULT_DESPACHO_ASUNTO, DEFAULT_DESPACHO_CUERPO } from './email-constants'
