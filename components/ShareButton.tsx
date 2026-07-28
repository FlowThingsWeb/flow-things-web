'use client'

import { useState } from 'react'

/**
 * Botón de compartir para la ficha de producto.
 *
 * En celular usa la Web Share API nativa (abre WhatsApp, Instagram,
 * Telegram, etc. — lo que el usuario tenga). En desktop, donde esa API
 * no suele estar, cae a copiar el link al portapapeles.
 */
export default function ShareButton({
  nombre,
  precio,
}: {
  nombre: string
  precio?: string
}) {
  const [copiado, setCopiado] = useState(false)

  async function compartir() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const texto = precio
      ? `Mirá "${nombre}" en Flow Things — ${precio}`
      : `Mirá "${nombre}" en Flow Things`

    // Web Share API (celular). Puede lanzar AbortError si el usuario cancela.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: nombre, text: texto, url })
        return
      } catch (err) {
        // Cancelado por el usuario → no hacemos nada. Otro error → fallback.
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }

    // Fallback desktop: copiar link.
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Último recurso si el navegador bloquea el portapapeles.
      window.prompt('Copiá el link del producto:', url)
    }
  }

  return (
    <button
      type="button"
      onClick={compartir}
      aria-label="Compartir producto"
      className="flex items-center gap-2 text-sm text-brand-text-muted hover:text-brand-neon transition-colors"
    >
      {copiado ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Link copiado
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Compartir
        </>
      )}
    </button>
  )
}
