import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { crearPreferencia } from '@/lib/mercadopago'
import { calcularEnvio } from '@/lib/envio'
import { ItemOrden, DatosComprador } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Extraer user_id del token JWT si viene en el header Authorization
    let userId: string | null = null
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) userId = user.id
    }

    const {
      items: itemsFrontend,
      comprador,
      codigo_descuento,
      primer_compra,
      envio_tipo,
      envio_nombre,
    }: {
      items: ItemOrden[]
      comprador: DatosComprador
      codigo_descuento?: string | null
      primer_compra?: boolean
      envio_tipo?: string | null
      envio_nombre?: string | null
      // Nota: envio_costo ya no se acepta del frontend — se recalcula en el servidor
    } = await request.json()

    if (!itemsFrontend?.length) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
    }

    // Envío obligatorio — debe venir envio_tipo para que el servidor lo valide y calcule
    if (!envio_tipo) {
      return NextResponse.json({ error: 'Debe seleccionar una opción de envío' }, { status: 400 })
    }

    // ─── 1. Validar stock Y precios desde la DB ─────────────────────────────
    // No confiamos en el precio enviado por el frontend.
    const ids = itemsFrontend.map((i) => i.id)
    const { data: productosDB } = await supabaseAdmin
      .from('productos')
      .select('id, nombre, precio, stock')
      .in('id', ids)

    const items: ItemOrden[] = []
    for (const item of itemsFrontend) {
      const prod = productosDB?.find((p: { id: string; precio: number; stock: number }) => p.id === item.id)
      if (!prod || prod.stock < item.cantidad) {
        return NextResponse.json(
          { error: `Sin stock suficiente para "${item.nombre}". Solo quedan ${prod?.stock ?? 0} unidades.` },
          { status: 409 }
        )
      }
      // Usar precio de la DB, ignorar el del frontend
      items.push({ ...item, precio: prod.precio })
    }

    const subtotal = items.reduce((acc, item) => acc + item.precio * item.cantidad, 0)

    // ─── 2. Validar código de descuento en el servidor ───────────────────────
    let descuento_monto = 0
    let codigoValidado: string | null = null
    let primerCompraMonto = 0

    if (codigo_descuento) {
      const { data: codigo } = await supabaseAdmin
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
        if (codigo.tipo === 'porcentaje') {
          descuento_monto = Math.round((subtotal * codigo.valor) / 100)
        } else {
          descuento_monto = Math.min(codigo.valor, subtotal)
        }
        codigoValidado = codigo.codigo
        // El incremento de usos se realiza en el webhook, una vez que el pago se aprueba.
      }
    }

    // ─── Descuento primera compra (validado server-side) ────────────────────
    if (primer_compra && userId) {
      const [perfilRes, ordenesRes] = await Promise.all([
        supabaseAdmin.from('perfiles').select('primer_compra_usada').eq('user_id', userId).single(),
        supabaseAdmin.from('ordenes').select('id').eq('user_id', userId).eq('estado', 'approved').limit(1),
      ])
      const yaUsada = perfilRes.data?.primer_compra_usada ?? false
      const tieneOrdenes = (ordenesRes.data?.length ?? 0) > 0
      if (!yaUsada && !tieneOrdenes) {
        const montoPC = Math.round(subtotal * 0.1)
        descuento_monto += montoPC
        primerCompraMonto = montoPC
        if (!codigoValidado) codigoValidado = '__PRIMER_COMPRA__'
      }
    }

    // ─── 3. Calcular envío en el servidor ───────────────────────────────────
    // No confiamos en envio_costo del frontend. Lo recalculamos desde la DB de config.
    const subtotalConDescuento = Math.max(0, subtotal - descuento_monto)
    let costoEnvio = 0
    let envioNombreFinal = envio_nombre ?? null
    let envioTipoFinal   = envio_tipo ?? null

    if (envio_tipo && comprador.provincia) {
      if (envio_tipo === 'retiro') {
        // Retiro en tienda — el carrito debería mandar envio_tipo='retiro' cuando se implemente esa opción.
        // Por ahora el cotizador solo genera 'standard', por lo que este branch no se activa en producción.
        costoEnvio       = 0
        envioNombreFinal = 'Retiro en tienda'
        envioTipoFinal   = 'retiro'
      } else {
        const opcion = await calcularEnvio(comprador.provincia, subtotalConDescuento)
        if (opcion) {
          costoEnvio       = opcion.precio
          envioNombreFinal = opcion.nombre
          envioTipoFinal   = opcion.id
        }
      }
    }

    const total = subtotalConDescuento + costoEnvio

    // ─── 4. Crear orden ──────────────────────────────────────────────────────
    const { data: orden, error: ordenError } = await supabaseAdmin
      .from('ordenes')
      .insert([
        {
          estado: 'pending',
          total,
          items,
          user_id: userId,
          datos_comprador: {
            ...comprador,
            ...(envioTipoFinal
              ? { envio_tipo: envioTipoFinal, envio_nombre: envioNombreFinal, envio_costo: costoEnvio }
              : {}),
            ...(primerCompraMonto > 0 ? { primer_compra_monto: primerCompraMonto } : {}),
          },
          descuento_monto,
          codigo_descuento: codigoValidado,
        },
      ])
      .select()
      .single()

    if (ordenError || !orden) {
      console.error('[checkout] error al crear orden:', ordenError)
      return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 })
    }

    // ─── 5. Crear preferencia MP ─────────────────────────────────────────────
    const itemsParaMP = [...items] as (ItemOrden & { imagen_url?: string | null })[]

    if (costoEnvio > 0) {
      itemsParaMP.push({
        id: 'envio',
        nombre: `Envío ${envioNombreFinal ?? envioTipoFinal ?? ''}`.trim(),
        precio: costoEnvio,
        cantidad: 1,
        imagen_url: null,
      } as ItemOrden)
    }

    const mpPreference = await crearPreferencia({
      items: itemsParaMP,
      comprador,
      ordenId: orden.id,
      // Si hay descuento, usar total final como ítem único (MP rechaza unit_price negativos)
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
