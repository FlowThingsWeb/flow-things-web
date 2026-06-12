import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function getOrdenes() {
  const { data } = await supabaseAdmin
    .from('ordenes')
    .select('*')
    .order('created_at', { ascending: false })

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

function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(precio)
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

export default async function AdminOrdenesPage() {
  const ordenes = await getOrdenes()

  const totalAprobado = ordenes
    .filter((o) => o.estado === 'approved')
    .reduce((acc, o) => acc + Number(o.total), 0)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-text">Órdenes</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          {ordenes.length} orden{ordenes.length !== 1 ? 'es' : ''} — Total cobrado:{' '}
          <span className="font-semibold text-green-600">{formatPrecio(totalAprobado)}</span>
        </p>
      </div>

      {/* Resumen por estado */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {Object.entries(estadoLabels).map(([estado, label]) => {
          const count = ordenes.filter((o) => o.estado === estado).length
          return (
            <div key={estado} className={`rounded-xl px-4 py-3 border ${estadoColores[estado] || 'bg-gray-100'}`}>
              <p className="text-xs font-medium">{label}</p>
              <p className="text-xl font-bold mt-1">{count}</p>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        {ordenes.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl block mb-3">🛍️</span>
            <p className="text-brand-text-muted">Todavía no hay órdenes</p>
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
                  <tr key={orden.id} className="hover:bg-brand-bg-soft/50 transition-colors cursor-pointer" onClick={() => { window.location.href = `/admin/ordenes/${orden.id}` }}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
