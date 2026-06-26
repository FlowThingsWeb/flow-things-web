'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

const BYPASS = ['/cuenta/completar-perfil', '/cuenta/login', '/cuenta/registro']

export default function ProfileGuard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  // Guardamos el user_id del último chequeo para no repetirlo en cada navegación
  const checkedUserId = useRef<string | null>(null)

  const checkProfile = (userId: string) => {
    checkedUserId.current = userId
    supabase
      .from('perfiles')
      .select('telefono, dni')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (!data?.telefono || !data?.dni) {
          router.replace(`/cuenta/completar-perfil?next=${encodeURIComponent(pathname)}`)
        }
      })
  }

  useEffect(() => {
    if (loading) return
    if (!user) { checkedUserId.current = null; return }
    if (BYPASS.some(p => pathname.startsWith(p))) return
    if (checkedUserId.current === user.id) return
    checkProfile(user.id)
  }, [loading, user, pathname, router])

  // Re-chequear cuando la pestaña vuelve a estar activa (el usuario completó perfil en otra pestaña)
  useEffect(() => {
    const onVisible = () => {
      if (!user || loading) return
      if (BYPASS.some(p => pathname.startsWith(p))) return
      // Forzar re-chequeo borrando el ref
      checkedUserId.current = null
      checkProfile(user.id)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user, loading, pathname])

  return null
}
