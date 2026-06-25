import { NextResponse } from 'next/server'

const COOKIE_NAME = 'ft_pc'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 año
}

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, '1', COOKIE_OPTS)
  return response
}
