'use client'

import { useEffect, useMemo, useState } from 'react'

type Difusion = {
  id: string
  titulo: string
  asunto: string
  cuerpo: string
  enviada_at: string | null
  destinatarios_count: number | null
  updated_at: string
}

type Destinatario = { id: string; email: string; nombre: string; compro: boolean }
type Segmento = 'todos' | 'compradores' | 'sin_compras'

const EMPTY = { titulo: '', asunto: '', cuerpo: '' }

export default function DifusionesPage() {
  const [difusiones, setDifusiones] = useState<Difusion[]>([])
  const [cargando, setCargando] = useState(true)
  const [sel, setSel] = useState<string | null>(null) // id en edición, null = nueva
  const [form, setForm] = useState(EMPTY)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Envío
  const [enviando, setEnviando] = useState(false)
  const [mostrarEnvio, setMostrarEnvio] = useState(false)
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([])
  const [cargandoDest, setCargandoDest] = useState(false)
  const [segmento, setSegmento] = useState<Segmento>('todos')
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [buscar, setBuscar] = useState('')
  const [resultado, setResultado] = useState('')

  async function cargar() {
    setCargando(true)
    try {
      const res = await fetch('/api/admin/difusiones')
      const data = await res.json()
      setDifusiones(data.data ?? [])
    } catch {
      setError('No se pudieron cargar las difusiones.')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { cargar() }, [])

  function nueva() {
    setSel(null); setForm(EMPTY); setMsg(''); setError(''); setMostrarEnvio(false)
  }
  function editar(d: Difusion) {
    setSel(d.id); setForm({ titulo: d.titulo, asunto: d.asunto, cuerpo: d.cuerpo })
    setMsg(''); setError(''); setMostrarEnvio(false)
  }

  async function guardar() {
    if (!form.titulo.trim()) { setError('Poné un título.'); return }
    setGuardando(true); setError(''); setMsg('')
    try {
      const url = sel ? `/api/admin/difusiones/${sel}` : '/api/admin/difusiones'
      const res = await fetch(url, {
        method: sel ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al guardar.'); return }
      setMsg('Guardado ✓')
      if (!sel && data.data?.id) setSel(data.data.id)
      await cargar()
    } finally { setGuardando(false) }
  }

  async function duplicar(d: Difusion) {
    setGuardando(true)
    try {
      await fetch('/api/admin/difusiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: `${d.titulo} (copia)`, asunto: d.asunto, cuerpo: d.cuerpo }),
      })
      await cargar()
    } finally { setGuardando(false) }
  }

  async function eliminar(d: Difusion) {
    if (!confirm(`¿Eliminar la difusión "${d.titulo}"?`)) return
    await fetch(`/api/admin/difusiones/${d.id}`, { method: 'DELETE' })
    if (sel === d.id) nueva()
    await cargar()
  }

  // ── Envío ──
  async function abrirEnvio() {
    if (!form.asunto.trim() || !form.cuerpo.trim()) {
      setError('Completá asunto y cuerpo antes de enviar.'); return
    }
    setMostrarEnvio(true); setResultado(''); setCargandoDest(true)
    try {
      const res = await fetch('/api/admin/broadcast/destinatarios')
      const data = await res.json()
      const dest: Destinatario[] = data.data ?? []
      setDestinatarios(dest)
      aplicarSegmento('todos', dest)
    } finally { setCargandoDest(false) }
  }

  function aplicarSegmento(s: Segmento, base?: Destinatario[]) {
    setSegmento(s)
    const list = base ?? destinatarios
    const set = new Set<string>()
    for (const d of list) {
      if (s === 'todos' || (s === 'compradores' && d.compro) || (s === 'sin_compras' && !d.compro)) {
        set.add(d.id)
      }
    }
    setMarcados(set)
  }

  function toggle(id: string) {
    setMarcados(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    if (!q) return destinatarios
    return destinatarios.filter(d => d.nombre.toLowerCase().includes(q) || d.email.toLowerCase().includes(q))
  }, [destinatarios, buscar])

  async function enviar() {
    const emails = destinatarios.filter(d => marcados.has(d.id)).map(d => d.email)
    if (emails.length === 0) { setResultado('Seleccioná al menos un destinatario.'); return }
    if (!confirm(`¿Enviar la difusión a ${emails.length} destinatario(s)?`)) return
    setEnviando(true); setResultado('')
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asunto: form.asunto, cuerpo: form.cuerpo, emails, usarPlantilla: true }),
      })
      const data = await res.json()
      if (!res.ok) { setResultado(data.error || 'Error al enviar.'); return }
      setResultado(`✓ ${data.encolados} email(s) encolados. El envío sale en ~1 min.`)
      // Registrar el envío en la difusión guardada.
      if (sel) {
        await fetch(`/api/admin/difusiones/${sel}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enviada_at: new Date().toISOString(), destinatarios_count: emails.length }),
        })
        await cargar()
      }
    } finally { setEnviando(false) }
  }

  const previewSrc = useMemo(() => brandPreview(form.cuerpo), [form.cuerpo])

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Difusiones</h1>
        <p className="text-brand-text-muted mt-1 text-sm">
          Armá campañas de email y enviálas a quien quieras. Copia oculta a tu casilla incluida.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Biblioteca */}
        <div className="space-y-3">
          <button onClick={nueva} className="w-full bg-brand-purple hover:bg-brand-purple-dark text-white font-semibold px-4 py-2.5 rounded-xl">
            + Nueva difusión
          </button>
          <div className="space-y-2">
            {cargando ? (
              <p className="text-xs text-brand-text-muted">Cargando…</p>
            ) : difusiones.length === 0 ? (
              <p className="text-xs text-brand-text-muted">Todavía no hay difusiones guardadas.</p>
            ) : difusiones.map(d => (
              <div
                key={d.id}
                className={`rounded-xl border p-3 cursor-pointer transition-colors ${sel === d.id ? 'border-brand-purple bg-brand-purple/10' : 'border-brand-border bg-brand-bg-card hover:border-brand-purple/50'}`}
                onClick={() => editar(d)}
              >
                <p className="text-sm font-semibold text-white line-clamp-1">{d.titulo}</p>
                <p className="text-xs text-brand-text-muted line-clamp-1">{d.asunto || 'Sin asunto'}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button onClick={e => { e.stopPropagation(); duplicar(d) }} className="text-[11px] text-brand-text-muted hover:text-white">Duplicar</button>
                  <button onClick={e => { e.stopPropagation(); eliminar(d) }} className="text-[11px] text-red-400 hover:text-red-300">Eliminar</button>
                  {d.enviada_at && <span className="text-[11px] text-green-400 ml-auto">Enviada {d.destinatarios_count ? `· ${d.destinatarios_count}` : ''}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="space-y-4">
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-5 space-y-4">
            <div>
              <label htmlFor="d-titulo" className="block text-xs font-medium text-brand-text-muted mb-1.5">Título (interno)</label>
              <input id="d-titulo" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="input-dark w-full" placeholder="Ej: Lanzamiento vuelta al cole" />
            </div>
            <div>
              <label htmlFor="d-asunto" className="block text-xs font-medium text-brand-text-muted mb-1.5">Asunto del mail</label>
              <input id="d-asunto" value={form.asunto} onChange={e => setForm({ ...form, asunto: e.target.value })} className="input-dark w-full" placeholder="Ej: ¡Nuevos productos para el cole! 🎒" />
            </div>
            <div>
              <label htmlFor="d-cuerpo" className="block text-xs font-medium text-brand-text-muted mb-1.5">Contenido (texto o HTML — va dentro del diseño de marca)</label>
              <textarea id="d-cuerpo" value={form.cuerpo} onChange={e => setForm({ ...form, cuerpo: e.target.value })} rows={10} className="input-dark w-full resize-y font-mono text-sm" placeholder="Escribí tu mensaje. Podés usar HTML: <h2>, <p>, <a href>, <img>, etc." />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={guardar} disabled={guardando} className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-xl">
                {guardando ? 'Guardando…' : sel ? 'Guardar cambios' : 'Guardar difusión'}
              </button>
              <button onClick={abrirEnvio} className="bg-brand-neon/90 hover:bg-brand-neon text-black font-semibold px-6 py-2.5 rounded-xl">
                📣 Enviar…
              </button>
              {msg && <span className="text-green-400 text-sm">{msg}</span>}
              {error && <span className="text-red-400 text-sm">{error}</span>}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-5">
            <p className="text-xs font-medium text-brand-text-muted mb-2">Vista previa</p>
            <iframe title="preview" sandbox="" srcDoc={previewSrc} className="w-full h-[420px] rounded-lg border border-brand-border bg-white" />
          </div>

          {/* Envío: selección de destinatarios */}
          {mostrarEnvio && (
            <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">Elegí destinatarios</h2>
                <button onClick={() => setMostrarEnvio(false)} className="text-brand-text-muted hover:text-white text-sm">Cerrar</button>
              </div>

              {/* Segmentos */}
              <div className="flex flex-wrap gap-2">
                {([['todos', 'Todos'], ['compradores', 'Compradores'], ['sin_compras', 'Sin compras']] as const).map(([s, label]) => (
                  <button key={s} onClick={() => aplicarSegmento(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${segmento === s ? 'border-brand-purple bg-brand-purple/15 text-white' : 'border-brand-border text-brand-text-muted hover:text-white'}`}>
                    {label}
                  </button>
                ))}
                <span className="ml-auto text-sm text-brand-neon font-semibold self-center">{marcados.size} seleccionado(s)</span>
              </div>

              <input value={buscar} onChange={e => setBuscar(e.target.value)} className="input-dark w-full" placeholder="Buscar por nombre o email…" />

              <div className="max-h-72 overflow-y-auto rounded-lg border border-brand-border divide-y divide-brand-border">
                {cargandoDest ? (
                  <p className="p-4 text-sm text-brand-text-muted">Cargando destinatarios…</p>
                ) : visibles.length === 0 ? (
                  <p className="p-4 text-sm text-brand-text-muted">Sin resultados.</p>
                ) : visibles.map(d => (
                  <label key={d.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-brand-bg-soft">
                    <input type="checkbox" checked={marcados.has(d.id)} onChange={() => toggle(d.id)} className="w-4 h-4 accent-brand-purple" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white truncate">{d.nombre}</span>
                      <span className="block text-xs text-brand-text-muted truncate">{d.email}</span>
                    </span>
                    {d.compro && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">compró</span>}
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <button onClick={enviar} disabled={enviando || marcados.size === 0} className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl">
                  {enviando ? 'Enviando…' : `Enviar a ${marcados.size}`}
                </button>
                {resultado && <span className="text-sm text-brand-text">{resultado}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Preview client-side aproximado del diseño de marca (solo visual). */
function brandPreview(contenido: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
  <body style="margin:0;background:#ede9f7;font-family:Helvetica,Arial,sans-serif">
  <table width="100%" style="background:#ede9f7"><tr><td align="center" style="padding:24px 12px">
  <table width="600" style="max-width:600px;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(80,0,200,.12)">
  <tr><td style="background:linear-gradient(135deg,#5b21b6,#7C3AED 60%,#9333ea);padding:24px;text-align:center">
    <img src="https://flow-things-web.vercel.app/logo-light.png" height="48" alt="Flow Things"/></td></tr>
  <tr><td style="background:#fff;padding:32px;color:#1a0040;font-size:16px;line-height:1.6">${contenido || '<p style="color:#9ca3af">Tu contenido aparece acá…</p>'}</td></tr>
  <tr><td style="background:#fff;padding:0 32px 28px;text-align:center">
    <a href="#" style="display:inline-block;background:#7C3AED;color:#fff;font-weight:700;text-decoration:none;padding:12px 30px;border-radius:12px">Ver catálogo</a></td></tr>
  <tr><td style="background:#1e0050;padding:20px;text-align:center;font-size:12px;color:#c4b5fd">© ${new Date().getFullYear()} Flow Things</td></tr>
  </table></td></tr></table></body></html>`
}
