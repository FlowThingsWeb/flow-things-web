// Nunca cachear: son pantallas por usuario. El layout raíz dejó de ser
// force-dynamic para que el sitio público pueda cachear; este subtree no.
export const dynamic = 'force-dynamic'

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg">
      {children}
    </div>
  )
}
