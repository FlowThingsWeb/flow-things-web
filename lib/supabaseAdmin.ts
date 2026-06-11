import { createClient } from '@supabase/supabase-js'

// Cliente con service role — SOLO usar en server-side (API routes)
// Nunca exponer en el frontend
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
