'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

interface Props {
  productoId: string
  initialFav?: boolean
  onToggle?: (esFav: boolean) => void
  className?: string
}

export default function FavoritoButton({ productoId, initialFav, onToggle, className = '' }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const [esFav, setEsFav] = useState(initialFav ?? false)
  const [cargando, setCargando] = useState(false)

  // Si no nos pasaron el estado inicial, consultarlo
  useEffect(() => {
    if (initialFav !== undefined || !user) return

    supabase
      .from('favoritos')
      .select('id')
      .eq('user_id', user.id)
      .eq('producto_id', productoId)
      .maybeSingle()
      .then(({ data }) => setEsFav(!!data))
  }, [user, productoId, initialFav])

  async function toggleFavorito(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      router.push('/cuenta/login')
      return
    }

    setCargando(true)

    if (esFav) {
      await supabase
        .from('favoritos')
        .delete()
        .eq('user_id', user.id)
        .eq('producto_id', productoId)
      setEsFav(false)
      onToggle?.(false)
    } else {
      await supabase
        .from('favoritos')
        .insert({ user_id: user.id, producto_id: productoId })
      setEsFav(true)
      onToggle?.(true)
    }

    setCargando(false)
  }

  return (
    <button
      type="button"
      onClick={toggleFavorito}
      disabled={cargando}
      aria-label={esFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      className={`w-8 h-8 rounded-full bg-brand-bg-card/80 backdrop-blur-sm border border-brand-border flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50 ${className}`}
    >
      {esFav ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-500">
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-brand-text-muted hover:text-red-400 transition-colors">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
        </svg>
      )}
    </button>
  )
}
