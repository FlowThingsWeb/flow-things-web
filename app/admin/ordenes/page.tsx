import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Link from 'next/link'
import { ClickableRow } from './ClickableRow'
import OrdenesFiltros from './OrdenesFiltros'
import ExportCSV, { FilaCSV } from './ExportCSV'
import { formatPrecio } from '@/lib/format'

export const dynamic = 'force-dynamic'

// Límite de 200 órdenes más recientes (dentro del rango de fecha) para evitar timeouts.
const LIMIT = 200

interface PageProps {
  searchParams: Promise<{ estado?: string; q?: string; desde?: string; hasta?: string }>
}

async function getOrdenes(desde?: string, hasta?: string) {
  let query = supabaseAdmin
    .from('ordenes')
    .select('*')
    .order('created_at', { ascending: false })

  if (desde) query = query.gte('created_at', desde)
  if (hasta) query = query.lte('created_at', `${hasta}T23:59:59`)

  const { data } = await query.limit(LIMIT)
  return data || []
}

const estadoColores: Record<string, string> = {
  approved: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  refunded: 'bg-blue-100 text-blue-700 border-blue-200',
}

const estadoLabels: Record<string, string> = {
  approved: '✓ Aprobado',
  pending: '⏳ Pendiente',
  rejected: '✗ Rechazado',
  cancelled: '— Cancelado',
  refunded: '↩ Reembolsado',
}

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminOrdenesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const { estado, q, desde, hasta } = sp

  // Set base: filtrado por fecha en DB
  const base = await getOrdenes(desde, hasta)

  // Búsqueda por cliente/email en JS sobre el set base
  const term = q?.trim().toLowerCase()
  const filtradas = term
    ? base.filter((o) => {
        const nombre = String(o.datos_comprador?.nombre ?? '').toLowerCase()
        const email = String(o.datos_comprador?.email ?? '').toLowerCase()
        return nombre.includes(term) || email.includes(term)
      })
    : base

  // Conteos por estado sobre el set filtrado (fecha + búsqueda), independientes del estado activo
  const conteos: Record<string, number> = {}
  for (const label of Object.keys(estadoLabels)) {
    conteos[label] = filtradas.filter((o) => o.estado === label).length
  }

  // Filtro por estado aplicado al final (para la tabla y el export)
  const ordenes = estado ? filtradas.filter((o) => o.estado === estado) : filtradas

  const totalAprobado = filtradas
    .filter((o) => o.estado === 'approved')
    .reduce((acc, o) => acc + Number(o.total), 0)

  // Preservar filtros al armar links de estado
  const linkEstado = (e: string | null) => {
    const params = new URLSearchParams()
    if (e) params.set('estado', e)
    if (q) params.set('q', q)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    return `/admin/ordenes${params.toString() ? `?${params.toString()}` : ''}`
  }

  // Filas para el CSV (del set visible)
  const filasCSV: FilaCSV[] = ordenes.map((o) => ({
    fecha: formatFecha(o.created_at),
    cliente: o.datos_comprador?.nombre ?? '',
    email: o.datos_comprador?.email ?? '',
    items: (o.items ?? []).map((i: any) => `${i.cantidad}x ${i.nombre}`).join(' | '),
    total: Number(o.total),
    estado: estadoLabels[o.estado]?.replace(/^[^\s]+\s/, '') ?? o.estado,
    pago: o.mp_payment_id ?? '',
  }))

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Órdenes</h1>
          <p className="text-brand-text-muted text-sm mt-1">
            {ordenes.length} orden{ordenes.length !== 1 ? 'es' : ''}
            {estado ? ` (${estadoLabels[estado] ?? estado})` : ''} — Total cobrado:{' '}
            <span className="font-semibold text-green-600">{formatPrecio(totalAprobado)}</span>
          </p>
        </div>
        <ExportCSV filas={filasCSV} />
      </div>

      {/* Filtros */}
      <OrdenesFiltros />

      {/* Resumen por estado — clickeable para filtrar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {Object.entries(estadoLabels).map(([e, label]) => {
          const activo = estado === e
          return (
            <Link
              key={e}
              href={activo ? linkEstado(null) : linkEstado(e)}
              className={`rounded-xl px-4 py-3 border transition-all ${estadoColores[e] || 'bg-gray-100'} ${
                activo ? 'ring-2 ring-brand-purple ring-offset-1 ring-offset-brand-bg' : 'hover:opacity-80'
              }`}
            >
              <p className="text-xs font-medium">{label}</p>
              <p className="text-xl font-bold mt-1">{conteos[e]}</p>
            </Link>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        {ordenes.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl block mb-3">🛍️</span>
            <p className="text-brand-text-muted">
              {base.length === 0 ? 'Todavía no hay órdenes' : 'Ninguna orden coincide con los filtros'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Items</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Estado</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">ID Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {ordenes.map((orden) => (
                  <ClickableRow key={orden.id} href={`/admin/ordenes/${orden.id}`} className="hover:bg-brand-bg-soft/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-xs text-brand-text-muted whitespace-nowrap">
                        {formatFecha(orden.created_at)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-brand-text">
                          {orden.datos_comprador?.nombre || 'Sin datos'}
                        </p>
                        <p className="text-xs text-brand-text-muted">
                          {orden.datos_comprador?.email || ''}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs text-brand-text-muted space-y-0.5">
                        {orden.items?.slice(0, 2).map((item: any, i: number) => (
                          <p key={i} className="line-clamp-1">
                            {item.cantidad}× {item.nombre}
                          </p>
                        ))}
                        {orden.items?.length > 2 && (
                          <p className="text-brand-text-light">+{orden.items.length - 2} más</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-brand-text text-sm whitespace-nowrap">
                        {formatPrecio(Number(orden.total))}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${estadoColores[orden.estado] || 'bg-gray-100 text-gray-600'}`}>
                        {estadoLabels[orden.estado] || orden.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-brand-text-light font-mono">
                        {orden.mp_payment_id || '—'}
                      </span>
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
