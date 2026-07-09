import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notFound } from 'next/navigation'
import DespacharForm from './DespacharForm'
import { formatPrecio } from '@/lib/format'

const fmt = formatPrecio

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
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

export default async function OrdenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: orden } = await supabaseAdmin
    .from('ordenes')
    .select('*')
    .eq('id', id)
    .single()

  if (!orden) notFound()

  const comprador = orden.datos_comprador ?? {}
  const items: any[] = orden.items ?? []
  const subtotal = items.reduce((s: number, i: any) => s + i.precio * i.cantidad, 0)
  const descuento = Number(orden.descuento_monto ?? 0)
  const envio = Number(comprador.envio_costo ?? 0)
  const yaFueEnviado = !!comprador.despacho_fecha

  return (
    <div className="p-8 max-w-3xl">

      {/* Encabezado */}
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin/ordenes" className="text-brand-text-muted hover:text-white text-sm transition-colors">
          ← Órdenes
        </a>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Orden #{id.slice(0, 8)}</h1>
          <p className="text-brand-text-muted text-sm mt-0.5">{fmtFecha(orden.created_at)}</p>
        </div>
        <span className={`text-sm font-medium px-3 py-1.5 rounded-full border ${estadoColores[orden.estado] || 'bg-gray-100 text-gray-600'}`}>
          {estadoLabels[orden.estado] || orden.estado}
        </span>
      </div>

      {/* Datos del comprador */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 mb-5">
        <h2 className="font-semibold text-white text-sm uppercase tracking-wide mb-4">👤 Comprador</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div><span className="text-brand-text-muted">Nombre</span><p className="text-white mt-0.5">{comprador.nombre || '—'}</p></div>
          <div><span className="text-brand-text-muted">Email</span><p className="text-white mt-0.5">{comprador.email || '—'}</p></div>
          <div><span className="text-brand-text-muted">Teléfono</span><p className="text-white mt-0.5">{comprador.telefono || '—'}</p></div>
          <div><span className="text-brand-text-muted">DNI / CUIT</span><p className="text-white mt-0.5">{comprador.dni || '—'}</p></div>
          {comprador.direccion && (
            <div className="col-span-2">
              <span className="text-brand-text-muted">Dirección de envío</span>
              <p className="text-white mt-0.5">{comprador.direccion}, {comprador.ciudad}</p>
            </div>
          )}
        </div>
      </div>

      {/* Productos */}
      <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 mb-5">
        <h2 className="font-semibold text-white text-sm uppercase tracking-wide mb-4">📦 Productos</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-left text-brand-text-muted font-medium pb-2">Producto</th>
              <th className="text-center text-brand-text-muted font-medium pb-2 w-16">Cant.</th>
              <th className="text-right text-brand-text-muted font-medium pb-2 w-28">Precio unit.</th>
              <th className="text-right text-brand-text-muted font-medium pb-2 w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, i: number) => (
              <tr key={i} className="border-b border-brand-border/50">
                <td className="py-3 text-white">{item.nombre}</td>
                <td className="py-3 text-center text-brand-text-muted">{item.cantidad}</td>
                <td className="py-3 text-right text-brand-text-muted">{fmt(item.precio)}</td>
                <td className="py-3 text-right text-white font-medium">{fmt(item.precio * item.cantidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Resumen financiero */}
        <div className="mt-4 pt-4 border-t border-brand-border space-y-2 text-sm">
          <div className="flex justify-between text-brand-text-muted">
            <span>Subtotal</span><span>{fmt(subtotal)}</span>
          </div>
          {descuento > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Descuento {orden.codigo_descuento ? `(${orden.codigo_descuento})` : ''}</span>
              <span>- {fmt(descuento)}</span>
            </div>
          )}
          <div className="flex justify-between text-brand-text-muted">
            <span>Envío {comprador.envio_nombre ? `(${comprador.envio_nombre})` : ''}</span>
            <span>{envio > 0 ? fmt(envio) : 'Gratis'}</span>
          </div>
          <div className="flex justify-between text-white font-bold text-base pt-2 border-t border-brand-border">
            <span>Total</span><span className="text-brand-neon">{fmt(Number(orden.total))}</span>
          </div>
        </div>
      </div>

      {/* Factura AFIP */}
      {comprador.factura_cae && (
        <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 mb-5">
          <h2 className="font-semibold text-white text-sm uppercase tracking-wide mb-4">🧾 Factura electrónica</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-brand-text-muted">CAE</span><p className="text-brand-neon font-mono mt-0.5">{comprador.factura_cae}</p></div>
            <div><span className="text-brand-text-muted">Nro. comprobante</span><p className="text-white mt-0.5">{comprador.factura_nro}</p></div>
            <div><span className="text-brand-text-muted">Fecha</span><p className="text-white mt-0.5">{comprador.factura_fecha}</p></div>
            <div><span className="text-brand-text-muted">Vto. CAE</span><p className="text-white mt-0.5">{comprador.factura_vto}</p></div>
          </div>
        </div>
      )}

      {/* Estado de despacho previo */}
      {yaFueEnviado && (
        <div className="bg-green-900/20 border border-green-700 rounded-2xl p-6 mb-5">
          <h2 className="font-semibold text-green-400 text-sm uppercase tracking-wide mb-3">✅ Pedido despachado</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-brand-text-muted">Courier</span><p className="text-white mt-0.5">{comprador.despacho_courier}</p></div>
            <div><span className="text-brand-text-muted">Tracking</span><p className="text-white font-mono mt-0.5">{comprador.despacho_tracking}</p></div>
            <div><span className="text-brand-text-muted">Fecha de despacho</span><p className="text-white mt-0.5">{fmtFecha(comprador.despacho_fecha)}</p></div>
            {comprador.despacho_tracking_url && (
              <div>
                <span className="text-brand-text-muted">Link de seguimiento</span>
                <a href={comprador.despacho_tracking_url} target="_blank" className="block text-brand-neon mt-0.5 hover:underline text-xs truncate">
                  {comprador.despacho_tracking_url}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formulario de despacho */}
      {orden.estado === 'approved' && (
        <DespacharForm
          ordenId={id}
          emailComprador={comprador.email}
          yaEnviado={yaFueEnviado}
        />
      )}
    </div>
  )
}
