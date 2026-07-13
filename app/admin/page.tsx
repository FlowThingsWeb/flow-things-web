import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Link from 'next/link'
import { formatPrecio } from '@/lib/format'

export const dynamic = 'force-dynamic'

// Umbral de stock bajo: productos/variantes con stock <= este valor se listan
// como alerta en el dashboard. Ajustar acá si el negocio necesita otro corte.
const UMBRAL_STOCK_BAJO = 5

interface LineaStock {
  id: string
  slug: string
  nombre: string
  stock: number
  variante: string | null
}

async function getStockBajo(): Promise<LineaStock[]> {
  const { data } = await supabaseAdmin
    .from('productos')
    .select('id, nombre, slug, stock, variantes(id, stock, atributos, activo)')
    .eq('activo', true)

  const lineas: LineaStock[] = []
  for (const p of (data as any[]) || []) {
    const variantesActivas = (p.variantes || []).filter((v: any) => v.activo)
    if (variantesActivas.length > 0) {
      // Stock se controla a nivel variante
      for (const v of variantesActivas) {
        if (v.stock <= UMBRAL_STOCK_BAJO) {
          lineas.push({
            id: p.id,
            slug: p.slug,
            nombre: p.nombre,
            stock: v.stock,
            variante: Object.values(v.atributos || {}).join(' / ') || 'Variante',
          })
        }
      }
    } else if (p.stock <= UMBRAL_STOCK_BAJO) {
      lineas.push({ id: p.id, slug: p.slug, nombre: p.nombre, stock: p.stock, variante: null })
    }
  }

  // Más críticos primero (sin stock arriba)
  return lineas.sort((a, b) => a.stock - b.stock)
}

interface TopProducto {
  nombre: string
  cantidad: number
  monto: number
}

async function getStats() {
  const ahora = new Date()
  const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

  const [
    { count: totalProductos },
    { count: totalOrdenes },
    { data: ordenesRecientes },
    { data: aprobadasTotales },
    { data: aprobadasMes },
  ] = await Promise.all([
    supabaseAdmin.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
    supabaseAdmin.from('ordenes').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('ordenes').select('*').order('created_at', { ascending: false }).limit(5),
    // Ingresos históricos: solo la columna total (payload mínimo)
    supabaseAdmin.from('ordenes').select('total').eq('estado', 'approved'),
    // Set del mes: para ventas de hoy, del mes y top productos (una sola lectura)
    supabaseAdmin
      .from('ordenes')
      .select('total, items, created_at')
      .eq('estado', 'approved')
      .gte('created_at', inicioMes.toISOString()),
  ])

  const ingresos = (aprobadasTotales || []).reduce((acc, o) => acc + Number(o.total), 0)

  const mes = aprobadasMes || []
  const ventasMes = { count: mes.length, monto: mes.reduce((a, o) => a + Number(o.total), 0) }

  const hoy = mes.filter((o) => new Date(o.created_at) >= inicioDia)
  const ventasHoy = { count: hoy.length, monto: hoy.reduce((a, o) => a + Number(o.total), 0) }

  // Top productos del mes (por unidades vendidas)
  const acum = new Map<string, TopProducto>()
  for (const o of mes) {
    for (const it of ((o.items as any[]) || [])) {
      const prev = acum.get(it.nombre) || { nombre: it.nombre, cantidad: 0, monto: 0 }
      prev.cantidad += Number(it.cantidad) || 0
      prev.monto += (Number(it.precio) || 0) * (Number(it.cantidad) || 0)
      acum.set(it.nombre, prev)
    }
  }
  const topProductos = [...acum.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5)

  return {
    totalProductos,
    totalOrdenes,
    ingresos,
    ventasHoy,
    ventasMes,
    topProductos,
    ordenesRecientes: ordenesRecientes || [],
  }
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

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminDashboard() {
  const [
    { totalProductos, totalOrdenes, ingresos, ventasHoy, ventasMes, topProductos, ordenesRecientes },
    stockBajo,
  ] = await Promise.all([getStats(), getStockBajo()])

  const secundarias = [
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

      {/* KPIs de ventas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">☀️</span>
            <span className="text-brand-text-muted text-sm">Ventas de hoy</span>
          </div>
          <p className="text-3xl font-bold text-brand-neon">{formatPrecio(ventasHoy.monto)}</p>
          <p className="text-brand-text-muted text-sm mt-1">
            {ventasHoy.count} venta{ventasHoy.count !== 1 ? 's' : ''} aprobada{ventasHoy.count !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📅</span>
            <span className="text-brand-text-muted text-sm">Ventas del mes</span>
          </div>
          <p className="text-3xl font-bold text-brand-neon">{formatPrecio(ventasMes.monto)}</p>
          <p className="text-brand-text-muted text-sm mt-1">
            {ventasMes.count} venta{ventasMes.count !== 1 ? 's' : ''} aprobada{ventasMes.count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stats secundarias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {secundarias.map((stat) => (
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

      {/* Top productos del mes */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden mb-10">
        <div className="px-6 py-4 border-b border-brand-border">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <span>🏆</span> Más vendidos del mes
          </h2>
        </div>
        {topProductos.length === 0 ? (
          <div className="p-8 text-center text-brand-text-muted text-sm">
            Todavía no hay ventas este mes
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {topProductos.map((p, i) => (
              <div key={p.nombre} className="px-6 py-3 flex items-center gap-4">
                <span className="text-brand-text-light font-bold text-sm w-5">{i + 1}</span>
                <p className="flex-1 min-w-0 text-sm font-medium text-brand-text truncate">{p.nombre}</p>
                <span className="text-xs text-brand-text-muted whitespace-nowrap">{formatPrecio(p.monto)}</span>
                <span className="text-xs font-bold bg-brand-purple/20 text-brand-purple-light px-2.5 py-1 rounded-full whitespace-nowrap">
                  {p.cantidad} u.
                </span>
              </div>
            ))}
          </div>
        )}
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

      {/* Alerta de stock bajo */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden mb-10">
        <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <span>⚠️</span> Stock bajo
            {stockBajo.length > 0 && (
              <span className="text-xs font-medium bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full">
                {stockBajo.length}
              </span>
            )}
          </h2>
          <Link href="/admin/productos" className="text-brand-purple text-sm hover:underline">
            Ver productos
          </Link>
        </div>

        {stockBajo.length === 0 ? (
          <div className="p-8 text-center text-brand-text-muted text-sm">
            ✅ Todo con stock suficiente (nada en {UMBRAL_STOCK_BAJO} unidades o menos)
          </div>
        ) : (
          <div className="divide-y divide-brand-border max-h-96 overflow-y-auto">
            {stockBajo.map((l, i) => (
              <Link
                key={`${l.id}-${l.variante ?? ''}-${i}`}
                href={`/admin/productos/nuevo?id=${l.id}`}
                className="px-6 py-3 flex items-center gap-4 hover:bg-brand-bg-soft/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-text truncate">{l.nombre}</p>
                  {l.variante && (
                    <p className="text-xs text-brand-text-muted truncate">{l.variante}</p>
                  )}
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                    l.stock === 0
                      ? 'bg-red-900/40 text-red-400'
                      : 'bg-amber-900/40 text-amber-400'
                  }`}
                >
                  {l.stock === 0 ? 'Sin stock' : `${l.stock} u.`}
                </span>
              </Link>
            ))}
          </div>
        )}
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
