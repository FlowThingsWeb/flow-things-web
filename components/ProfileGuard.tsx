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

  useEffect(() => {
    if (loading) return
    // Sin sesión: resetear para que al próximo login se vuelva a chequear
    if (!user) { checkedUserId.current = null; return }
    // Páginas exentas
    if (BYPASS.some(p => pathname.startsWith(p))) return
    // Ya chequeamos este usuario → no repetir
    if (checkedUserId.current === user.id) return

    checkedUserId.current = user.id

    supabase
      .from('perfiles')
      .select('telefono, dni')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (!data?.telefono || !data?.dni) {
          router.replace(`/cuenta/completar-perfil?next=${encodeURIComponent(pathname)}`)
        }
      })
  }, [loading, user, pathname, router])

  return null
}
