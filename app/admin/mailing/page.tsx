'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Preview vars de ejemplo ──────────────────────────────────────────────────

const PREVIEW_CONFIRMACION: Record<string, string> = {
  nombre: 'María García',
  orden_id: '12345',
  total: '$ 8.500,00',
  subtotal: '$ 8.000,00',
  envio: '$ 1.200,00',
  fecha: '12/06/2026',
  medio_pago: 'Tarjeta de crédito Visa terminada en 1234 · 3 cuotas',
  fila_descuento: `<tr><td style="font-size:14px;color:#16a34a;padding:6px 0">&#x1F3F7; Descuento (SUMMER10)</td><td style="font-size:14px;color:#16a34a;font-weight:600;text-align:right;padding:6px 0">- $ 800,00</td></tr>`,
  desglose_items: `
    <tr><td style="font-size:14px;color:#374151;padding:5px 0">Muñeca articulada premium &times; 1</td><td style="font-size:14px;color:#374151;text-align:right;padding:5px 0;font-weight:500;white-space:nowrap">$ 4.500,00</td></tr>
    <tr><td style="font-size:14px;color:#374151;padding:5px 0">LEGO City Set 60303 &times; 2</td><td style="font-size:14px;color:#374151;text-align:right;padding:5px 0;font-weight:500;white-space:nowrap">$ 3.500,00</td></tr>`,
  productos_filas: `
    <tr><td style="font-size:14px;color:#111;padding:12px 0;border-bottom:1px solid #f3f0ff;line-height:1.4">Muñeca articulada premium</td><td style="font-size:14px;color:#a78bfa;text-align:center;padding:12px 0;border-bottom:1px solid #f3f0ff">1</td><td style="font-size:14px;color:#111;text-align:right;padding:12px 0;border-bottom:1px solid #f3f0ff;white-space:nowrap;font-weight:500">$ 4.500,00</td></tr>
    <tr><td style="font-size:14px;color:#111;padding:12px 0;line-height:1.4">LEGO City Set 60303</td><td style="font-size:14px;color:#a78bfa;text-align:center;padding:12px 0">2</td><td style="font-size:14px;color:#111;text-align:right;padding:12px 0;white-space:nowrap;font-weight:500">$ 3.500,00</td></tr>`,
  productos: '1x Muñeca articulada, 2x LEGO City',
  descuento: '$ 800,00',
}

const PREVIEW_DESPACHO: Record<string, string> = {
  nombre: 'María García',
  orden_id: '12345',
  courier: 'OCA',
  tracking_numero: 'OCA-987654321',
  tracking_url: 'https://www.oca.com.ar/tracking',
  tracking_boton: `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td align="center"><a href="#" style="display:inline-block;background:#7C3AED;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px">Ver seguimiento en vivo</a></td></tr></table>`,
  fecha: '12/06/2026',
}

function substituteVars(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 ${value ? 'bg-brand-purple' : 'bg-brand-border'}`}
    >
      <span className={`absolute top-[3px] w-4 h-4 bg-white rounded-full transition-transform shadow ${value ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
    </button>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-brand-text text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-brand-text-muted text-xs font-mono uppercase">{value}</span>
        <label className="w-8 h-8 rounded-lg border border-brand-border overflow-hidden cursor-pointer block" style={{ background: value }}>
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="opacity-0 w-0 h-0 absolute" />
        </label>
      </div>
    </div>
  )
}

// ─── Email builders ───────────────────────────────────────────────────────────

interface ConfirmDesign {
  headerColor: string
  accentColor: string
  showLogo: boolean
  titulo: string
  introText: string
  closingText: string
  footerText: string
}

interface DespachoDesign {
  headerColor: string
  accentColor: string
  showLogo: boolean
  headline: string
  subtitleText: string
  contactText: string
  footerText: string
}

