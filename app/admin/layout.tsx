'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/admin/productos', label: 'Productos', icon: '📦', exact: false },
  { href: '/admin/ordenes', label: 'Órdenes', icon: '🛍️', exact: false },
  { href: '/admin/descuentos', label: 'Descuentos', icon: '🏷️', exact: false },
  { href: '/admin/envios', label: 'Envíos', icon: '🚚', exact: false },
  { href: '/admin/facturacion', label: 'Facturación', icon: '🧾', exact: false },
  { href: '/admin/mailing', label: 'Mailing', icon: '✉️', exact: false },
  { href: '/admin/editor', label: 'Editor de página', icon: '✏️', exact: false },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  // No mostrar el layout en la pantalla de login
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/admin/login')
  }

  return (
    <div className="min-h-screen bg-brand-bg flex">
      {/* Sidebar */}
      <aside className="w-60 bg-brand-bg-card border-r border-brand-border flex flex-col fixed h-full z-30">
        {/* Logo */}
        <div className="p-5 border-b border-brand-border">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-purple flex items-center justify-center shadow-purple">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Flow Things</p>
              <p className="text-brand-neon text-xs font-medium">Admin</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-purple text-white'
                    : 'text-brand-text-muted hover:bg-brand-bg-soft hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-brand-border">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-brand-text-muted hover:bg-brand-bg-soft hover:text-white transition-colors"
          >
            <span>🌐</span>
            Ver tienda
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-900/30 transition-colors mt-1"
          >
            <span>🚪</span>
            {loggingOut ? 'Cerrando...' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}
