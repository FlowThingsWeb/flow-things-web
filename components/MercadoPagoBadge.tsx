/**
 * Sello de confianza "Pagá seguro con Mercado Pago".
 * Autocontenido (SVG inline) para no depender de un asset externo que pueda
 * romperse. Se muestra cerca del botón de pago y en el footer.
 */
export default function MercadoPagoBadge({
  className = '',
}: {
  className?: string
}) {
  return (
    <div
      className={
        'inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-bg-soft px-3 py-1.5 ' +
        className
      }
    >
      {/* Marca Mercado Pago (celeste + apretón de manos simplificado) */}
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: '#00b1ea' }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12l4-4 4 3 4-3 4 4-4 5-4-3-4 3z" />
        </svg>
      </span>
      <span className="text-xs text-brand-text-muted">
        Pagá seguro con{' '}
        <span className="font-semibold" style={{ color: '#00b1ea' }}>
          Mercado Pago
        </span>
      </span>
    </div>
  )
}
