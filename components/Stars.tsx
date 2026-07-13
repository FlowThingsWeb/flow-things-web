'use client'

/**
 * Estrellas de rating. Solo lectura por defecto; si se pasa onChange, es interactivo.
 */
export default function Stars({
  value,
  onChange,
  size = 16,
}: {
  value: number
  onChange?: (v: number) => void
  size?: number
}) {
  const interactivo = !!onChange
  return (
    <span className="inline-flex items-center" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value)
        const star = (
          <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={filled ? 'text-amber-400' : 'text-brand-border'}
            fill="currentColor"
          >
            <path d="M12 17.27l5.18 3.05-1.37-5.88 4.55-3.94-6-.52L12 4.5 9.64 9.99l-6 .52 4.55 3.94-1.37 5.88z" />
          </svg>
        )
        return interactivo ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange!(n)}
            className="p-0.5 hover:scale-110 transition-transform"
            aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        )
      })}
    </span>
  )
}
