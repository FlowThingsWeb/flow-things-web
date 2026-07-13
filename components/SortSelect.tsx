'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const OPCIONES = [
  { value: 'nuevo', label: 'Más nuevos' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
  { value: 'nombre', label: 'Nombre (A-Z)' },
]

export default function SortSelect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const actual = searchParams.get('orden') || 'nuevo'

  const cambiar = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'nuevo') params.delete('orden')
    else params.set('orden', value)
    params.delete('page') // volver a la primera página al reordenar
    router.push(`/productos${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <label htmlFor="orden" className="text-sm text-brand-text-muted whitespace-nowrap">
        Ordenar por
      </label>
      <select
        id="orden"
        value={actual}
        onChange={(e) => cambiar(e.target.value)}
        className="input-dark text-sm py-2"
      >
        {OPCIONES.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
