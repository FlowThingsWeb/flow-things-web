'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  perfilIncompleto: boolean
  markPerfilCompleto: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  perfilIncompleto: false,
  markPerfilCompleto: () => {},
  signOut: async () => {},
})

async function checkPerfil(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('perfiles')
    .select('telefono, dni')
    .eq('user_id', userId)
    .single()
  return !data?.telefono || !data?.dni
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [perfilIncompleto, setPerfilIncompleto] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const incompleto = await checkPerfil(session.user.id)
        setPerfilIncompleto(incompleto)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const incompleto = await checkPerfil(session.user.id)
        setPerfilIncompleto(incompleto)
      } else {
        setPerfilIncompleto(false)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setPerfilIncompleto(false)
  }

  const markPerfilCompleto = () => setPerfilIncompleto(false)

  return (
    <AuthContext.Provider value={{ user, session, loading, perfilIncompleto, markPerfilCompleto, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
