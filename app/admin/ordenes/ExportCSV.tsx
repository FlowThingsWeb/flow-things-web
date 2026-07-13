'use client'

export interface FilaCSV {
  fecha: string
  cliente: string
  email: string
  items: string
  total: number
  estado: string
  pago: string
}

/** Escapa un campo para CSV (comillas dobles, comas, saltos de línea). */
function csvCampo(v: string | number): string {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function ExportCSV({ filas }: { filas: FilaCSV[] }) {
  const exportar = () => {
    const headers = ['Fecha', 'Cliente', 'Email', 'Items', 'Total', 'Estado', 'ID Pago']
    const lineas = filas.map((f) =>
      [f.fecha, f.cliente, f.email, f.items, f.total, f.estado, f.pago].map(csvCampo).join(',')
    )
    // BOM para que Excel abra bien los acentos
    const csv = '﻿' + [headers.join(','), ...lineas].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ordenes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={exportar}
      disabled={filas.length === 0}
      className="flex items-center gap-2 bg-brand-bg-card border border-brand-border hover:border-brand-neon text-brand-text text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span>⬇️</span> Exportar CSV
    </button>
  )
}
