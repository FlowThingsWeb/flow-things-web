'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

// Páginas donde NO se redirige aunque el perfil esté incompleto
const BYPASS = [
  '/cuenta/completar-perfil',
  '/cuenta/login',
  '/cuenta/registro',
]

export default function ProfileGuard() {
  const { user, loading, perfilIncompleto } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) return
    if (BYPASS.some(p => pathname.startsWith(p))) return
    if (perfilIncompleto) {
      router.replace(`/cuenta/completar-perfil?next=${encodeURIComponent(pathname)}`)
    }
  }, [loading, user, perfilIncompleto, pathname, router])

  return null
}