const DEFAULT_CONFIRM_DESIGN: ConfirmDesign = {
  headerColor: '#7C3AED',
  accentColor: '#7C3AED',
  showLogo: true,
  titulo: 'Gracias, {{nombre}}!',
  introText: 'Recibimos tu pedido y ya lo estamos preparando con mucho cariño.',
  closingText: 'Vamos a preparar tu pedido y cuando lo enviemos te avisamos por mail con los datos de seguimiento.\nAnte cualquier consulta escribinos por mail a contacto@flowthings.com.ar o por WhatsApp al +54 9 11 5607-5633.',
  footerText: 'Flow Things',
}

const DEFAULT_DESPACHO_DESIGN: DespachoDesign = {
  headerColor: '#7C3AED',
  accentColor: '#7C3AED',
  showLogo: true,
  headline: 'Tu pedido esta en camino, {{nombre}}!',
  subtitleText: 'Ya salio de nuestro deposito y se dirige a vos.',
  contactText: 'Ante cualquier inconveniente escribinos por mail a contacto@flowthings.com.ar o por WhatsApp al +54 9 11 5607-5633.',
  footerText: 'Flow Things',
}

function buildConfirmHTML(d: ConfirmDesign): string {
  const logoBlock = d.showLogo
    ? `<img src="https://flow-things-web.vercel.app/logo-light.png" height="64" alt="Flow Things" style="display:block;margin:0 auto"/>`
    : `<span style="color:#ffffff;font-size:24px;font-weight:800">Flow Things</span>`
  const closing = d.closingText.split('\n').join('<br/>')
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ede9f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ede9f7">
<tr><td align="center" style="padding:36px 16px 48px">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(80,0,200,0.13)">

<tr><td style="background:linear-gradient(135deg,#5b21b6 0%,${d.headerColor} 60%,#9333ea 100%);padding:28px 40px 24px;text-align:center">${logoBlock}</td></tr>

<tr><td style="background:#f5f0ff;padding:36px 40px 28px;text-align:center;border-bottom:1px solid #ede9f7">
  <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:${d.accentColor};margin-bottom:16px">
    <span style="font-size:30px;line-height:1;color:#fff">&#x2713;</span>
  </div>
  <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#1a0040;line-height:1.2">${d.titulo}</h1>
  <p style="margin:0 0 18px;font-size:15px;color:#6b21a8;font-weight:500">${d.introText}</p>
  <div style="display:inline-block;background:${d.accentColor};border-radius:50px;padding:8px 24px">
    <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px">PEDIDO &#x23; {{orden_id}}</span>
  </div>
</td></tr>

<tr><td style="background:#ffffff;padding:32px 40px 0">
  <p style="margin:0 0 16px;font-size:11px;font-weight:800;color:${d.accentColor};text-transform:uppercase;letter-spacing:1.2px">&#x1F6D2; Lo que compraste</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <thead><tr style="border-bottom:2px solid #f3f0ff">
      <th style="text-align:left;font-size:10px;color:#a78bfa;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-bottom:10px">Producto</th>
      <th style="text-align:center;font-size:10px;color:#a78bfa;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-bottom:10px;width:50px">Cant.</th>
      <th style="text-align:right;font-size:10px;color:#a78bfa;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-bottom:10px;width:110px">Importe</th>
    </tr></thead>
    <tbody>{{productos_filas}}</tbody>
  </table>
</td></tr>

<tr><td style="background:#ffffff;padding:8px 40px 32px">
  <div style="background:#faf8ff;border-radius:16px;border:1.5px solid #ede9f7;padding:20px 24px;margin-top:8px">
    <table width="100%" cellpadding="0" cellspacing="0">
      {{desglose_items}}
      <tr><td colspan="2" style="padding:3px 0"><div style="height:1px;background:#e9d5ff"></div></td></tr>
      {{fila_descuento}}
      <tr><td style="font-size:14px;color:#6b7280;padding:6px 0">Env&#xED;o</td><td style="font-size:14px;color:#374151;text-align:right;padding:6px 0;font-weight:500">{{envio}}</td></tr>
      <tr><td colspan="2" style="padding:4px 0"><div style="height:1.5px;background:#e9d5ff"></div></td></tr>
      <tr>
        <td style="font-size:20px;font-weight:800;color:#1a0040;padding:10px 0 4px">Total</td>
        <td style="font-size:20px;font-weight:800;color:${d.accentColor};text-align:right;padding:10px 0 4px">{{total}}</td>
      </tr>
      <tr><td colspan="2" style="padding:0 0 4px"><span style="font-size:12px;color:#9ca3af">&#x1F4B3; {{medio_pago}}</span></td></tr>
    </table>
  </div>
</td></tr>

<tr><td style="background:#ffffff;padding:0 40px 32px">
  <div style="background:linear-gradient(135deg,#5b21b6,${d.accentColor});border-radius:16px;padding:24px 28px">
    <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:1px">&#xBF;Qu&#xE9; sigue?</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:33%;text-align:center;padding:0 8px"><div style="font-size:28px;margin-bottom:6px">&#x1F4E6;</div><p style="margin:0;font-size:12px;font-weight:700;color:#fff">Preparando</p><p style="margin:2px 0 0;font-size:11px;color:#c4b5fd">Ya estamos armando tu pedido</p></td>
        <td style="width:33%;text-align:center;padding:0 8px;border-left:1px solid rgba(255,255,255,0.15);border-right:1px solid rgba(255,255,255,0.15)"><div style="font-size:28px;margin-bottom:6px">&#x1F69A;</div><p style="margin:0;font-size:12px;font-weight:700;color:#fff">En camino</p><p style="margin:2px 0 0;font-size:11px;color:#c4b5fd">Te avisamos cuando sale</p></td>
        <td style="width:33%;text-align:center;padding:0 8px"><div style="font-size:28px;margin-bottom:6px">&#x1F3E0;</div><p style="margin:0;font-size:12px;font-weight:700;color:#fff">Entregado</p><p style="margin:2px 0 0;font-size:11px;color:#c4b5fd">&#xA1;A disfrutarlo!</p></td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#ddd6fe;line-height:1.6;text-align:center">${closing}</p>
  </div>
</td></tr>

<tr><td style="background:#ffffff;padding:0 40px 32px">
  <div style="border-radius:12px;border:1.5px solid #ede9f7;padding:18px 22px;text-align:center">
    <p style="margin:0 0 4px;font-size:13px;color:#374151;font-weight:600">&#xBF;Ten&#xE9;s alguna pregunta?</p>
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">
      &#x1F4E7; <a href="mailto:contacto@flowthings.com.ar" style="color:${d.accentColor};text-decoration:none;font-weight:600">contacto@flowthings.com.ar</a>
      &nbsp;&#xB7;&nbsp;
      &#x1F4AC; <a href="https://wa.me/5491156075633" style="color:${d.accentColor};text-decoration:none;font-weight:600">+54 9 11 5607-5633</a>
    </p>
  </div>
</td></tr>

<tr><td style="background:#1e0050;padding:28px 40px;text-align:center">
  ${d.showLogo ? `<img src="https://flow-things-web.vercel.app/logo-light.png" height="36" alt="Flow Things" style="display:block;margin:0 auto 12px;opacity:0.85"/>` : `<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#a78bfa">${d.footerText}</p>`}
  <p style="margin:0 0 8px"><a href="https://flowthings.com.ar" style="color:#a78bfa;text-decoration:none;font-size:13px;font-weight:600">flowthings.com.ar</a></p>
  <p style="margin:0;font-size:11px;color:#6d28d9">Fecha del pedido: {{fecha}}</p>
</td></tr>

</table></td></tr></table>
</body></html>`
}

function buildDespachoHTML(d: DespachoDesign): string {
  const logoBlock = d.showLogo
    ? `<img src="https://flow-things-web.vercel.app/logo-light.png" height="64" alt="Flow Things" style="display:block;margin:0 auto"/>`
    : `<span style="color:#ffffff;font-size:24px;font-weight:800">Flow Things</span>`
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ede9f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ede9f7">
<tr><td align="center" style="padding:36px 16px 48px">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(80,0,200,0.13)">

<tr><td style="background:linear-gradient(135deg,#5b21b6 0%,${d.headerColor} 60%,#9333ea 100%);padding:28px 40px 24px;text-align:center">${logoBlock}</td></tr>

<tr><td style="background:#f5f0ff;padding:36px 40px 28px;text-align:center">
  <div style="font-size:60px;line-height:1;margin-bottom:12px">&#x1F69A;</div>
  <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#1a0040;line-height:1.2">${d.headline}</h1>
  <p style="margin:0;font-size:15px;color:#6b21a8;font-weight:500">${d.subtitleText}</p>
</td></tr>

<tr><td style="background:#ffffff;padding:28px 40px">
  <div style="background:linear-gradient(135deg,#5b21b6,${d.accentColor});border-radius:18px;padding:28px;text-align:center">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:1px">Empresa de env&#xED;o</p>
    <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#ffffff">{{courier}}</p>
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:1px">C&#xF3;digo de seguimiento</p>
    <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:12px 20px;margin-bottom:20px">
      <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:3px;font-family:monospace">{{tracking_numero}}</span>
    </div>
    {{tracking_boton}}
  </div>
</td></tr>

<tr><td style="background:#ffffff;padding:0 40px 28px;text-align:center">
  <p style="margin:0 0 8px;font-size:13px;color:#9ca3af">Pedido <strong style="color:#374151">#{{orden_id}}</strong> &middot; Despachado el {{fecha}}</p>
  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6">${d.contactText}</p>
  <p style="margin:8px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
    &#x1F4E7; <a href="mailto:contacto@flowthings.com.ar" style="color:${d.accentColor};text-decoration:none;font-weight:600">contacto@flowthings.com.ar</a>
    &nbsp;&#xB7;&nbsp;
    &#x1F4AC; <a href="https://wa.me/5491156075633" style="color:${d.accentColor};text-decoration:none;font-weight:600">+54 9 11 5607-5633</a>
  </p>
</td></tr>

<tr><td style="background:#1e0050;padding:28px 40px;text-align:center">
  ${d.showLogo ? `<img src="https://flow-things-web.vercel.app/logo-light.png" height="36" alt="Flow Things" style="display:block;margin:0 auto 12px;opacity:0.85"/>` : `<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#a78bfa">${d.footerText}</p>`}
  <p style="margin:0"><a href="https://flowthings.com.ar" style="color:#a78bfa;text-decoration:none;font-size:13px;font-weight:600">flowthings.com.ar</a></p>
</td></tr>

</table></td></tr></table>
</body></html>`
}

// ─── Visual editors ───────────────────────────────────────────────────────────

function ConfirmVisualEditor({
  d, onChange,
}: { d: ConfirmDesign; onChange: (p: Partial<ConfirmDesign>) => void }) {
  return (
    <div className="space-y-4">
      <section className="bg-brand-bg-card border border-brand-border rounded-xl p-4 space-y-3">
        <p className="text-white text-sm font-semibold">Encabezado</p>
        <ColorInput label="Color de fondo" value={d.headerColor} onChange={v => onChange({ headerColor: v })} />
        <ColorInput label="Color de acento" value={d.accentColor} onChange={v => onChange({ accentColor: v })} />
        <div className="flex items-center justify-between py-0.5">
          <span className="text-brand-text text-sm">Mostrar logo</span>
          <Toggle value={d.showLogo} onChange={v => onChange({ showLogo: v })} />
        </div>
      </section>
      <section className="bg-brand-bg-card border border-brand-border rounded-xl p-4 space-y-4">
        <p className="text-white text-sm font-semibold">Textos</p>
        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Título <code className="text-brand-neon ml-1">{'{{nombre}}'}</code></label>
          <input value={d.titulo} onChange={e => onChange({ titulo: e.target.value })}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple" />
        </div>
        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Introducción</label>
          <textarea value={d.introText} onChange={e => onChange({ introText: e.target.value })} rows={2}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple resize-none" />
        </div>
        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Mensaje de cierre (cuadro "¿Qué sigue?")</label>
          <textarea value={d.closingText} onChange={e => onChange({ closingText: e.target.value })} rows={3}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple resize-none" />
        </div>
        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Footer</label>
          <input value={d.footerText} onChange={e => onChange({ footerText: e.target.value })}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple" />
        </div>
      </section>
      <div className="bg-brand-bg-card border border-brand-border rounded-xl p-4">
        <p className="text-brand-text-muted text-xs leading-relaxed">
          Los bloques de <strong className="text-white">productos</strong>, <strong className="text-white">subtotal</strong>,{' '}
          <strong className="text-white">descuento</strong>, <strong className="text-white">envío</strong> y{' '}
          <strong className="text-white">total</strong> se completan automáticamente con los datos reales de cada orden.
        </p>
      </div>
    </div>
  )
}

function DespachoVisualEditor({
  d, onChange,
}: { d: DespachoDesign; onChange: (p: Partial<DespachoDesign>) => void }) {
  return (
    <div className="space-y-4">
      <section className="bg-brand-bg-card border border-brand-border rounded-xl p-4 space-y-3">
        <p className="text-white text-sm font-semibold">Encabezado</p>
        <ColorInput label="Color de fondo" value={d.headerColor} onChange={v => onChange({ headerColor: v })} />
        <ColorInput label="Color de acento" value={d.accentColor} onChange={v => onChange({ accentColor: v })} />
        <div className="flex items-center justify-between py-0.5">
          <span className="text-brand-text text-sm">Mostrar logo</span>
          <Toggle value={d.showLogo} onChange={v => onChange({ showLogo: v })} />
        </div>
      </section>
      <section className="bg-brand-bg-card border border-brand-border rounded-xl p-4 space-y-4">
        <p className="text-white text-sm font-semibold">Textos</p>
        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Título <code className="text-brand-neon ml-1">{'{{nombre}}'}</code></label>
          <input value={d.headline} onChange={e => onChange({ headline: e.target.value })}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple" />
        </div>
        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Subtítulo</label>
          <input value={d.subtitleText} onChange={e => onChange({ subtitleText: e.target.value })}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple" />
        </div>
        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Texto de contacto</label>
          <textarea value={d.contactText} onChange={e => onChange({ contactText: e.target.value })} rows={2}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple resize-none" />
        </div>
        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Footer</label>
          <input value={d.footerText} onChange={e => onChange({ footerText: e.target.value })}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple" />
        </div>
      </section>
      <div className="bg-brand-bg-card border border-brand-border rounded-xl p-4">
        <p className="text-brand-text-muted text-xs leading-relaxed">
          El <strong className="text-white">courier</strong>, <strong className="text-white">código de seguimiento</strong> y{' '}
          <strong className="text-white">botón de tracking</strong> se completan desde el panel de despacho de cada orden.
        </p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type EmailTab = 'confirmacion' | 'despacho'
type EditMode = 'visual' | 'html'

export default function MailingPage() {
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [tab, setTab]           = useState<EmailTab>('confirmacion')
  const [mode, setMode]         = useState<EditMode>('visual')

  // Confirmación
  const [confirmAsunto, setConfirmAsunto] = useState('Tu pedido de Flow Things fue confirmado!')
  const [confirmDesign, setConfirmDesign] = useState<ConfirmDesign>(DEFAULT_CONFIRM_DESIGN)
  const [confirmHtml, setConfirmHtml]     = useState(() => buildConfirmHTML(DEFAULT_CONFIRM_DESIGN))

  // Despacho
  const [despachoAsunto, setDespachoAsunto] = useState('Tu pedido de Flow Things esta en camino!')
  const [despachoDesign, setDespachoDesign] = useState<DespachoDesign>(DEFAULT_DESPACHO_DESIGN)
  const [despachoHtml, setDespachoHtml]     = useState(() => buildDespachoHTML(DEFAULT_DESPACHO_DESIGN))

  // Preview (debounced)
  const [previewHtml, setPreviewHtml] = useState('')

  // Test send
  const [testEmail, setTestEmail] = useState('')
  const [sending, setSending]     = useState(false)
  const [sendMsg, setSendMsg]     = useState('')

  // Load from Supabase
  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(data => {
        const rows: { clave: string; valor: string }[] = data.data || []
        const cfg: Record<string, string> = {}
        rows.forEach(r => { cfg[r.clave] = r.valor })

        if (cfg.notif_email_asunto) setConfirmAsunto(cfg.notif_email_asunto)
        if (cfg.notif_despacho_asunto) setDespachoAsunto(cfg.notif_despacho_asunto)

        if (cfg.mailing_confirm_design) {
          try {
            const d = JSON.parse(cfg.mailing_confirm_design)
            setConfirmDesign(d)
            setConfirmHtml(buildConfirmHTML(d))
          } catch {}
        }
        if (cfg.notif_email_cuerpo && !cfg.mailing_confirm_design) {
          setConfirmHtml(cfg.notif_email_cuerpo)
        }
        if (cfg.mailing_despacho_design) {
          try {
            const d = JSON.parse(cfg.mailing_despacho_design)
            setDespachoDesign(d)
            setDespachoHtml(buildDespachoHTML(d))
          } catch {}
        }
        if (cfg.notif_despacho_cuerpo && !cfg.mailing_despacho_design) {
          setDespachoHtml(cfg.notif_despacho_cuerpo)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Rebuild HTML only when the design object itself changes (not when mode changes)
  // This prevents the visual editor from overwriting manual HTML edits on tab switch
  const prevConfirmDesign = useRef(confirmDesign)
  useEffect(() => {
    if (prevConfirmDesign.current !== confirmDesign) {
      prevConfirmDesign.current = confirmDesign
      setConfirmHtml(buildConfirmHTML(confirmDesign))
    }
  }, [confirmDesign])

  const prevDespachoDesign = useRef(despachoDesign)
  useEffect(() => {
    if (prevDespachoDesign.current !== despachoDesign) {
      prevDespachoDesign.current = despachoDesign
      setDespachoHtml(buildDespachoHTML(despachoDesign))
    }
  }, [despachoDesign])

  // Debounce preview
  useEffect(() => {
    const src = tab === 'confirmacion' ? confirmHtml : despachoHtml
    const vars = tab === 'confirmacion' ? PREVIEW_CONFIRMACION : PREVIEW_DESPACHO
    const t = setTimeout(() => setPreviewHtml(substituteVars(src, vars)), 250)
    return () => clearTimeout(t)
  }, [tab, confirmHtml, despachoHtml])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            notif_email_asunto: confirmAsunto,
            notif_email_cuerpo: confirmHtml,
            mailing_confirm_design: JSON.stringify(confirmDesign),
            notif_despacho_asunto: despachoAsunto,
            notif_despacho_cuerpo: despachoHtml,
            mailing_despacho_design: JSON.stringify(despachoDesign),
          },
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    if (!testEmail) return
    setSending(true)
    setSendMsg('')
    try {
      const isDespacho = tab === 'despacho'
      const asunto = isDespacho ? despachoAsunto : confirmAsunto
      const cuerpo = isDespacho ? despachoHtml : confirmHtml
      const vars   = isDespacho ? PREVIEW_DESPACHO : PREVIEW_CONFIRMACION

      const res = await fetch('/api/admin/mailing-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          asunto: substituteVars(asunto, vars),
          cuerpo: substituteVars(cuerpo, vars),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setSendMsg('Enviado a ' + testEmail)
    } catch (e: unknown) {
      setSendMsg('Error: ' + (e instanceof Error ? e.message : 'desconocido'))
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="p-8 text-brand-text-muted text-sm">Cargando...</div>

  const currentAsunto  = tab === 'confirmacion' ? confirmAsunto : despachoAsunto
  const setCurrentAsunto = tab === 'confirmacion' ? setConfirmAsunto : setDespachoAsunto
  const currentHtml    = tab === 'confirmacion' ? confirmHtml : despachoHtml
  const setCurrentHtml = tab === 'confirmacion' ? setConfirmHtml : setDespachoHtml

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-brand-border bg-brand-bg-card flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white">Mailing</h1>
          <p className="text-brand-text-muted text-xs mt-0.5">Diseñá los emails que reciben tus clientes</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-green-400 text-sm font-medium">Guardado</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-xl transition-colors text-sm">
            {saving ? 'Guardando...' : 'Guardar todo'}
          </button>
        </div>
      </div>

      {/* Split */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Editor */}
        <div className="w-[430px] flex-shrink-0 border-r border-brand-border overflow-y-auto bg-brand-bg">
          <div className="p-5 space-y-5">

            {/* Email type tabs */}
            <div className="flex bg-brand-bg-card border border-brand-border rounded-xl p-1 gap-1">
              {([
                { key: 'confirmacion', label: '🎉 Confirmación de compra' },
                { key: 'despacho',     label: '🚚 Pedido despachado' },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === t.key ? 'bg-brand-purple text-white' : 'text-brand-text-muted hover:text-white'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Asunto */}
            <div>
              <label className="block text-white text-sm font-medium mb-1.5">Asunto del email</label>
              <input value={currentAsunto} onChange={e => setCurrentAsunto(e.target.value)}
                className="w-full bg-brand-bg-card border border-brand-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-purple" />
            </div>

            {/* Visual / HTML selector */}
            <div className="flex bg-brand-bg-card border border-brand-border rounded-xl p-1 gap-1">
              {(['visual', 'html'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === m ? 'bg-white/10 text-white' : 'text-brand-text-muted hover:text-white'}`}>
                  {m === 'visual' ? '🎨 Visual' : '💻 HTML'}
                </button>
              ))}
            </div>

            {/* Editor content */}
            {mode === 'visual' ? (
              tab === 'confirmacion'
                ? <ConfirmVisualEditor d={confirmDesign} onChange={p => setConfirmDesign(prev => ({ ...prev, ...p }))} />
                : <DespachoVisualEditor d={despachoDesign} onChange={p => setDespachoDesign(prev => ({ ...prev, ...p }))} />
            ) : (
              <textarea value={currentHtml} onChange={e => setCurrentHtml(e.target.value)} rows={32}
                className="w-full bg-brand-bg-card border border-brand-border rounded-xl px-3 py-3 text-white text-xs font-mono focus:outline-none focus:border-brand-purple resize-none" />
            )}

            {/* Test send */}
            <div className="bg-brand-bg-card border border-brand-border rounded-xl p-4 space-y-3">
              <p className="text-white text-sm font-semibold">Enviar prueba</p>
              <p className="text-brand-text-muted text-xs">
                Se envía el email del tab activo con datos de ejemplo.
              </p>
              <div className="flex gap-2">
                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="flex-1 bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple placeholder:text-brand-text-muted" />
                <button onClick={handleSendTest} disabled={sending || !testEmail}
                  className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors">
                  {sending ? '...' : 'Enviar'}
                </button>
              </div>
              {sendMsg && (
                <p className={`text-sm font-medium ${sendMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                  {sendMsg.startsWith('Error') ? '❌ ' : '✅ '}{sendMsg}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* RIGHT: Preview */}
        <div className="flex-1 overflow-auto" style={{ background: '#d1d5db' }}>
          <div className="max-w-[680px] mx-auto py-6 px-4">
            <p className="text-center text-xs text-gray-500 mb-3 font-medium tracking-wide uppercase">
              Vista previa — datos de ejemplo
            </p>
            <iframe srcDoc={previewHtml} title="preview" className="w-full rounded-xl shadow-xl border-0"
              style={{ minHeight: '800px', background: '#fff' }} />
          </div>
        </div>

      </div>
    </div>
  )
}
