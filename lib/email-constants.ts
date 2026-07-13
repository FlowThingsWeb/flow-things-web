// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_EMAIL_ASUNTO = 'Tu pedido de Flow Things fue confirmado &#x1F389;'

export const DEFAULT_EMAIL_CUERPO = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ede9f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ede9f7">
<tr><td align="center" style="padding:36px 16px 48px">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(80,0,200,0.13)">

<!-- HEADER -->
<tr><td style="background:linear-gradient(135deg,#5b21b6 0%,#7C3AED 60%,#9333ea 100%);padding:28px 40px 24px;text-align:center">
  <img src="https://flow-things-web.vercel.app/logo-light.png" height="64" alt="Flow Things" style="display:block;margin:0 auto"/>
</td></tr>

<!-- HERO -->
<tr><td style="background:#f5f0ff;padding:36px 40px 28px;text-align:center;border-bottom:1px solid #ede9f7">
  <div style="width:64px;height:64px;border-radius:50%;background:#7C3AED;margin:0 auto 16px;text-align:center;line-height:64px;font-size:34px;color:#ffffff">&#x2713;</div>
  <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#1a0040;line-height:1.2">&#xA1;Compra confirmada!</h1>
  <p style="margin:0 0 18px;font-size:16px;color:#6b21a8;font-weight:500">Hola {{nombre}}, gracias por elegirnos &#x1F609;</p>
  <div style="display:inline-block;background:#7C3AED;border-radius:50px;padding:8px 24px">
    <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px">PEDIDO &#x23; {{orden_id}}</span>
  </div>
</td></tr>

<!-- PRODUCTOS -->
<tr><td style="background:#ffffff;padding:32px 40px 0">
  <p style="margin:0 0 16px;font-size:11px;font-weight:800;color:#9333ea;text-transform:uppercase;letter-spacing:1.2px">&#x1F6D2; Lo que compraste</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <thead>
      <tr style="border-bottom:2px solid #f3f0ff">
        <th style="text-align:left;font-size:10px;color:#a78bfa;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-bottom:10px">Producto</th>
        <th style="text-align:center;font-size:10px;color:#a78bfa;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-bottom:10px;width:50px">Cant.</th>
        <th style="text-align:right;font-size:10px;color:#a78bfa;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-bottom:10px;width:110px">Importe</th>
      </tr>
    </thead>
    <tbody>{{productos_filas}}</tbody>
  </table>
</td></tr>

<!-- RESUMEN COSTOS -->
<tr><td style="background:#ffffff;padding:8px 40px 32px">
  <div style="background:#faf8ff;border-radius:16px;border:1.5px solid #ede9f7;padding:20px 24px;margin-top:8px">
    <table width="100%" cellpadding="0" cellspacing="0">
      {{desglose_items}}
      <tr><td colspan="2" style="padding:3px 0"><div style="height:1px;background:#e9d5ff"></div></td></tr>
      {{fila_descuento}}
      <tr>
        <td style="font-size:14px;color:#6b7280;padding:6px 0">Env&#xED;o</td>
        <td style="font-size:14px;color:#374151;text-align:right;padding:6px 0;font-weight:500">{{envio}}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:4px 0"><div style="height:1.5px;background:#e9d5ff"></div></td>
      </tr>
      <tr>
        <td style="font-size:20px;font-weight:800;color:#1a0040;padding:10px 0 4px">Total</td>
        <td style="font-size:20px;font-weight:800;color:#7C3AED;text-align:right;padding:10px 0 4px">{{total}}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0 0 4px">
          <span style="font-size:12px;color:#9ca3af">&#x1F4B3; {{medio_pago}}</span>
        </td>
      </tr>
    </table>
  </div>
</td></tr>

<!-- PASOS -->
<tr><td style="background:#ffffff;padding:0 40px 32px">
  <div style="background:linear-gradient(135deg,#5b21b6,#7C3AED);border-radius:16px;padding:24px 28px">
    <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:1px">&#xBF;Qu&#xE9; sigue?</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:33%;text-align:center;padding:0 8px">
          <div style="font-size:28px;margin-bottom:6px">&#x1F4E6;</div>
          <p style="margin:0;font-size:12px;font-weight:700;color:#ffffff">Preparando</p>
          <p style="margin:2px 0 0;font-size:11px;color:#c4b5fd">Ya estamos armando tu pedido</p>
        </td>
        <td style="width:33%;text-align:center;padding:0 8px;border-left:1px solid rgba(255,255,255,0.15);border-right:1px solid rgba(255,255,255,0.15)">
          <div style="font-size:28px;margin-bottom:6px">&#x1F69A;</div>
          <p style="margin:0;font-size:12px;font-weight:700;color:#ffffff">En camino</p>
          <p style="margin:2px 0 0;font-size:11px;color:#c4b5fd">Te avisamos cuando sale</p>
        </td>
        <td style="width:33%;text-align:center;padding:0 8px">
          <div style="font-size:28px;margin-bottom:6px">&#x1F3E0;</div>
          <p style="margin:0;font-size:12px;font-weight:700;color:#ffffff">Entregado</p>
          <p style="margin:2px 0 0;font-size:11px;color:#c4b5fd">&#xA1;A disfrutarlo!</p>
        </td>
      </tr>
    </table>
  </div>
</td></tr>

