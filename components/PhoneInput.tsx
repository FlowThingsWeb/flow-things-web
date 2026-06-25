'use client'

interface Props {
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
}

const COUNTRY_CODES = [
  { code: '+54', label: '🇦🇷 +54' },
  { code: '+1',  label: '🇺🇸 +1'  },
  { code: '+55', label: '🇧🇷 +55' },
  { code: '+56', label: '🇨🇱 +56' },
  { code: '+598', label: '🇺🇾 +598' },
  { code: '+595', label: '🇵🇾 +595' },
  { code: '+591', label: '🇧🇴 +591' },
]

/** Parsea un telefono guardado como "+54 11 12345678" en sus partes */
function parsePhone(full: string) {
  if (!full) return { country: '+54', area: '', number: '' }
  const country = COUNTRY_CODES.find(c => full.startsWith(c.code))?.code ?? '+54'
  const rest = full.slice(country.length).trim()
  const parts = rest.split(' ')
  return { country, area: parts[0] ?? '', number: parts.slice(1).join('') }
}

export default function PhoneInput({ value, onChange, required, className }: Props) {
  const parsed = parsePhone(value)

  function update(field: 'country' | 'area' | 'number', val: string) {
    const next = { ...parsed, [field]: val }
    const full = `${next.country} ${next.area} ${next.number}`.trim()
    onChange(full)
  }

  return (
    <div className={`flex gap-2 ${className ?? ''}`}>
      {/* Código de país */}
      <select
        className="input-dark w-28 flex-shrink-0"
        value={parsed.country}
        onChange={e => update('country', e.target.value)}
      >
        {COUNTRY_CODES.map(c => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>

      {/* Código de área */}
      <input
        type="text"
        inputMode="numeric"
        className="input-dark w-20 flex-shrink-0"
        placeholder="Área"
        maxLength={4}
        value={parsed.area}
        onChange={e => update('area', e.target.value.replace(/\D/g, ''))}
        required={required}
        title="Código de área sin el 0 inicial (ej: 11, 221, 341)"
      />

      {/* Número */}
      <input
        type="text"
        inputMode="numeric"
        className="input-dark flex-1"
        placeholder="Número"
        maxLength={8}
        value={parsed.number}
        onChange={e => update('number', e.target.value.replace(/\D/g, ''))}
        required={required}
        title="Número sin el 15 inicial"
      />
    </div>
  )
}
