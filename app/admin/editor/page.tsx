'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

// --- helpers ---

function lighten(hex: string, amount: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const clamp = (v: number) => Math.min(255, Math.max(0, v))
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0')
  return `#${toHex(r + amount)}${toHex(g + amount)}${toHex(b + amount)}`
}

function hexToRgb(hex: string): string {
  if (!hex.startsWith('#') || hex.length < 7) return '0,0,0'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

function generateCSS(primary: string, accent: string, bg: string, font: string): string {
  const bgCard  = lighten(bg, 12)
  const bgSoft  = lighten(bg, 8)
  const border  = lighten(bg, 25)
  const fontImport = (font && font !== 'inherit')
    ? `@import url('https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@300;400;500;600;700;800&display=swap');\n`
    : ''
  const fontStack = (font && font !== 'inherit') ? `'${font}', sans-serif` : 'inherit'

  return `${fontImport}
:root {
  --color-bg: ${bg};
  --color-bg-card: ${bgCard};
  --color-bg-soft: ${bgSoft};
  --color-purple: ${primary};
  --color-neon: ${accent};
  --color-border: ${border};
}
html, body { background-color: ${bg} !important; }
body { font-family: ${fontStack} !important; }
.bg-brand-bg { background-color: ${bg} !important; }
.bg-brand-bg-card { background-color: ${bgCard} !important; }
.bg-brand-bg-soft { background-color: ${bgSoft} !important; }
.bg-brand-border { background-color: ${border} !important; }
.border-brand-border { border-color: ${border} !important; }
.bg-brand-purple { background-color: ${primary} !important; }
.hover\\:bg-brand-purple:hover { background-color: ${primary} !important; }
.text-brand-purple { color: ${primary} !important; }
.hover\\:text-brand-purple:hover { color: ${primary} !important; }
.border-brand-purple { border-color: ${primary} !important; }
.ring-brand-purple { --tw-ring-color: ${primary}; }
.bg-brand-purple\\/20 { background-color: ${primary}33 !important; }
.bg-brand-purple\\/10 { background-color: ${primary}1a !important; }
.bg-brand-purple\\/30 { background-color: ${primary}4d !important; }
.focus\\:border-brand-purple:focus { border-color: ${primary} !important; }
.focus\\:ring-brand-purple:focus { --tw-ring-color: ${primary}; }
.hover\\:border-brand-purple\\/40:hover { border-color: ${primary}66 !important; }
.bg-brand-neon { background-color: ${accent} !important; }
.text-brand-neon { color: ${accent} !important; }
.border-brand-neon { border-color: ${accent} !important; }
.hover\\:bg-brand-neon:hover { background-color: ${accent} !important; }
.text-brand-purple-light { color: ${lighten(primary, 40)} !important; }
.shadow-soft { box-shadow: 0 4px 24px rgba(${hexToRgb(primary)},0.3) !important; }
`
}

// --- preset themes ---
const THEMES = [
  { label: 'Oscuro (default)', primary: '#9333ea', accent: '#c8ff00', bg: '#0f0f0f', font: 'inherit' },
  { label: 'Medianoche', primary: '#6366f1', accent: '#38bdf8', bg: '#030712', font: 'Inter' },
  { label: 'Claro', primary: '#7c3aed', accent: '#10b981', bg: '#f9fafb', font: 'Nunito' },
  { label: 'Fuego', primary: '#ef4444', accent: '#f59e0b', bg: '#0c0a09', font: 'Montserrat' },
  { label: 'Ocean', primary: '#0ea5e9', accent: '#06b6d4', bg: '#0c1821', font: 'Poppins' },
  { label: 'Rosa', primary: '#ec4899', accent: '#f472b6', bg: '#0f0a0f', font: 'Raleway' },
]

const FONTS = ['inherit', 'Inter', 'Poppins', 'Nunito', 'Montserrat', 'Raleway', 'Lato', 'Open Sans']

export default function EditorPage() {
  const [saveFlash, setSaveFlash]     = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Design state
  const [primary, setPrimary] = useState('#9333ea')
  const [accent,  setAccent]  = useState('#c8ff00')
  const [bg,      setBg]      = useState('#0f0f0f')
  const [font,    setFont]    = useState('inherit')
  const [designSaving, setDesignSaving] = useState(false)
  const [designSaved,  setDesignSaved]  = useState(false)

  // Load current config on mount
  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then((rows: { clave: string; valor: string }[]) => {
        const kv: Record<string, string> = {}
        for (const row of rows) kv[row.clave] = row.valor
        if (kv.design_color_primary) setPrimary(kv.design_color_primary)
        if (kv.design_color_accent)  setAccent(kv.design_color_accent)
        if (kv.design_color_bg)      setBg(kv.design_color_bg)
        if (kv.design_font_family)   setFont(kv.design_font_family)
      })
      .catch(() => {/* use defaults */})
  }, [])

  // Listen for config_saved from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'config_saved') {
        setSaveFlash(true)
        setTimeout(() => setSaveFlash(false), 2500)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Inject CSS into iframe for live preview
  const injectCSS = useCallback((p: string, a: string, b: string, f: string) => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    let el = doc.getElementById('flow-design-override') as HTMLStyleElement | null
    if (!el) {
      el = doc.createElement('style') as HTMLStyleElement
      el.id = 'flow-design-override'
      doc.head?.appendChild(el)
    }
    el.textContent = generateCSS(p, a, b, f)
  }, [])

  // Preview on each color/font change (debounced a bit with timeout in handlers)
  useEffect(() => {
    if (iframeLoaded) {
      injectCSS(primary, accent, bg, font)
    }
  }, [primary, accent, bg, font, iframeLoaded, injectCSS])

  const saveDesign = useCallback(async () => {
    setDesignSaving(true)
    const css = generateCSS(primary, accent, bg, font)
    const pairs = [
      { clave: 'design_overrides',      valor: css },
      { clave: 'design_color_primary',  valor: primary },
      { clave: 'design_color_accent',   valor: accent },
      { clave: 'design_color_bg',       valor: bg },
      { clave: 'design_font_family',    valor: font },
    ]
    await Promise.all(pairs.map(p =>
      fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
    ))
    setDesignSaving(false)
    setDesignSaved(true)
    setTimeout(() => setDesignSaved(false), 3000)
  }, [primary, accent, bg, font])

  const applyTheme = (t: typeof THEMES[0]) => {
    setPrimary(t.primary)
    setAccent(t.accent)
    setBg(t.bg)
    setFont(t.font)
  }

  const label = (text: string) => (
    <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, marginTop: 16 }}>
      {text}
    </p>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#0f0f0f' }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0 }} className="flex items-center gap-3 px-5 h-12 bg-[#111827] border-b border-white/10 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-brand-purple flex items-center justify-center">
            <span className="text-white text-xs font-bold">F</span>
          </div>
          <span className="text-white text-sm font-semibold">Flow Things</span>
          <span className="text-white/30 text-sm">/</span>
          <span className="text-white/60 text-sm">Editor de página</span>
        </div>

        {/* Save indicator */}
        <div className="flex items-center gap-2 ml-4">
          {saveFlash ? (
            <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Cambio guardado
            </span>
          ) : iframeLoaded ? (
            <span className="flex items-center gap-1.5 text-white/40 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
              Edición en vivo
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-white/40 text-xs">
              <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
              Cargando...
            </span>
          )}
        </div>

        {iframeLoaded && (
          <span className="hidden md:block mx-auto text-xs text-white/30">
            Hacé clic en cualquier texto o imagen para editarlo · Seleccioná texto para cambiar formato
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { if (iframeRef.current) iframeRef.current.src = iframeRef.current.src }}
            className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            ↺ Recargar
          </button>
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
            🌐 Ver sitio
          </a>
          <Link href="/admin"
            className="text-xs bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-lg transition-colors font-medium">
            ← Volver al admin
          </Link>
        </div>
      </div>

      {/* Content: iframe + design panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Iframe (site preview) */}
        <iframe
          ref={iframeRef}
          src="/?editMode=1"
          style={{ flex: 1, border: 'none', minWidth: 0 }}
          onLoad={() => setIframeLoaded(true)}
          title="Editor de página"
        />

        {/* Design panel */}
        <div style={{
          width: 288,
          flexShrink: 0,
          background: '#111827',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          overflowY: 'auto',
          padding: '16px 16px 32px',
          fontSize: 13,
          color: '#e5e7eb',
        }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🎨 Diseño</p>
          <p style={{ color: '#6b7280', fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
            Cambiá colores y tipografía. La vista previa se actualiza en tiempo real.
          </p>

          {/* Preset themes */}
          {label('Temas prediseñados')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {THEMES.map(t => (
              <button
                key={t.label}
                onClick={() => applyTheme(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: '#1f2937', border: '1px solid #374151',
                  borderRadius: 7, padding: '7px 10px', cursor: 'pointer',
                  color: '#e5e7eb', fontSize: 11, textAlign: 'left',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#9333ea')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#374151')}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                  background: `linear-gradient(135deg, ${t.primary} 50%, ${t.accent} 50%)`,
                  border: '1px solid rgba(255,255,255,0.1)',
                }} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Colors */}
          {label('Color principal')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color" value={primary}
              onChange={e => setPrimary(e.target.value)}
              style={{ width: 40, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none', padding: 2 }}
            />
            <input
              type="text" value={primary}
              onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setPrimary(e.target.value) }}
              style={{
                flex: 1, background: '#1f2937', border: '1px solid #374151',
                borderRadius: 6, color: '#e5e7eb', fontSize: 13,
                padding: '7px 10px', outline: 'none', fontFamily: 'monospace',
              }}
            />
          </div>
          <p style={{ color: '#6b7280', fontSize: 10, marginTop: 4 }}>Botones, enlaces, highlights</p>

          {label('Color de acento')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color" value={accent}
              onChange={e => setAccent(e.target.value)}
              style={{ width: 40, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none', padding: 2 }}
            />
            <input
              type="text" value={accent}
              onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setAccent(e.target.value) }}
              style={{
                flex: 1, background: '#1f2937', border: '1px solid #374151',
                borderRadius: 6, color: '#e5e7eb', fontSize: 13,
                padding: '7px 10px', outline: 'none', fontFamily: 'monospace',
              }}
            />
          </div>
          <p style={{ color: '#6b7280', fontSize: 10, marginTop: 4 }}>Precios, badges, íconos</p>

          {label('Color de fondo')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color" value={bg}
              onChange={e => setBg(e.target.value)}
              style={{ width: 40, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none', padding: 2 }}
            />
            <input
              type="text" value={bg}
              onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBg(e.target.value) }}
              style={{
                flex: 1, background: '#1f2937', border: '1px solid #374151',
                borderRadius: 6, color: '#e5e7eb', fontSize: 13,
                padding: '7px 10px', outline: 'none', fontFamily: 'monospace',
              }}
            />
          </div>
          <p style={{ color: '#6b7280', fontSize: 10, marginTop: 4 }}>Fondo principal · Las variaciones se calculan automáticamente</p>

          {/* Font */}
          {label('Tipografía')}
          <select
            value={font}
            onChange={e => setFont(e.target.value)}
            style={{
              width: '100%', background: '#1f2937', border: '1px solid #374151',
              borderRadius: 6, color: '#e5e7eb', fontSize: 13,
              padding: '8px 10px', outline: 'none', cursor: 'pointer',
            }}
          >
            {FONTS.map(f => (
              <option key={f} value={f}>
                {f === 'inherit' ? 'Predeterminado (sistema)' : f}
              </option>
            ))}
          </select>
          <p style={{ color: '#6b7280', fontSize: 10, marginTop: 4 }}>
            Se carga desde Google Fonts · afecta a todo el texto del sitio
          </p>

          {/* Preview of colors */}
          {label('Vista previa')}
          <div style={{
            background: bg, borderRadius: 10, padding: 14,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: primary, color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontFamily: font === 'inherit' ? 'inherit' : `${font}, sans-serif` }}>Botón</span>
              <span style={{ color: accent, fontSize: 14, fontWeight: 700, fontFamily: font === 'inherit' ? 'inherit' : `${font}, sans-serif` }}>$9.999</span>
              <span style={{ color: lighten(bg, 120), fontSize: 12, fontFamily: font === 'inherit' ? 'inherit' : `${font}, sans-serif` }}>Texto</span>
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={saveDesign}
            disabled={designSaving}
            style={{
              width: '100%', marginTop: 20,
              background: designSaved ? '#16a34a' : '#9333ea',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '11px 0', fontSize: 13, fontWeight: 600,
              cursor: designSaving ? 'not-allowed' : 'pointer',
              opacity: designSaving ? 0.7 : 1,
              transition: 'background 0.2s',
            }}
          >
            {designSaving ? '⏳ Guardando...' : designSaved ? '✓ Diseño guardado' : '💾 Guardar diseño'}
          </button>
          <p style={{ color: '#6b7280', fontSize: 10, marginTop: 6, textAlign: 'center' }}>
            Los cambios se aplican al sitio público inmediatamente
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />

          {/* Reset to default */}
          <button
            onClick={() => applyTheme(THEMES[0])}
            style={{
              width: '100%', background: 'transparent', border: '1px solid #374151',
              color: '#9ca3af', borderRadius: 8, padding: '8px 0', fontSize: 12,
              cursor: 'pointer', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#6b7280')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#374151')}
          >
            ↩ Restaurar diseño original
          </button>
        </div>
      </div>
    </div>
  )
}
