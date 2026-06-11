'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export default function EditorPage() {
  const [saveFlash, setSaveFlash] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Escuchar mensajes de guardado desde el iframe
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

  return (
    /* Cubre todo — sidebar incluido */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: '#0f0f0f',
      }}
    >
      {/* Barra superior del editor */}
      <div
        style={{ flexShrink: 0 }}
        className="flex items-center gap-3 px-5 h-12 bg-[#111827] border-b border-white/10 shadow-xl"
      >
        {/* Icono + título */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-brand-purple flex items-center justify-center">
            <span className="text-white text-xs font-bold">F</span>
          </div>
          <span className="text-white text-sm font-semibold">Flow Things</span>
          <span className="text-white/30 text-sm">/</span>
          <span className="text-white/60 text-sm">Editor de página</span>
        </div>

        {/* Indicador de guardado */}
        <div className="flex items-center gap-2 ml-4">
          {saveFlash ? (
            <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium animate-pulse">
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

        {/* Instrucción central */}
        {iframeLoaded && (
          <span className="hidden md:block mx-auto text-xs text-white/40">
            Hacé clic en cualquier texto o imagen para editarlo en tiempo real
          </span>
        )}

        {/* Botones */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src
              }
            }}
            className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title="Recargar vista previa"
          >
            ↺ Recargar
          </button>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            🌐 Ver sitio
          </a>

          <Link
            href="/admin"
            className="text-xs bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
          >
            ← Volver al admin
          </Link>
        </div>
      </div>

      {/* Iframe del sitio web */}
      <iframe
        ref={iframeRef}
        src="/?editMode=1"
        style={{ flex: 1, border: 'none', width: '100%' }}
        onLoad={() => setIframeLoaded(true)}
        title="Editor de página"
      />
    </div>
  )
}
