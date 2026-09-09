import { formatMonto } from './format'
import { supabaseAdmin } from './supabaseAdmin'
import { LOGO_EMAIL } from '@/lib/email-constants'
import { linkBaja } from './baja-email'
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
  'productos_lista',
  // El recuadro del cupón del carrito y el encabezado de cada etapa: son HTML
  // armado por nosotros, y el único dato de afuera —el nombre— ya viene
  // escapado antes de entrar acá.
  'bloque_extra',
  'titulo',
  'bajada',
  // Entidad HTML del emoji del encabezado: escaparla mostraría '&#x1F381;'.
  'emoji',
])

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key]
    if (val == null) return `{{${key}}}`
    return HTML_VAR_KEYS.has(key) ? val : escapeHtml(val)
  })
}

/**
 * Marca que se reemplaza por el link de baja de cada destinatario.
 *
 * El cuerpo de la difusión se arma UNA vez para todos, pero el link de baja
 * lleva la dirección firmada y es distinto para cada uno. Se deja esta marca al
 * armar el HTML y se reemplaza al enviar, que es el único momento en que se
 * sabe a quién va.
 */
export const MARCA_LINK_BAJA = '%%LINK_BAJA%%'

/**
 * Versión en texto plano del mail.
 *
 * Un mail sólo-HTML es una señal de spam: casi todo el correo legítimo va como
 * multipart con las dos versiones, y el que manda una sola suele ser el que usa
 * una herramienta de envío masivo y nada más. Además es lo único que ve quien
 * lee con imágenes bloqueadas o con lector de pantalla.
 *
 * No pretende ser un conversor de HTML completo: los mails de la tienda son
 * tablas con texto y links, y para eso alcanza.
 */
export function htmlATexto(html: string): string {
  return html
    // Lo que no es contenido.
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // El preheader está oculto a propósito en el HTML; en texto sería un
    // duplicado del asunto arriba de todo.
    .replace(/<div style="display:none[\s\S]*?<\/div>/gi, '')
    // Un link sin su destino no sirve para nada en texto plano.
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, texto) => {
      const limpio = String(texto).replace(/<[^>]+>/g, '').trim()
      const destino = String(href)
      if (!limpio) return destino
      // En un mailto: o un tel: el destino ES el texto; repetirlo sólo ensucia.
      if (/^(mailto|tel):/i.test(destino)) return limpio
      return limpio === destino ? limpio : `${limpio}: ${destino}`
    })
    // Cortes de línea que el HTML da por estructura.
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|li|table)>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    // Entidades: la misma función que decodifica los asuntos, para no tener dos
    // listas que se desincronicen.
    .replace(/&[#\w]+;/g, (m) => decodificarEntidades(m))
    .replace(/\u00a0/g, ' ')
    // Espacios y líneas de más que dejó el markup.
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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

/**
 * Decodifica las entidades HTML del asunto.
 *
 * Los asuntos se escribieron con entidades —'&#x1F389;'— igual que el cuerpo,
 * pero el asunto de un mail no es HTML: nodemailer lo manda tal cual y en la
 * bandeja se lee "Tu pedido fue confirmado &#x1F389;". Nueve mails salieron
 * así antes de que se notara, entre ellos todas las confirmaciones de pedido.
 *
 * Se decodifica acá y no en cada constante para que valga para todos los
 * asuntos, incluidos los que escriba alguien desde el panel. El cuerpo NO se
 * toca: ahí las entidades son correctas.
 */
const NOMBRADAS: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', middot: '\u00b7',
  // Las que usan las plantillas de mail. Sin `copy`, el pie del mail en texto
  // plano decía literalmente "&copy; 2026 Flow Things".
  copy: '\u00a9', reg: '\u00ae', trade: '\u2122', deg: '\u00b0',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', laquo: '\u00ab', raquo: '\u00bb',
}

export function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(\w+);/g, (m, nombre) => NOMBRADAS[nombre] ?? m)
}

