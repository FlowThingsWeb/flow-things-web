'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface SearchInputProps {
  categoria?: string
}

export default function SearchInput({ categoria }: SearchInputProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') || '')
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingRef   = useRef(false)  // true mientras el usuario está escribiendo

  const push = useCallback((q: string) => {
    const params = new URLSearchParams()
    if (categoria) params.set('categoria', categoria)
    if (q.trim()) params.set('q', q.trim())
    router.push(`/productos?${params.toString()}`)
  }, [router, categoria])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setValue(q)
    typingRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      push(q)
      // Dar tiempo a que el re-render del servidor termine antes de liberar el lock
      setTimeout(() => { typingRef.current = false }, 300)
    }, 300)
  }

  const handleClear = () => {
    typingRef.current = false
    setValue('')
    push('')
  }

  // Sync solo si el cambio en la URL vino de afuera (cambio de categoría, back/forward)
  useEffect(() => {
    if (!typingRef.current) {
      setValue(searchParams.get('q') || '')
    }
  }, [searchParams])

  return (
    <div className="relative mb-6">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-light pointer-events-none"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>

      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Buscar productos..."
        autoComplete="off"
        className="input-dark w-full"
        style={{ paddingLeft: '2.25rem', paddingRight: value ? '2.25rem' : undefined }}
      />

      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-white transition-colors"
          aria-label="Limpiar búsqueda"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
            <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12"/>
          </svg>
        </button>
      )}
    </div>
  )
}
