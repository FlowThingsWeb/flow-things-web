'use client'

import { useState, useEffect } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmailDesign {
  headerColor: string
  accentColor: string
  showLogo: boolean
  titulo: string
  introText: string
  closingText: string
  footerText: string
}

const DEFAULT_DESIGN: EmailDesign = {
  headerColor: '#7C3AED',
  accentColor: '#7C3AED',
  showLogo: true,
  titulo: '¡Gracias, {{nombre}}! 🎉',
  introText: 'Recibimos tu pedido y ya lo estamos preparando con mucho cariño.',
  closingText: 'Te avisaremos cuando tu pedido sea despachado.\nAnte cualquier consulta escribinos por Instagram @flowthings__',
  footerText: 'Flow Things · flowthings.com.ar',
}

// ─── Template builder ─────────────────────────────────────────────────────────

function buildHTML(d: EmailDesign): string {
  const logoBlock = d.showLogo
    ? `<img src="https://flow-things-web.vercel.app/logo-light.png" height="44" alt="Flow Things" style="display:block;margin:0 auto"/>`
    : `<span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:-0.5px">Flow Things</span>`

  const closingFormatted = d.closingText
    .split('\n')
    .map(l => l.trim())
    .join('<br/>')

  const footerLinked = d.footerText.replace(
    'flowthings.com.ar',
    `<a href="https://flowthings.com.ar" style="color:${d.accentColor};text-decoration:none">flowthings.com.ar</a>`
  )

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:${d.headerColor};padding:28px 32px;text-align:center">
            ${logoBlock}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <h1 style="margin:0 0 10px;font-size:22px;color:#111;font-weight:700">${d.titulo}</h1>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.7">${d.introText}</p>

            <!-- Resumen orden -->
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
                  <td style="color:${d.accentColor};font-size:16px;font-weight:bold;text-align:right;border-top:1px solid #e5e7eb;padding-top:8px">{{total}}</td>
                </tr>
              </table>
            </div>

            <!-- Productos -->
            <p style="margin:0 0 8px;color:#111;font-size:14px;font-weight:bold">Productos</p>
            <div style="color:#555;font-size:14px;line-height:1.9;margin-bottom:28px">{{productos}}</div>

            <!-- Cierre -->
            <p style="margin:0;color:#555;font-size:14px;line-height:1.7">${closingFormatted}</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f4f5;padding:20px 40px;text-align:center;color:#999;font-size:12px">
            ${footerLinked}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Preview substitution ─────────────────────────────────────────────────────

const PREVIEW_VARS: Record<string, string> = {
  nombre: 'María García',
  orden_id: '12345',
  total: '$ 8.500,00',
  fecha: '12/06/2026',
  productos: '• Muñeca articulada premium x1<br/>• LEGO City Set 60303 x2<br/>• Puzzle madera 100 piezas x1',
}

function substituteVars(html: string): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => PREVIEW_VARS[key] ?? `{{${key}}}`)
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

function VisualEditor({ design, onChange }: { design: EmailDesign; onChange: (p: Partial<EmailDesign>) => void }) {
  return (
    <div className="space-y-4">

      {/* Encabezado */}
      <section className="bg-brand-bg-card border border-brand-border rounded-xl p-4 space-y-3">
        <p className="text-white text-sm font-semibold mb-1">Encabezado</p>
        <ColorInput label="Color de fondo" value={design.headerColor} onChange={v => onChange({ headerColor: v })} />
        <div className="flex items-center justify-between py-0.5">
          <span className="text-brand-text text-sm">Mostrar logo</span>
          <Toggle value={design.showLogo} onChange={v => onChange({ showLogo: v })} />
        </div>
      </section>

      {/* Color de acento */}
      <section className="bg-brand-bg-card border border-brand-border rounded-xl p-4 space-y-3">
        <p className="text-white text-sm font-semibold mb-1">Colores</p>
        <ColorInput label="Color de acento" value={design.accentColor} onChange={v => onChange({ accentColor: v })} />
        <p className="text-brand-text-muted text-xs">Se usa en el total de la orden y links del footer.</p>
      </section>

      {/* Contenido */}
      <section className="bg-brand-bg-card border border-brand-border rounded-xl p-4 space-y-4">
        <p className="text-white text-sm font-semibold">Contenido</p>

        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">
            Título — podés usar <code className="text-brand-neon">{'{{nombre}}'}</code>
          </label>
          <input
            value={design.titulo}
            onChange={e => onChange({ titulo: e.target.value })}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple"
          />
        </div>

        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Introducción</label>
          <textarea
            value={design.introText}
            onChange={e => onChange({ introText: e.target.value })}
            rows={2}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple resize-none"
          />
        </div>

        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Mensaje de cierre</label>
          <textarea
            value={design.closingText}
            onChange={e => onChange({ closingText: e.target.value })}
            rows={3}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple resize-none"
          />
        </div>

        <div>
          <label className="block text-brand-text-muted text-xs mb-1.5">Texto del footer</label>
          <input
            value={design.footerText}
            onChange={e => onChange({ footerText: e.target.value })}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple"
          />
        </div>
      </section>
    </div>
  )
}