export async function sendEmail(params: {
  to: string
  asunto: string
  cuerpo: string
  adjuntos?: { filename: string; content: string; encoding: 'base64'; contentType: string }[]
  /** Difusión: lleva link de baja, encabezados de baja, y no se copia al comercio. */
  difusion?: boolean
}): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[email] GMAIL_USER o GMAIL_APP_PASSWORD no configurados')
    return
  }
  const transporter = createTransport()

  // Una difusión NO se copia al comercio: son un mail por persona, así que la
  // copia oculta multiplica la difusión entera dentro de la propia casilla —32
  // destinatarios, 32 copias— y encima le suma a la casilla que manda un pico
  // de correo entrante justo mientras está enviando, que es de las cosas que
  // Gmail mira. La copia tiene sentido en lo transaccional, donde es el registro
  // de lo que se le dijo a cada comprador.
  const esDifusion = params.difusion === true
  const bcc = !esDifusion && EMAIL_BCC && params.to.toLowerCase() !== EMAIL_BCC.toLowerCase()
    ? EMAIL_BCC
    : undefined

  let html = params.cuerpo
  const headers: Record<string, string> = {}
  if (esDifusion) {
    const baja = linkBaja(params.to)
    html = html.split(MARCA_LINK_BAJA).join(baja)
    // List-Unsubscribe le da a Gmail el botón de "cancelar suscripción" arriba
    // del mail, que es donde la gente lo busca. Sin él, el que quiere dejar de
    // recibir usa el botón que tiene a mano: "marcar como spam".
    // El -Post habilita el de un solo click (RFC 8058), que Gmail exige para
    // mostrar el botón sin intermediarios.
    headers['List-Unsubscribe'] = `<${baja}>, <mailto:contacto@flowthings.com.ar?subject=baja>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }

  await transporter.sendMail({
    from: `"Flow Things" <${process.env.GMAIL_USER}>`,
    to: params.to,
    bcc,
    subject: decodificarEntidades(params.asunto),
    html,
    // Multipart: sin la parte de texto el mail puntúa peor en los filtros.
    text: htmlATexto(html),
    ...(Object.keys(headers).length ? { headers } : {}),
    attachments: params.adjuntos?.map(a => ({
      filename: a.filename,
      content: a.content,
      encoding: a.encoding,
      contentType: a.contentType,
    })),
  })

  // Log del envío para el historial de usuario (best-effort, no bloquea).
  try {
    await supabaseAdmin
      .from('emails_enviados')
      .insert({ destinatario: params.to, asunto: decodificarEntidades(params.asunto) })
  } catch {
    /* si falla el log, el mail igual se envió */
  }
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

/**
 * Fila de producto para los mails de carrito/checkout abandonado: miniatura +
 * nombre×cantidad + importe. `rawImg` puede ser URL absoluta o relativa; el
 * nombre ya viene escapado. Si no hay imagen, muestra un placeholder.
 */
export function filaProducto(
  rawImg: string | null | undefined,
  nombreEscapado: string,
  cantidad: number,
  montoStr: string,
  appUrl: string,
): string {
  const img = rawImg
    ? (String(rawImg).startsWith('http') ? String(rawImg) : `${appUrl}${rawImg}`)
    : null
  const thumb = img
    ? `<img src="${img}" width="52" height="52" alt="" style="width:52px;height:52px;border-radius:10px;object-fit:cover;display:block;border:1px solid #ede9f7"/>`
    : `<div style="width:52px;height:52px;border-radius:10px;background:#f3f0ff;text-align:center;line-height:52px;font-size:22px">&#x1F4E6;</div>`
  return `<tr>
    <td width="52" style="padding:10px 0;vertical-align:middle">${thumb}</td>
    <td style="padding:10px 12px;font-size:14px;color:#374151;vertical-align:middle">${cantidad}&times; ${nombreEscapado}</td>
    <td style="padding:10px 0;font-size:14px;color:#111;text-align:right;font-weight:700;white-space:nowrap;vertical-align:middle">${montoStr}</td>
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
  <tr><td style="background:linear-gradient(135deg,#5b21b6 0%,#7C3AED 60%,#9333ea 100%);padding:34px 40px 30px;text-align:center">
    <img src="${LOGO_EMAIL}" height="92" alt="Flow Things" style="display:block;margin:0 auto;max-width:100%;height:auto"/>
  </td></tr>
  <tr><td style="background:#ffffff;padding:36px 40px;color:#1a0040;font-size:16px;line-height:1.6">
    ${contenido}
  </td></tr>
  <tr><td style="background:#ffffff;padding:0 40px 32px;text-align:center">
    <a href="https://flowthings.com.ar/productos" style="display:inline-block;background:#7C3AED;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:12px">Ver todos los productos</a>
  </td></tr>
  <tr><td style="background:#ffffff;padding:0 40px 28px;text-align:center;font-size:13px;color:#6b7280">
    &#x1F4E7; <a href="mailto:contacto@flowthings.com.ar" style="color:#7C3AED;text-decoration:none;font-weight:600">contacto@flowthings.com.ar</a>
    &nbsp;&#183;&nbsp; &#x1F4AC; <a href="https://wa.me/5491156075633" style="color:#7C3AED;text-decoration:none;font-weight:600">+54 9 11 5607-5633</a>
  </td></tr>
  <tr><td style="background:#1e0050;padding:24px 40px;text-align:center">
    <p style="margin:0 0 10px;font-size:12px;color:#c4b5fd">&copy; ${new Date().getFullYear()} Flow Things &#183; Librer&#xED;a &amp; Jugueter&#xED;a</p>
    <p style="margin:0;font-size:12px;color:#a78bfa;line-height:1.6">
      Recib&#xED;s este mail porque tenés cuenta en Flow Things.<br/>
      <a href="${MARCA_LINK_BAJA}" style="color:#ddd6fe;text-decoration:underline">Dejar de recibir novedades</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

// ─── Defaults (re-exportados desde email-constants para uso server-side) ──────
export { DEFAULT_EMAIL_ASUNTO, DEFAULT_EMAIL_CUERPO, DEFAULT_DESPACHO_ASUNTO, DEFAULT_DESPACHO_CUERPO } from './email-constants'
