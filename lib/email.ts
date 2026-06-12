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

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_EMAIL_ASUNTO = 'Tu pedido de Flow Things fue confirmado &#x1F389;'

export const DEFAULT_EMAIL_CUERPO = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f0f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f0f5">
<tr><td align="center" style="padding:40px 16px 48px">
<table width="600" cellpadding="0" cellspacing="0" style="border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)">

<tr><td style="background:#7C3AED;padding:32px 40px;text-align:center">
  <img src="https://flow-things-web.vercel.app/logo-light.png" height="44" alt="Flow Things" style="display:block;margin:0 auto"/>
</td></tr>

<tr><td style="background:#ffffff;padding:36px 40px 0;text-align:center">
  <div style="display:inline-block;background:#f0ebff;border-radius:50px;padding:6px 20px;margin-bottom:20px">
    <span style="color:#7C3AED;font-size:13px;font-weight:600">Pedido #{{orden_id}}</span>
  </div>
  <h1 style="margin:0 0 10px;font-size:27px;font-weight:700;color:#111;line-height:1.3">Gracias, {{nombre}}!</h1>
  <p style="margin:0 0 28px;font-size:15px;color:#666;line-height:1.7">Recibimos tu pedido y ya lo estamos preparando con mucho cariño.</p>
</td></tr>

<tr><td style="background:#ffffff;padding:0 40px"><div style="height:1px;background:#eee"></div></td></tr>

<tr><td style="background:#ffffff;padding:28px 40px 0">
  <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.7px">Detalle del pedido</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <thead><tr>
      <th style="text-align:left;font-size:11px;color:#bbb;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:10px;border-bottom:1px solid #eee">Producto</th>
      <th style="text-align:center;font-size:11px;color:#bbb;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:10px;border-bottom:1px solid #eee;width:55px">Cant.</th>
      <th style="text-align:right;font-size:11px;color:#bbb;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:10px;border-bottom:1px solid #eee;width:120px">Importe</th>
    </tr></thead>
    <tbody>{{productos_filas}}</tbody>
  </table>
</td></tr>

<tr><td style="background:#ffffff;padding:4px 40px 32px">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="font-size:14px;color:#888;padding:10px 0 4px">Subtotal</td>
      <td style="font-size:14px;color:#333;text-align:right;padding:10px 0 4px">{{subtotal}}</td>
    </tr>
    {{fila_descuento}}
    <tr>
      <td style="font-size:14px;color:#888;padding:4px 0 0">Envio</td>
      <td style="font-size:14px;color:#333;text-align:right;padding:4px 0 0">{{envio}}</td>
    </tr>
    <tr>
      <td style="font-size:19px;font-weight:700;color:#111;padding:14px 0 8px;border-top:2px solid #111">Total</td>
      <td style="font-size:19px;font-weight:700;color:#7C3AED;text-align:right;padding:14px 0 8px;border-top:2px solid #111">{{total}}</td>
    </tr>
    <tr>
      <td style="font-size:13px;color:#999;padding:0 0 8px" colspan="2">&#x1F4B3; {{medio_pago}}</td>
    </tr>
  </table>
</td></tr>

<tr><td style="background:#ffffff;padding:0 40px"><div style="height:1px;background:#eee"></div></td></tr>

<tr><td style="background:#ffffff;padding:28px 40px">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8ff;border-radius:12px;border:1px solid #e8e3fa">
    <tr><td style="padding:20px 24px">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#111">Que sigue ahora?</p>
      <p style="margin:0;font-size:14px;color:#555;line-height:1.7">
        Vamos a preparar tu pedido y cuando lo enviemos te avisamos por mail con los datos de seguimiento.<br/>
        Ante cualquier consulta escribinos por mail a contacto@flowthings.com.ar o por WhatsApp al +54 9 11 5607-5633
      </p>
    </td></tr>
  </table>
</td></tr>

<tr><td style="background:#f8f8fa;border-top:1px solid #eee;padding:22px 40px;text-align:center">
  <p style="margin:0;font-size:12px;color:#bbb;line-height:1.9">
    Flow Things - <a href="https://flowthings.com.ar" style="color:#7C3AED;text-decoration:none;font-weight:600">flowthings.com.ar</a><br/>
    Fecha del pedido: {{fecha}}
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

export const DEFAULT_DESPACHO_ASUNTO = 'Tu pedido de Flow Things esta en camino!'

export const DEFAULT_DESPACHO_CUERPO = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f0f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f0f5">
<tr><td align="center" style="padding:40px 16px 48px">
<table width="600" cellpadding="0" cellspacing="0" style="border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)">

<tr><td style="background:#7C3AED;padding:32px 40px;text-align:center">
  <img src="https://flow-things-web.vercel.app/logo-light.png" height="44" alt="Flow Things" style="display:block;margin:0 auto"/>
</td></tr>

<tr><td style="background:#ffffff;padding:40px 40px 0;text-align:center">
  <div style="font-size:52px;line-height:1;margin-bottom:16px">&#x1F69A;</div>
  <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;color:#111;line-height:1.3">Tu pedido esta en camino, {{nombre}}!</h1>
  <p style="margin:0 0 28px;font-size:15px;color:#666;line-height:1.7">Ya salio de nuestro deposito y se dirige a vos.</p>
</td></tr>

<tr><td style="background:#ffffff;padding:0 40px"><div style="height:1px;background:#eee"></div></td></tr>

<tr><td style="background:#ffffff;padding:28px 40px">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8ff;border-radius:14px;border:1px solid #e8e3fa">
    <tr><td style="padding:24px 28px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:16px">
          <p style="margin:0 0 3px;font-size:11px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Empresa de envio</p>
          <p style="margin:0;font-size:17px;font-weight:700;color:#111">{{courier}}</p>
        </td></tr>
        <tr><td>
          <p style="margin:0 0 3px;font-size:11px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Codigo de seguimiento</p>
          <p style="margin:0;font-size:22px;font-weight:700;color:#7C3AED;letter-spacing:2px;font-family:monospace">{{tracking_numero}}</p>
        </td></tr>
      </table>
      {{tracking_boton}}
    </td></tr>
  </table>
</td></tr>

<tr><td style="background:#ffffff;padding:0 40px 28px;text-align:center">
  <p style="margin:0;font-size:13px;color:#aaa">
    Pedido <strong style="color:#555">#{{orden_id}}</strong> - Despachado el {{fecha}}
  </p>
  <p style="margin:8px 0 0;font-size:14px;color:#666;line-height:1.6">
    Ante cualquier inconveniente escribinos por mail a contacto@flowthings.com.ar o por WhatsApp al +54 9 11 5607-5633
  </p>
</td></tr>

<tr><td style="background:#f8f8fa;border-top:1px solid #eee;padding:22px 40px;text-align:center">
  <p style="margin:0;font-size:12px;color:#bbb;line-height:1.9">
    Flow Things - <a href="https://flowthings.com.ar" style="color:#7C3AED;text-decoration:none;font-weight:600">flowthings.com.ar</a>
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
