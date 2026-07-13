'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface HeaderSearchProps {
  /** onSubmitted se llama tras navegar — útil para cerrar el menú mobile. */
  onSubmitted?: () => void
  /** Estilo compacto (desktop) o full-width (menú mobile). */
  variant?: 'compact' | 'full'
}

export default function HeaderSearch({ onSubmitted, variant = 'compact' }: HeaderSearchProps) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    router.push(q ? `/productos?q=${encodeURIComponent(q)}` : '/productos')
    inputRef.current?.blur()
    onSubmitted?.()
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className={`relative ${variant === 'compact' ? 'w-40 lg:w-56' : 'w-full'}`}
    >
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-light hover:text-brand-neon transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
      </button>

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar productos..."
        autoComplete="off"
        aria-label="Buscar productos"
        className="input-dark w-full text-sm"
        style={{ paddingLeft: '2.25rem', paddingRight: value ? '2.25rem' : undefined }}
      />

      {value && (
        <button
          type="button"
          onClick={() => { setValue(''); inputRef.current?.focus() }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-white transition-colors"
          aria-label="Limpiar búsqueda"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
            <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </form>
  )
}
