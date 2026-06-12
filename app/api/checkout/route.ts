import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { crearPreferencia } from '@/lib/mercadopago'
import { ItemOrden, DatosComprador } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const {
      items,
      comprador,
      codigo_descuento,
      descuento_monto: descuentoFrontend,
      envio_tipo,
      envio_nombre,
      envio_costo,
    }: {
      items: ItemOrden[]
      comprador: DatosComprador
      codigo_descuento?: string | null
      descuento_monto?: number
      envio_tipo?: string | null
      envio_nombre?: string | null
      envio_costo?: number
    } = await request.json()

    if (!items?.length) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
    }

    // Validar stock disponible para cada ítem antes de crear la orden
    const ids = items.map((i) => i.id)
    const { data: productosDB } = await supabaseAdmin
      .from('productos')
      .select('id, nombre, stock')
      .in('id', ids)

    for (const item of items) {
      const prod = productosDB?.find((p: { id: string; stock: number }) => p.id === item.id)
      if (!prod || prod.stock < item.cantidad) {
        return NextResponse.json(
          { error: `Sin stock suficiente para "${item.nombre}". Solo quedan ${prod?.stock ?? 0} unidades.` },
          { status: 409 }
        )
      }
    }

    const subtotal = items.reduce((acc, item) => acc + item.precio * item.cantidad, 0)

    // --- Validar código de descuento en el servidor (seguridad: no confiar sólo en el frontend) ---
    let descuento_monto = 0
    let codigoValidado: string | null = null

    if (codigo_descuento) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js')
        const db = createClient(supabaseUrl, supabaseKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        const { data: codigo } = await db
          .from('codigos_descuento')
          .select('*')
          .eq('codigo', codigo_descuento.trim())
          .single()

        if (
          codigo &&
          codigo.activo &&
          (codigo.usos_maximos === null || codigo.usos_actuales < codigo.usos_maximos) &&
          (!codigo.fecha_vencimiento || new Date(codigo.fecha_vencimiento) >= new Date())
        ) {
          // Código válido — calcular descuento real en el servidor
          if (codigo.tipo === 'porcentaje') {
            descuento_monto = Math.round((subtotal * codigo.valor) / 100)
          } else {
            descuento_monto = Math.min(codigo.valor, subtotal)
          }
          codigoValidado = codigo.codigo

          // El incremento de usos se realiza en el webhook, una vez que el pago se aprueba.
          // Así evitamos quemar el código si MP falla o el usuario abandona el pago.
        }
        // Si el código no es válido, descuento queda en 0 (ignoramos lo que mandó el frontend)
      }
    }

    const costoEnvio = Number(envio_costo ?? 0)
    const total = Math.max(0, subtotal - descuento_monto) + costoEnvio

    // Crear orden en Supabase
    const { data: orden, error: ordenError } = await supabaseAdmin
      .from('ordenes')
      .insert([
        {
          estado: 'pending',
          total,
          items,
          datos_comprador: {
            ...comprador,
            ...(envio_tipo ? { envio_tipo, envio_nombre, envio_costo: costoEnvio } : {}),
          },
          descuento_monto,
          codigo_descuento: codigoValidado,
        },
      ])
      .select()
      .single()

    if (ordenError || !orden) {
      console.error('[checkout] error al crear orden:', ordenError)
      return NextResponse.json(
        { error: 'No se pudo crear la orden' },
        { status: 500 }
      )
    }

    // Crear preferencia de pago en Mercado Pago con el total con descuento.
    // El descuento se pasa como `coupon_amount` (MP rechaza items con unit_price negativo).
    let itemsParaMP: any[] = [...items]

    if (costoEnvio > 0) {
      itemsParaMP.push({
        id: 'envio',
        nombre: `Envío ${envio_nombre ?? envio_tipo ?? ''}`.trim(),
        precio: costoEnvio,
        cantidad: 1,
        imagen_url: null,
      })
    }

    const mpPreference = await crearPreferencia({
      items: itemsParaMP,
      comprador,
      ordenId: orden.id,
      // Si hay descuento, pasar el total final para usar un ítem único en MP
      // (MP rechaza unit_price negativos — no se puede pasar un ítem de descuento)
      totalConDescuento: descuento_monto > 0 ? total : undefined,
    })

    // Guardar preference_id en la orden
    await supabaseAdmin
      .from('ordenes')
      .update({ mp_preference_id: mpPreference.id })
      .eq('id', orden.id)

    return NextResponse.json({
      ordenId: orden.id,
      preferenceId: mpPreference.id,
      initPoint: mpPreference.init_point,
    })
  } catch (error) {
    console.error('Error en checkout:', error)
    return NextResponse.json({ error: 'Error al procesar el pedido' }, { status: 500 })
  }
}
