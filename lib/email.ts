// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require('nodemailer')

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

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

export const DEFAULT_EMAIL_ASUNTO = 'Tu pedido de Flow Things fue confirmado 🎉'

export const DEFAULT_EMAIL_CUERPO = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <tr><td style="background:#7C3AED;padding:28px 32px;text-align:center">
          <img src="https://flow-things-web.vercel.app/logo-light.png" height="44" alt="Flow Things" style="display:block;margin:0 auto"/>
        </td></tr>

        <tr><td style="padding:36px 40px">
          <h1 style="margin:0 0 8px;font-size:22px;color:#111">¡Gracias, {{nombre}}! 🎉</h1>
          <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6">
            Recibimos tu pedido y ya lo estamos preparando con mucho cariño.
          </p>
          <div style="background:#f9f8ff;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin-bottom:24px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#888;font-size:13px;padding-bottom:8px">N° de orden</td>
                <td style="color:#111;font-size:13px;font-weight:bold;text-align:right;padding-bottom:8px">#{{orden_id}}</td>
              </tr>
              <tr>
                <td style="color:#888;font-size:13px;padding-bottom:8px">Fecha</td>
                <td style="color:#111;font-size:13px;text-align:right;padding-bottom:8px">{{fecha}}</td>
              </tr>
              <tr>
                <td style="color:#888;font-size:13px;border-top:1px solid #e5e7eb;padding-top:8px">Total</td>
                <td style="color:#7C3AED;font-size:16px;font-weight:bold;text-align:right;border-top:1px solid #e5e7eb;padding-top:8px">{{total}}</td>
              </tr>
            </table>
          </div>
          <p style="margin:0 0 8px;color:#111;font-size:14px;font-weight:bold">Productos</p>
          <div style="color:#555;font-size:14px;line-height:1.8;margin-bottom:28px">{{productos}}</div>
          <p style="margin:0;color:#555;font-size:14px;line-height:1.6">
            Te avisaremos cuando tu pedido sea despachado.<br>
            Ante cualquier consulta escribinos por Instagram <strong>@flowthings__</strong>
          </p>
        </td></tr>

        <tr><td style="background:#f4f4f5;padding:20px 40px;text-align:center;color:#999;font-size:12px">
          Flow Things · <a href="https://flowthings.com.ar" style="color:#7C3AED;text-decoration:none">flowthings.com.ar</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
