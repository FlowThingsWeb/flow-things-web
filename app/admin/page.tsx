import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getStats() {
  const [{ count: totalProductos }, { count: totalOrdenes }, { data: ordenesRecientes }] =
    await Promise.all([
      supabaseAdmin.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
      supabaseAdmin.from('ordenes').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('ordenes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  // Calcular ingresos aprobados
  const { data: ordenesAprobadas } = await supabaseAdmin
    .from('ordenes')
    .select('total')
    .eq('estado', 'approved')

  const ingresos = ordenesAprobadas?.reduce((acc, o) => acc + Number(o.total), 0) || 0

  return { totalProductos, totalOrdenes, ingresos, ordenesRecientes: ordenesRecientes || [] }
}

const estadoColores: Record<string, string> = {
  approved: 'bg-green-900/40 text-green-400',
  pending: 'bg-yellow-900/40 text-yellow-400',
  rejected: 'bg-red-900/40 text-red-400',
  cancelled: 'bg-brand-bg-soft text-brand-text-muted',
  refunded: 'bg-blue-900/40 text-blue-400',
}

const estadoLabels: Record<string, string> = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
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
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminDashboard() {
  const { totalProductos, totalOrdenes, ingresos, ordenesRecientes } = await getStats()

  const stats = [
    { label: 'Productos activos', value: totalProductos || 0, icon: '📦', href: '/admin/productos' },
    { label: 'Órdenes totales', value: totalOrdenes || 0, icon: '🛍️', href: '/admin/ordenes' },
    { label: 'Ingresos totales', value: formatPrecio(ingresos), icon: '💰', href: '/admin/ordenes' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-text">Dashboard</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          Resumen de Flow Things
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 hover:border-brand-purple hover:shadow-card-hover transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold text-brand-neon">{stat.value}</p>
            <p className="text-brand-text-muted text-sm mt-1">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <Link
          href="/admin/productos/nuevo"
          className="bg-brand-purple hover:bg-brand-purple-dark text-white rounded-2xl p-6 flex items-center gap-4 transition-colors"
        >
          <span className="text-3xl">+</span>
          <div>
            <p className="font-semibold">Nuevo producto</p>
            <p className="text-white/70 text-sm">Agregá un producto al catálogo</p>
          </div>
        </Link>
        <Link
          href="/admin/ordenes"
          className="bg-brand-bg-card border border-brand-border hover:border-brand-neon rounded-2xl p-6 flex items-center gap-4 transition-all"
        >
          <span className="text-3xl">🔔</span>
          <div>
            <p className="font-semibold text-white">Ver órdenes</p>
            <p className="text-brand-text-muted text-sm">Monitoreá el estado de ventas</p>
          </div>
        </Link>
      </div>

      {/* Últimas órdenes */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between">
          <h2 className="font-semibold text-white">Últimas órdenes</h2>
          <Link href="/admin/ordenes" className="text-brand-purple text-sm hover:underline">
            Ver todas
          </Link>
        </div>

        {ordenesRecientes.length === 0 ? (
          <div className="p-10 text-center text-brand-text-muted text-sm">
            Todavía no hay órdenes
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {ordenesRecientes.map((orden) => (
              <div key={orden.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-text truncate">
                    {orden.datos_comprador?.nombre || 'Cliente'}
                  </p>
                  <p className="text-xs text-brand-text-muted">{formatFecha(orden.created_at)}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${estadoColores[orden.estado] || 'bg-gray-100 text-gray-600'}`}>
                  {estadoLabels[orden.estado] || orden.estado}
                </span>
                <span className="font-semibold text-brand-text text-sm whitespace-nowrap">
                  {formatPrecio(Number(orden.total))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
