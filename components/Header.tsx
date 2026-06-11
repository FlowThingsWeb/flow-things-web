'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCartStore } from '@/lib/store'
import { useEditMode } from '@/lib/useEditMode'
import EditableText from '@/components/EditableText'
import EditableImage from '@/components/EditableImage'
import type { ConfigMap } from '@/lib/config'
import { CATEGORIAS_PAUSADAS } from '@/lib/categoriasPausadas'

interface HeaderProps {
  cfg: ConfigMap
}

export default function Header({ cfg }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { cantidadTotal, openCart } = useCartStore()
  const cantidad = cantidadTotal()
  const editMode = useEditMode()

  const ET = ({ k, className, as }: { k: string; className?: string; as?: string }) =>
    editMode ? (
      <EditableText configKey={k} value={cfg[k]} className={className} as={as} />
    ) : (
      <>{cfg[k]}</>
    )

  const allNavLinks = [
    { href: '/productos', key: 'header_nav_catalogo', slug: null },
    { href: '/productos?categoria=libreria', key: 'header_nav_libreria', slug: 'libreria' },
    { href: '/productos?categoria=jugueteria', key: 'header_nav_jugueteria', slug: 'jugueteria' },
  ]
  const navLinks = allNavLinks.filter(l => !l.slug || !CATEGORIAS_PAUSADAS.includes(l.slug))

  return (
    <header className="sticky top-0 z-40 bg-brand-bg/90 backdrop-blur-md border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 group">
            {/* Imagen del logo */}
            <div className="relative w-9 h-9 rounded-full overflow-hidden">
              {editMode ? (
                <EditableImage
                  configKey="logo_url"
                  src={cfg.logo_url || '/logo.png'}
                  alt="Logo"
                  fill
                  className="object-cover"
                  sizes="36px"
                />
              ) : (
                <Link href="/">
                  <Image
                    src={cfg.logo_url || '/logo.png'}
                    alt="Flow Things"
                    fill
                    className="object-cover"
                    sizes="36px"
                  />
                </Link>
              )}
            </div>

            {/* Nombre de la marca */}
            {editMode ? (
              <span className="font-bold text-lg text-white tracking-wide flex items-center gap-1">
                <ET k="header_nombre_1" className="text-white" />
                {' '}
                <ET k="header_nombre_2" className="text-brand-purple" />
              </span>
            ) : (
              <Link href="/" className="font-bold text-lg text-white hover:text-brand-neon transition-colors tracking-wide">
                {cfg.header_nombre_1}{' '}
                <span className="text-brand-purple">{cfg.header_nombre_2}</span>
              </Link>
            )}
          </div>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-brand-text-muted hover:text-brand-neon transition-colors text-sm font-medium tracking-wide uppercase"
              >
                <ET k={link.key} />
              </Link>
            ))}
          </nav>

          {/* Acciones */}
          <div className="flex items-center gap-3">
            {/* Carrito */}
            <button
              onClick={openCart}
              className="relative p-2 text-brand-text-muted hover:text-brand-neon transition-colors"
              aria-label="Abrir carrito"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              {cantidad > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-neon text-black text-xs font-black rounded-full w-5 h-5 flex items-center justify-center">
                  {cantidad > 9 ? '9+' : cantidad}
                </span>
              )}
            </button>

            {/* Hamburger mobile */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-brand-text-muted"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                }
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Menú mobile */}
      {menuOpen && (
        <div className="md:hidden border-t border-brand-border bg-brand-bg-card animate-fade-in">
          <nav className="px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-brand-text-muted hover:text-brand-neon py-2 px-3 rounded-lg hover:bg-brand-bg-soft transition-colors text-sm font-medium uppercase tracking-wide"
              >
                <ET k={link.key} />
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
