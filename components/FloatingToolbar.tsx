'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface ToolbarState {
  visible: boolean
  x: number
  y: number
  bold: boolean
  italic: boolean
  underline: boolean
}

const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64]

const FONTS = [
  { label: 'Predeterminado', value: 'inherit' },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Poppins', value: "'Poppins', sans-serif" },
  { label: 'Nunito', value: "'Nunito', sans-serif" },
  { label: 'Montserrat', value: "'Montserrat', sans-serif" },
  { label: 'Raleway', value: "'Raleway', sans-serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Courier New', value: "'Courier New', monospace" },
]

function btnStyle(active = false): React.CSSProperties {
  return {
    background: active ? '#9333ea' : 'transparent',
    color: active ? '#fff' : '#ccc',
    border: `1px solid ${active ? '#7c3aed' : 'transparent'}`,
    borderRadius: 4,
    fontSize: 13,
    padding: '3px 7px',
    cursor: 'pointer',
    lineHeight: '1.4',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  }
}

function divider(): React.CSSProperties {
  return { width: 1, height: 20, background: '#383838', margin: '0 3px', flexShrink: 0 }
}

export default function FloatingToolbar() {
  const [tb, setTb] = useState<ToolbarState>({
    visible: false, x: 0, y: 0, bold: false, italic: false, underline: false,
  })
  const [showSizes, setShowSizes] = useState(false)
  const [showFonts, setShowFonts] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const savedRange = useRef<Range | null>(null)

  // Find the nearest contentEditable ancestor with data-edit-key
  const findEditable = useCallback((node: Node | null): HTMLElement | null => {
    let n: Node | null = node
    while (n) {
      if (n instanceof HTMLElement && n.hasAttribute('data-edit-key')) return n
      n = n.parentNode
    }
    return null
  }, [])

  const saveRange = useCallback(() => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }, [])

  const restoreRange = useCallback(() => {
    const sel = window.getSelection()
    if (sel && savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current.cloneRange())
    }
  }, [])

  const notifyChange = useCallback((range: Range) => {
    const el = findEditable(range.commonAncestorContainer)
    if (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, [findEditable])

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setTb(t => ({ ...t, visible: false }))
      return
    }
    const range = sel.getRangeAt(0)
    const editable = findEditable(range.commonAncestorContainer)
    if (!editable) {
      setTb(t => ({ ...t, visible: false }))
      return
    }
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setTb(t => ({ ...t, visible: false }))
      return
    }
    setTb({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    })
    saveRange()
  }, [findEditable, saveRange])

  useEffect(() => {
    document.addEventListener('mouseup', handleSelectionChange)
    document.addEventListener('keyup', handleSelectionChange)
    return () => {
      document.removeEventListener('mouseup', handleSelectionChange)
      document.removeEventListener('keyup', handleSelectionChange)
    }
  }, [handleSelectionChange])

  const exec = useCallback((cmd: string, value?: string) => {
    restoreRange()
    document.execCommand(cmd, false, value)
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) notifyChange(sel.getRangeAt(0))
    setTb(t => ({
      ...t,
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    }))
  }, [restoreRange, notifyChange])

  const wrapSelection = useCallback((style: Partial<CSSStyleDeclaration>) => {
    restoreRange()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    const span = document.createElement('span')
    Object.assign(span.style, style)
    try {
      range.surroundContents(span)
    } catch {
      const frag = range.extractContents()
      span.appendChild(frag)
      range.insertNode(span)
    }
    notifyChange(range)
  }, [restoreRange, notifyChange])

  const applyLink = useCallback(() => {
    const url = linkUrl.trim()
    if (!url) return
    exec('createLink', url)
    // Set target=_blank on the new anchor
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).commonAncestorContainer
      if (node?.nodeType === Node.TEXT_NODE) node = node.parentNode
      if (node instanceof HTMLAnchorElement) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    }
    setShowLink(false)
    setLinkUrl('')
  }, [exec, linkUrl])

  if (!tb.visible) return null

  const TOOLBAR_W = 380
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const left = Math.max(TOOLBAR_W / 2 + 10, Math.min(tb.x, vw - TOOLBAR_W / 2 - 10))
  const top = Math.max(56, tb.y - 52) // 56 = below edit bar

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        transform: 'translateX(-50%)',
        zIndex: 999998,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
      onMouseDown={e => e.preventDefault()} // Crucial: prevents selection loss
    >
      {/* Main toolbar row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: '#1a1a1a',
        border: '1px solid #3a3a3a',
        borderRadius: 8,
        padding: '4px 6px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        position: 'relative',
      }}>
        {/* Bold / Italic / Underline */}
        <button
          onMouseDown={e => { e.preventDefault(); exec('bold') }}
          style={btnStyle(tb.bold)} title="Negrita"
        >
          <b style={{ fontFamily: 'Georgia, serif' }}>B</b>
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); exec('italic') }}
          style={btnStyle(tb.italic)} title="Cursiva"
        >
          <i style={{ fontFamily: 'Georgia, serif' }}>I</i>
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); exec('underline') }}
          style={btnStyle(tb.underline)} title="Subrayado"
        >
          <u>U</u>
        </button>

        <div style={divider()} />

        {/* Font size dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={e => { e.preventDefault(); saveRange(); setShowSizes(v => !v); setShowFonts(false); setShowLink(false) }}
            style={{ ...btnStyle(showSizes), padding: '3px 9px', fontSize: 11 }}
            title="Tamaño de letra"
          >
            Aa ▾
          </button>
          {showSizes && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, zIndex: 1,
              background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: 6,
              padding: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, minWidth: 112,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              {SIZES.map(s => (
                <button
                  key={s}
                  onMouseDown={e => { e.preventDefault(); wrapSelection({ fontSize: `${s}px` }); setShowSizes(false) }}
                  style={{ ...btnStyle(false), fontSize: 11, padding: '4px 8px', justifyContent: 'flex-start' }}
                >
                  {s}px
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font family dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={e => { e.preventDefault(); saveRange(); setShowFonts(v => !v); setShowSizes(false); setShowLink(false) }}
            style={{ ...btnStyle(showFonts), padding: '3px 9px', fontSize: 11 }}
            title="Tipografía"
          >
            Tipo ▾
          </button>
          {showFonts && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, zIndex: 1,
              background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: 6,
              padding: 4, minWidth: 160,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              {FONTS.map(f => (
                <button
                  key={f.value}
                  onMouseDown={e => { e.preventDefault(); wrapSelection({ fontFamily: f.value }); setShowFonts(false) }}
                  style={{
                    ...btnStyle(false), display: 'block', width: '100%',
                    fontSize: 12, padding: '5px 10px',
                    justifyContent: 'flex-start', fontFamily: f.value,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={divider()} />

        {/* Text color */}
        <label title="Color de texto" style={{ position: 'relative', cursor: 'pointer', display: 'inline-flex' }}>
          <span style={{ ...btnStyle(false), pointerEvents: 'none', fontWeight: 700, color: '#f0f0f0' }}>
            <span style={{ borderBottom: '2px solid #f0f0f0', lineHeight: 1, paddingBottom: 1 }}>A</span>
          </span>
          <input
            type="color" defaultValue="#ffffff"
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            onMouseDown={() => saveRange()}
            onChange={e => { restoreRange(); exec('foreColor', e.target.value) }}
          />
        </label>

        {/* Background/highlight color */}
        <label title="Color de resaltado" style={{ position: 'relative', cursor: 'pointer', display: 'inline-flex' }}>
          <span style={{ ...btnStyle(false), pointerEvents: 'none', fontSize: 12 }}>▒</span>
          <input
            type="color" defaultValue="#9333ea"
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            onMouseDown={() => saveRange()}
            onChange={e => { restoreRange(); exec('hiliteColor', e.target.value) }}
          />
        </label>

        <div style={divider()} />

        {/* Link */}
        <button
          onMouseDown={e => { e.preventDefault(); saveRange(); setShowLink(v => !v); setShowSizes(false); setShowFonts(false) }}
          style={btnStyle(showLink)} title="Insertar enlace"
        >
          🔗
        </button>

        {/* Remove format */}
        <button
          onMouseDown={e => { e.preventDefault(); exec('removeFormat') }}
          style={{ ...btnStyle(false), fontSize: 11, color: '#777', padding: '3px 6px' }}
          title="Limpiar formato"
        >
          ✕
        </button>
      </div>

      {/* Link input panel */}
      {showLink && (
        <div style={{
          display: 'flex', gap: 4, marginTop: 4,
          background: '#1a1a1a', border: '1px solid #3a3a3a',
          borderRadius: 6, padding: '4px 6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <input
            type="url" placeholder="https://..."
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyLink() }}
            autoFocus
            style={{
              flex: 1, background: '#0f0f0f',
              border: '1px solid #333', borderRadius: 4,
              color: '#fff', fontSize: 12, padding: '3px 8px',
              outline: 'none', minWidth: 200,
            }}
          />
          <button
            onMouseDown={e => { e.preventDefault(); applyLink() }}
            style={{ background: '#9333ea', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, padding: '3px 12px', cursor: 'pointer' }}
          >
            OK
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); setShowLink(false) }}
            style={{ background: '#2a2a2a', color: '#888', border: 'none', borderRadius: 4, fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Arrow pointing down at text */}
      {!showLink && (
        <div style={{
          position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '5px solid #3a3a3a',
        }} />
      )}
    </div>
  )
}
