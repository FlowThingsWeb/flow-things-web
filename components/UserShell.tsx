'use client'

/**
 * UserShell: renderiza todos los componentes del sitio público
 * (Header, Footer, CartDrawer, guards, banners) solo cuando NO es una ruta de admin.
 * Esto permite que el root layout comparta AuthProvider con admin
 * sin contaminar el panel con UI de usuario.
 */

import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CartDrawer from '@/components/CartDrawer'
import AnnouncementBar from '@/components/AnnouncementBar'
import RegistrationBanner from '@/components/RegistrationBanner'
import CartSync from '@/components/CartSync'
import ProfileGuard from '@/components/ProfileGuard'
import RegistrationPopup from '@/components/RegistrationPopup'
import type { ConfigMap } from '@/lib/config'

interface Props {
  cfg: ConfigMap
  children: React.ReactNode
}

export default function UserShell({ cfg, children }: Props) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  if (isAdmin) {
    // Admin: solo renderizar el contenido, sin ningún componente del sitio público
    return <>{children}</>
  }

  return (
    <>
      <ProfileGuard />
      <RegistrationPopup />
      <CartSync />
      <RegistrationBanner />
      <AnnouncementBar
        gratisAmba={Number(cfg.envio_gratis_gba_desde) || 40000}
        gratisInterior={Number(cfg.envio_gratis_interior_desde) || 120000}
      />
      <Header cfg={cfg} />
      <main className="min-h-screen">{children}</main>
      <CartDrawer />
      <Footer cfg={cfg} />
    </>
  )
}
