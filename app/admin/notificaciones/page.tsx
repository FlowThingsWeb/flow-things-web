'use client'

import { useState, useEffect, useRef } from 'react'
import { DEFAULT_EMAIL_ASUNTO, DEFAULT_EMAIL_CUERPO } from '@/lib/email-constants'

const VARIABLES = [
  { key: '{{nombre}}',    desc: 'Nombre del comprador' },
  { key: '{{orden_id}}',  desc: 'Número de orden' },
  { key: '{{total}}',     desc: 'Total de la compra' },
  { key: '{{fecha}}',     desc: 'Fecha del pedido' },
  { key: '{{productos}}', desc: 'Lista de productos' },
]

export default function NotificacionesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const [emailOn,     setEmailOn]     = useState(true)
  const [emailAsunto, setEmailAsunto] = useState(DEFAULT_EMAIL_ASUNTO)
  const [emailCuerpo, setEmailCuerpo] = useState(DEFAULT_EMAIL_CUERPO)

  const cuerpoRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(data => {
        const cfg: Record<string, string> = {}
        const rows: { clave: string; valor: string }[] = data.data || []
        rows.forEach(r => { cfg[r.clave] = r.valor })
        if (cfg.notif_email_habilitado !== undefined) setEmailOn(cfg.notif_email_habilitado === 'true')
        if (cfg.notif_email_asunto) setEmailAsunto(cfg.notif_email_asunto)
        if (cfg.notif_email_cuerpo) setEmailCuerpo(cfg.notif_email_cuerpo)
      })
      .finally(() => setLoading(false))
  }, [])

  const insertVar = (v: string) => {
    const el = cuerpoRef.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const next  = el.value.slice(0, start) + v + el.value.slice(end)
    setEmailCuerpo(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + v.length, start + v.length)
    }, 0)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            notif_email_habilitado: String(emailOn),
            notif_email_asunto: emailAsunto,
            notif_email_cuerpo: emailCuerpo,
          },
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-brand-text-muted text-sm">Cargando...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Notificaciones post-venta</h1>
        <p className="text-brand-text-muted mt-1 text-sm">
          Email automático al cliente cuando su pago es aprobado.
        </p>
      </div>

      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 space-y-5">

        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm">Enviar email de confirmación</p>
            <p className="text-brand-text-muted text-xs mt-0.5">
              Usa tu cuenta de Gmail · requiere <code className="text-brand-neon">GMAIL_USER</code> y <code className="text-brand-neon">GMAIL_APP_PASSWORD</code> en Vercel
            </p>
          </div>
          <button
            onClick={() => setEmailOn(v => !v)}
            className={`relative w-12 h-6 rounded-full transition-colors ${emailOn ? 'bg-brand-purple' : 'bg-brand-border'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${emailOn ? 'translate-x-7' : 'translate-x-1'}`}/>
          </button>
        </div>

        <hr className="border-brand-border"/>

        {/* Variables */}
        <div>
          <p className="text-brand-text-muted text-xs mb-2">Variables — click para insertar en el cursor:</p>
          <div className="flex flex-wrap gap-2">
            {VARIABLES.map(v => (
              <button
                key={v.key}
                onClick={() => insertVar(v.key)}
                title={v.desc}
                className="px-3 py-1 bg-brand-purple/20 hover:bg-brand-purple/40 text-brand-neon text-xs font-mono rounded-lg transition-colors"
              >
                {v.key}
              </button>
            ))}
          </div>
        </div>

        {/* Asunto */}
        <div>
          <label className="block text-white text-sm font-medium mb-1.5">Asunto</label>
          <input
            type="text"
            value={emailAsunto}
            onChange={e => setEmailAsunto(e.target.value)}
            className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-purple"
          />
        </div>

        {/* Cuerpo */}
        <div>
          <label className="block text-white text-sm font-medium mb-1.5">
            Cuerpo del email <span className="text-brand-text-muted font-normal">(HTML)</span>
          </label>
          <textarea
            ref={cuerpoRef}
            value={emailCuerpo}
            onChange={e => setEmailCuerpo(e.target.value)}
            rows={18}
            className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-brand-purple resize-y"
          />
          <p className="text-brand-text-muted text-xs mt-1">
            HTML completo o texto plano. Las variables se reemplazan automáticamente al enviar.
          </p>
        </div>

        {/* Guardar */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          {saved && <span className="text-green-400 text-sm">✓ Guardado</span>}
        </div>
      </div>

      {/* Setup Gmail */}
      <div className="mt-6 bg-brand-bg-card border border-brand-border rounded-2xl p-5">
        <p className="text-white text-sm font-semibold mb-1">Cómo configurar Gmail (gratis, 5 min)</p>
        <ol className="mt-3 space-y-2 text-xs text-brand-text-muted list-decimal list-inside">
          <li>En tu cuenta Gmail → <strong className="text-white">Seguridad</strong> → activar Verificación en 2 pasos</li>
          <li>Buscar <strong className="text-white">Contraseñas de aplicaciones</strong> → Crear → elegir &ldquo;Correo&rdquo;</li>
          <li>Copiar los 16 caracteres generados</li>
          <li>En Vercel → Settings → Environment Variables agregar:</li>
        </ol>
        <div className="mt-3 space-y-1.5 text-xs font-mono">
          {[
            { k: 'GMAIL_USER',         d: 'tuemail@gmail.com' },
            { k: 'GMAIL_APP_PASSWORD', d: 'abcd efgh ijkl mnop  (los 16 caracteres)' },
          ].map(v => (
            <div key={v.k} className="flex gap-3">
              <span className="text-brand-neon shrink-0">{v.k}</span>
              <span className="text-brand-text-muted">{v.d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
