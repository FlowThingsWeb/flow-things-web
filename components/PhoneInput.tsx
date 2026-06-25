'use client'

interface Props {
  value: string
  onChange: (value: string) => void
  required?: boolean
}

const COUNTRY_CODES = [
  { code: '+54',  flag: '🇦🇷' },
  { code: '+1',   flag: '🇺🇸' },
  { code: '+55',  flag: '🇧🇷' },
  { code: '+56',  flag: '🇨🇱' },
  { code: '+598', flag: '🇺🇾' },
  { code: '+595', flag: '🇵🇾' },
  { code: '+591', flag: '🇧🇴' },
]

function parsePhone(full: string) {
  if (!full) return { country: '+54', area: '', number: '' }
  const country = COUNTRY_CODES.find(c => full.startsWith(c.code))?.code ?? '+54'
  const rest = full.slice(country.length).trim()
  const parts = rest.split(' ')
  return { country, area: parts[0] ?? '', number: parts.slice(1).join('') }
}

export default function PhoneInput({ value, onChange, required }: Props) {
  const p = parsePhone(value)

  function update(field: 'country' | 'area' | 'number', val: string) {
    const next = { ...p, [field]: val }
    onChange(`${next.country} ${next.area} ${next.number}`.trim())
  }

  const flag = COUNTRY_CODES.find(c => c.code === p.country)?.flag ?? '🇦🇷'

  return (
    <div className="flex items-stretch rounded-xl border border-brand-border bg-brand-bg-soft overflow-hidden focus-within:border-brand-purple transition-colors">
      {/* País */}
      <div className="relative flex items-center border-r border-brand-border">
        <span className="pl-3 text-base pointer-events-none select-none">{flag}</span>
        <select
          className="appearance-none bg-transparent text-brand-text text-sm pl-1 pr-6 py-3 cursor-pointer focus:outline-none"
          value={p.country}
          onChange={e => update('country', e.target.value)}
        >
          {COUNTRY_CODES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>
        <svg className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Código de área */}
      <input
        type="text"
        inputMode="numeric"
        placeholder="11"
        maxLength={4}
        value={p.area}
        onChange={e => update('area', e.target.value.replace(/\D/g, ''))}
        required={required}
        className="w-14 bg-transparent text-brand-text text-sm text-center py-3 focus:outline-none border-r border-brand-border placeholder:text-brand-text-muted"
      />

      {/* Número */}
      <input
        type="text"
        inputMode="numeric"
        placeholder="12345678"
        maxLength={8}
        value={p.number}
        onChange={e => update('number', e.target.value.replace(/\D/g, ''))}
        className="flex-1 bg-transparent text-brand-text text-sm px-3 py-3 focus:outline-none placeholder:text-brand-text-muted"
      />
    </div>
  )
}
