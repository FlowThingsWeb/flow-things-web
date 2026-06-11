'use client'

import { useEffect, useState } from 'react'
import FloatingToolbar from './FloatingToolbar'

export default function EditBar() {
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  useEffect(() => {
    const onSaved = () => {
      const time = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      setLastSaved(time)
      setTimeout(() => setLastSaved(null), 3000)
    }

    window.addEventListener('config_saved', onSaved)

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'config_saved') onSaved()
    }
    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('config_saved', onSaved)
      window.removeEventListener('message', onMessage)
    }
  }, [])

  return (
    <>
      {/* Floating rich text toolbar — appears on text selection */}
      <FloatingToolbar />

      {/* Top edit mode bar */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999 }}
        className="flex items-center gap-3 px-4 h-10 bg-[#1d4ed8] text-white text-xs font-medium shadow-lg select-none"
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Modo edición activo
        </span>
        <span className="text-blue-200">·</span>
        <span className="text-blue-200 hidden sm:inline">
          Clic en cualquier texto para editar · Seleccioná texto para cambiar formato, tamaño o color
        </span>

        {lastSaved && (
          <span className="ml-auto flex items-center gap-1 bg-green-500/30 border border-green-400/50 text-green-200 px-2.5 py-1 rounded-full text-[10px]">
            ✓ Guardado a las {lastSaved}
          </span>
        )}
      </div>
    </>
  )
}
