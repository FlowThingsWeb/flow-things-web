import { NextRequest, NextResponse } from 'next/server'
import { darDeBaja, tokenValido } from '@/lib/baja-email'
import { escapeHtml } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Baja de las difusiones.
 *
 * GET  /baja?e=<email>&t=<firma>  muestra la página con el botón.
 * POST /baja?e=<email>&t=<firma>  da de baja.
 *
 * ─── POR QUÉ EL GET NO DA DE BAJA ───────────────────────────────────────────
 *
 * Ésta es la decisión importante del archivo. Lo cómodo sería dar de baja en el
 * GET —un click y listo— pero acabamos de comprobar en la difusión de Mafalda
 * que los escáneres de seguridad del correo ABREN TODOS LOS LINKS del mail
 * apenas llega: 5 links en 2 minutos, sin que ninguna persona lo hubiera visto
 * todavía. Si el GET diera de baja, el escáner daría de baja al destinatario
 * antes de que abriera el mail, y encima en silencio: el mail se ve normal, la
 * persona no hizo nada, y simplemente no le llega nunca más una difusión.
 *
 * Los prefetchers de Gmail y Outlook harían lo mismo. Por eso el GET sólo
 * muestra; la baja pasa en el POST, que ningún escáner dispara.
 *
 * El botón "cancelar suscripción" de Gmail tampoco usa el GET: manda un POST
 * (RFC 8058), así que sigue siendo un click para el usuario.
 */

function pagina(titulo: string, mensaje: string, boton?: { email: string; token: string }): NextResponse {
  const accion = boton
    ? `<form method="POST" action="/baja?e=${encodeURIComponent(boton.email)}&amp;t=${encodeURIComponent(boton.token)}">
         <button type="submit" style="background:#7C3AED;color:#fff;border:0;border-radius:12px;padding:14px 34px;font-size:15px;font-weight:700;cursor:pointer">
           Confirmar baja
         </button>
       </form>
       <p style="margin:20px 0 0;font-size:13px;color:#6b7280">
         Vas a seguir recibiendo los mails de tus compras: confirmaciones, facturas y avisos de envío.
       </p>`
    : `<a href="https://www.flowthings.com.ar/" style="display:inline-block;background:#7C3AED;color:#fff;border-radius:12px;padding:14px 34px;font-size:15px;font-weight:700;text-decoration:none">Ir a la tienda</a>`

  return new NextResponse(
    `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(titulo)} · Flow Things</title></head>
<body style="margin:0;background:#ede9f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:64px 20px;text-align:center">
  <div style="background:#fff;border-radius:24px;padding:44px 32px;box-shadow:0 8px 40px rgba(80,0,200,0.13)">
    <h1 style="margin:0 0 12px;font-size:22px;color:#1a0040">${escapeHtml(titulo)}</h1>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4b5563">${escapeHtml(mensaje)}</p>
    ${accion}
  </div>
</div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

function leerParams(req: NextRequest): { email: string; token: string } | null {
  const email = req.nextUrl.searchParams.get('e')?.trim().toLowerCase()
  const token = req.nextUrl.searchParams.get('t')?.trim()
  if (!email || !token) return null
  // La firma cubre la dirección exacta, así que un link manipulado no valida.
  if (!tokenValido(email, token)) return null
  return { email, token }
}

export async function GET(req: NextRequest) {
  const datos = leerParams(req)
  if (!datos) {
    return pagina(
      'Link inválido',
      'Este link de baja no es válido o está incompleto. Escribinos a contacto@flowthings.com.ar y te sacamos de la lista a mano.',
    )
  }
  return pagina(
    '¿Querés dejar de recibir novedades?',
    `Vamos a dar de baja a ${datos.email} de los mails de novedades y promociones.`,
    datos,
  )
}

export async function POST(req: NextRequest) {
  const datos = leerParams(req)
  if (!datos) {
    return pagina(
      'Link inválido',
      'Este link de baja no es válido o está incompleto. Escribinos a contacto@flowthings.com.ar y te sacamos de la lista a mano.',
    )
  }

  // Gmail y Outlook mandan 'List-Unsubscribe=One-Click' en el cuerpo (RFC 8058);
  // el formulario de la página no manda nada. Distinguirlos sólo sirve para
  // saber de dónde vino la baja.
  let motivo = 'link'
  try {
    const cuerpo = await req.text()
    if (cuerpo.includes('One-Click')) motivo = 'un_click'
  } catch {
    /* sin cuerpo: vino del formulario */
  }

  try {
    await darDeBaja(datos.email, motivo)
  } catch (e) {
    console.error('[baja] No se pudo registrar la baja:', e)
    return pagina(
      'No pudimos procesar la baja',
      'Hubo un problema de nuestro lado. Escribinos a contacto@flowthings.com.ar y te sacamos de la lista a mano.',
    )
  }

  return pagina(
    'Listo, te sacamos de la lista',
    `${datos.email} no va a recibir más mails de novedades. Vas a seguir recibiendo los de tus compras: confirmaciones, facturas y avisos de envío.`,
  )
}
