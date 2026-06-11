'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEditMode } from '@/lib/useEditMode'
import EditableText from '@/components/EditableText'
import EditableImage from '@/components/EditableImage'
import type { ConfigMap } from '@/lib/config'

interface FooterProps {
  cfg: ConfigMap
}

export default function Footer({ cfg }: FooterProps) {
  const editMode = useEditMode()

  const ET = ({ k, className, as }: { k: string; className?: string; as?: string }) =>
    editMode ? (
      <EditableText configKey={k} value={cfg[k]} className={className} as={as} />
    ) : (
      <>{cfg[k]}</>
    )

  const tiendaLinks = [
    { href: '/productos', key: 'footer_link_catalogo' },
    { href: '/productos?categoria=libreria', key: 'footer_link_libreria' },
    { href: '/productos?categoria=jugueteria', key: 'footer_link_jugueteria' },
    { href: '/productos?categoria=utiles-escolares', key: 'footer_link_utiles' },
  ]

  return (
    <footer className="bg-brand-bg-card border-t border-brand-border mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-10 h-10 rounded-full overflow-hidden">
                {editMode ? (
                  <EditableImage
                    configKey="logo_url"
                    src={cfg.logo_url || '/logo.png'}
                    alt="Logo"
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <Image src={cfg.logo_url || '/logo.png'} alt="Flow Things" fill className="object-cover" sizes="40px" />
                )}
              </div>
              <span className="font-bold text-white tracking-wide flex items-center gap-1">
                <ET k="header_nombre_1" className="text-white" />
                {' '}
                <ET k="header_nombre_2" className="text-brand-purple" />
              </span>
            </div>
            <p className="text-brand-text-muted text-sm leading-relaxed">
              <ET k="footer_tagline" />
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a
                href={cfg.footer_instagram || 'https://instagram.com/flowthings'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-brand-bg-soft border border-brand-border flex items-center justify-center text-brand-text-muted hover:text-brand-neon hover:border-brand-neon transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Links Tienda */}
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">
              <ET k="footer_tienda_titulo" />
            </h3>
            <ul className="space-y-2">
              {tiendaLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-brand-text-muted hover:text-brand-neon text-sm transition-colors">
                    <ET k={link.key} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">
              <ET k="footer_contacto_titulo" />
            </h3>
            <ul className="space-y-3 text-sm text-brand-text-muted">
              <li className="flex items-center gap-2">
                <span className="text-brand-purple">✉</span>
                <ET k="footer_email" />
              </li>
              <li className="flex items-center gap-2">
                <span className="text-brand-purple">📱</span>
                <ET k="footer_telefono" />
              </li>
            </ul>
          </div>
        </div>

        {/* Banner footer */}
        <div className="mt-10 rounded-2xl overflow-hidden">
          {editMode ? (
            <EditableImage
              configKey="footer_banner_url"
              src={cfg.footer_banner_url || '/banner.png'}
              alt="Banner Flow Things"
              width={1200}
              height={60}
              className="w-full h-auto"
            />
          ) : (
            <Image
              src={cfg.footer_banner_url || '/banner.png'}
              alt="Flow Things"
              width={1200}
              height={60}
              className="w-full h-auto"
            />
          )}
        </div>

        <div className="border-t border-brand-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-brand-text-light text-xs">
            © {new Date().getFullYear()} {cfg.sitio_nombre}.{' '}
            <ET k="footer_copyright" />
          </p>
          <div className="flex items-center gap-1 text-xs text-brand-text-muted">
            <span>Pagos seguros con</span>
            <span className="font-bold text-brand-purple">Mercado Pago</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