<!-- CONTACTO -->
<tr><td style="background:#ffffff;padding:0 40px 32px">
  <div style="border-radius:12px;border:1.5px solid #ede9f7;padding:18px 22px;text-align:center">
    <p style="margin:0 0 4px;font-size:13px;color:#374151;font-weight:600">&#xBF;Ten&#xE9;s alguna pregunta?</p>
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">
      &#x1F4E7; <a href="mailto:contacto@flowthings.com.ar" style="color:#7C3AED;text-decoration:none;font-weight:600">contacto@flowthings.com.ar</a>
      &nbsp;&#xB7;&nbsp;
      &#x1F4AC; <a href="https://wa.me/5491156075633" style="color:#7C3AED;text-decoration:none;font-weight:600">+54 9 11 5607-5633</a>
    </p>
  </div>
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#1e0050;padding:28px 40px;text-align:center">
  <img src="https://flow-things-web.vercel.app/logo-light.png" height="36" alt="Flow Things" style="display:block;margin:0 auto 12px;opacity:0.85"/>
  <p style="margin:0 0 10px">
    <a href="https://flowthings.com.ar" style="color:#a78bfa;text-decoration:none;font-size:13px;font-weight:600">flowthings.com.ar</a>
  </p>
  <p style="margin:0;font-size:11px;color:#7c3aed;opacity:0.7">Fecha del pedido: {{fecha}}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

// ─── Recuperación de carrito abandonado ─────────────────────────────────────
export const DEFAULT_CARRITO_ASUNTO = '¿Te quedó algo en el carrito? &#x1F6D2;'

export const DEFAULT_CARRITO_CUERPO = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ede9f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ede9f7">
<tr><td align="center" style="padding:36px 16px 48px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(80,0,200,0.13)">

<tr><td style="background:linear-gradient(135deg,#5b21b6 0%,#7C3AED 60%,#9333ea 100%);padding:28px 40px;text-align:center">
  <img src="https://flow-things-web.vercel.app/logo-light.png" height="56" alt="Flow Things" style="display:block;margin:0 auto"/>
</td></tr>

<tr><td style="background:#f5f0ff;padding:32px 40px 24px;text-align:center">
  <div style="font-size:52px;line-height:1;margin-bottom:10px">&#x1F6D2;</div>
  <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a0040">{{nombre}}, ¡te quedó algo pendiente!</h1>
  <p style="margin:0;font-size:15px;color:#6b21a8">Guardamos tu carrito para que lo termines cuando quieras.</p>
</td></tr>

<tr><td style="background:#ffffff;padding:24px 40px 8px">
  {{productos_lista}}
</td></tr>

<tr><td style="background:#ffffff;padding:8px 40px 36px;text-align:center">
  <a href="{{link}}" style="display:inline-block;background:#7C3AED;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:14px">
    Terminar mi compra
  </a>
  <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">Si ya lo compraste, ignorá este mensaje &#x1F60A;</p>
</td></tr>

<tr><td style="background:#1e0050;padding:22px 40px;text-align:center">
  <a href="https://flowthings.com.ar" style="color:#a78bfa;text-decoration:none;font-size:13px;font-weight:600">flowthings.com.ar</a>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`

export const DEFAULT_DESPACHO_ASUNTO = 'Tu pedido de Flow Things esta en camino!'

export const DEFAULT_DESPACHO_CUERPO = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ede9f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ede9f7">
<tr><td align="center" style="padding:36px 16px 48px">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(80,0,200,0.13)">

<!-- HEADER -->
<tr><td style="background:linear-gradient(135deg,#5b21b6 0%,#7C3AED 60%,#9333ea 100%);padding:28px 40px 24px;text-align:center">
  <img src="https://flow-things-web.vercel.app/logo-light.png" height="64" alt="Flow Things" style="display:block;margin:0 auto"/>
</td></tr>

<!-- HERO -->
<tr><td style="background:#f5f0ff;padding:36px 40px 28px;text-align:center">
  <div style="font-size:60px;line-height:1;margin-bottom:12px">&#x1F69A;</div>
  <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#1a0040;line-height:1.2">&#xA1;Tu pedido est&#xE1; en camino!</h1>
  <p style="margin:0;font-size:15px;color:#6b21a8;font-weight:500">{{nombre}}, tu pedido sali&#xF3; y ya est&#xE1; en manos del courier &#x1F4AA;</p>
</td></tr>

<!-- TRACKING CARD -->
<tr><td style="background:#ffffff;padding:28px 40px">
  <div style="background:linear-gradient(135deg,#5b21b6,#7C3AED);border-radius:18px;padding:28px 28px 24px;text-align:center">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:1px">Empresa de env&#xED;o</p>
    <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#ffffff">{{courier}}</p>
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:1px">C&#xF3;digo de seguimiento</p>
    <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:12px 20px;margin-bottom:20px;display:inline-block">
      <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:3px;font-family:monospace">{{tracking_numero}}</span>
    </div>
    {{tracking_boton}}
  </div>
</td></tr>

<!-- REFERENCIA -->
<tr><td style="background:#ffffff;padding:0 40px 28px;text-align:center">
  <p style="margin:0 0 4px;font-size:13px;color:#9ca3af">Pedido <strong style="color:#374151">#{{orden_id}}</strong> &middot; Despachado el {{fecha}}</p>
  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">
    &#x1F4E7; <a href="mailto:contacto@flowthings.com.ar" style="color:#7C3AED;text-decoration:none;font-weight:600">contacto@flowthings.com.ar</a>
    &nbsp;&#xB7;&nbsp;
    &#x1F4AC; <a href="https://wa.me/5491156075633" style="color:#7C3AED;text-decoration:none;font-weight:600">+54 9 11 5607-5633</a>
  </p>
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#1e0050;padding:28px 40px;text-align:center">
  <img src="https://flow-things-web.vercel.app/logo-light.png" height="36" alt="Flow Things" style="display:block;margin:0 auto 12px;opacity:0.85"/>
  <p style="margin:0">
    <a href="https://flowthings.com.ar" style="color:#a78bfa;text-decoration:none;font-size:13px;font-weight:600">flowthings.com.ar</a>
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
