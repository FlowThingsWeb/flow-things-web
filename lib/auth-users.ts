import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Busca el user_id de una cuenta por email (case-insensitive). Pagina la lista
 * de usuarios de Supabase Auth. Devuelve null si no existe.
 */
export async function buscarUserIdPorEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase()
  if (!target) return null
  const perPage = 1000
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) return null
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (match) return match.id
    if (data.users.length < perPage) break
  }
  return null
}