const VARIABLES = [
  { key: '{{nombre}}',    desc: 'Nombre del comprador' },
  { key: '{{orden_id}}',  desc: 'Número de orden' },
  { key: '{{total}}',     desc: 'Total de la compra' },
  { key: '{{fecha}}',     desc: 'Fecha del pedido' },
  { key: '{{productos}}', desc: 'Lista de productos' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MailingPage() {
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [mode, setMode]             = useState<'visual' | 'html'>('visual')

  const [asunto, setAsunto]         = useState('Tu pedido de Flow Things fue confirmado 🎉')
  const [design, setDesign]         = useState<EmailDesign>(DEFAULT_DESIGN)
  const [htmlCuerpo, setHtmlCuerpo] = useState(() => buildHTML(DEFAULT_DESIGN))
  const [previewHtml, setPreviewHtml] = useState(() => substituteVars(buildHTML(DEFAULT_DESIGN)))

  const [testEmail, setTestEmail]   = useState('')
  const [sending, setSending]       = useState(false)
  const [sendMsg, setSendMsg]       = useState('')

  // Load config from Supabase
  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(data => {
        const rows: { clave: string; valor: string }[] = data.data || []
        const cfg: Record<string, string> = {}
        rows.forEach(r => { cfg[r.clave] = r.valor })

        if (cfg.notif_email_asunto) setAsunto(cfg.notif_email_asunto)

        if (cfg.mailing_design) {
          try {
            const d: EmailDesign = JSON.parse(cfg.mailing_design)
            setDesign(d)
            const html = buildHTML(d)
            setHtmlCuerpo(html)
            setPreviewHtml(substituteVars(html))
          } catch { /* use defaults */ }
        } else if (cfg.notif_email_cuerpo) {
          setHtmlCuerpo(cfg.notif_email_cuerpo)
          setPreviewHtml(substituteVars(cfg.notif_email_cuerpo))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Visual mode: rebuild HTML when design changes
  useEffect(() => {
    if (mode !== 'visual') return
    const html = buildHTML(design)
    setHtmlCuerpo(html)
  }, [design, mode])

  // Debounce preview (avoids iframe flicker while typing in HTML mode)
  useEffect(() => {
    const t = setTimeout(() => setPreviewHtml(substituteVars(htmlCuerpo)), 300)
    return () => clearTimeout(t)
  }, [htmlCuerpo])

  const updateDesign = (patch: Partial<EmailDesign>) =>
    setDesign(prev => ({ ...prev, ...patch }))

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            notif_email_asunto: asunto,
            notif_email_cuerpo: htmlCuerpo,
            mailing_design: JSON.stringify(design),
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
      const res = await fetch('/api/admin/mailing-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, asunto, cuerpo: htmlCuerpo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconocido')
      setSendMsg('✅ Email enviado')
    } catch (e: unknown) {
      setSendMsg('❌ ' + (e instanceof Error ? e.message : 'Error desconocido'))
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="p-8 text-brand-text-muted text-sm">Cargando...</div>

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-brand-border bg-brand-bg-card flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white">Mailing</h1>
          <p className="text-brand-text-muted text-xs mt-0.5">Email de confirmación de compra</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-green-400 text-sm font-medium">✓ Guardado</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-xl transition-colors text-sm"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Editor panel */}
        <div className="w-[420px] flex-shrink-0 border-r border-brand-border overflow-y-auto bg-brand-bg">
          <div className="p-5 space-y-5">

            {/* Asunto */}
            <div>
              <label className="block text-white text-sm font-medium mb-1.5">Asunto del email</label>
              <input
                value={asunto}
                onChange={e => setAsunto(e.target.value)}
                className="w-full bg-brand-bg-card border border-brand-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-purple"
              />
            </div>

            {/* Mode selector */}
            <div className="flex bg-brand-bg-card border border-brand-border rounded-xl p-1 gap-1">
              {(['visual', 'html'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === m
                      ? 'bg-brand-purple text-white shadow-sm'
                      : 'text-brand-text-muted hover:text-white'
                  }`}
                >
                  {m === 'visual' ? '🎨 Visual' : '💻 HTML'}
                </button>
              ))}
            </div>

            {/* Editor content */}
            {mode === 'visual' ? (
              <VisualEditor design={design} onChange={updateDesign} />
            ) : (
              <div className="space-y-2">
                <label className="block text-white text-sm font-medium">HTML del email</label>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {VARIABLES.map(v => (
                    <span key={v.key} title={v.desc} className="px-2 py-0.5 bg-brand-purple/20 text-brand-neon text-xs font-mono rounded-md cursor-default">
                      {v.key}
                    </span>
                  ))}
                </div>
                <textarea
                  value={htmlCuerpo}
                  onChange={e => setHtmlCuerpo(e.target.value)}
                  rows={30}
                  className="w-full bg-brand-bg-card border border-brand-border rounded-xl px-3 py-3 text-white text-xs font-mono focus:outline-none focus:border-brand-purple resize-none"
                />
              </div>
            )}

            {/* Send test */}
            <div className="bg-brand-bg-card border border-brand-border rounded-xl p-4 space-y-3">
              <p className="text-white text-sm font-semibold">Enviar email de prueba</p>
              <p className="text-brand-text-muted text-xs">
                Se envía el email tal como lo verá el cliente, con datos de ejemplo.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="flex-1 bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-purple placeholder:text-brand-text-muted"
                />
                <button
                  onClick={handleSendTest}
                  disabled={sending || !testEmail}
                  className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors"
                >
                  {sending ? '...' : '✉️ Enviar'}
                </button>
              </div>
              {sendMsg && (
                <p className={`text-sm font-medium ${sendMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                  {sendMsg}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* RIGHT: Live preview */}
        <div className="flex-1 overflow-auto" style={{ background: '#d1d5db' }}>
          <div className="max-w-[680px] mx-auto py-6 px-4">
            <p className="text-center text-xs text-gray-500 mb-3 font-medium tracking-wide uppercase">
              Vista previa — datos de ejemplo
            </p>
            <iframe
              srcDoc={previewHtml}
              title="preview"
              className="w-full rounded-xl shadow-xl border-0"
              style={{ minHeight: '760px', background: '#fff' }}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
