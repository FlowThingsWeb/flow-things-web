import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { guardarCheckoutEnProgreso, MAX_ITEMS } from '@/lib/checkout-en-progreso'

/**
 * POST — guarda el carrito de quien ya escribió su email en el checkout.
 *
 * Se llama mientras el comprador completa el formulario, antes de apretar
 * "Pagar". Es el único momento en que un visitante sin cuenta deja una forma
 * de contacto, y hasta ahora se perdía: la orden recién nace en el botón de
 * pago y el carrito guardado sólo existe para usuarios logueados.
 *
 * No devuelve nada más que `ok`. Es importante que sea así: el endpoint no
 * pide autenticación —el comprador no tiene cuenta— y si contestara con lo
 * que hay guardado para un email, cualquiera podría preguntar por el de otro.
 * Escribe y calla.
 *
 * Lo que llega del navegador son ids y cantidades; los nombres y los precios
 * los pone el servidor leyendo la base, porque terminan dentro de un mail con
 * el logo de la tienda.
 */
export async function POST(request: NextRequest) {
  try {
    // El body se corta en seco: sin esto, un carrito de 50 ítems y un nombre
    // de 10 MB entran igual y el parseo los paga.
    const crudo = await request.text()
    if (crudo.length > 64_000) {
      return NextResponse.json({ error: 'Demasiado grande' }, { status: 413 })
    }
    const body = JSON.parse(crudo)

    const items = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS) : []
    if (items.length === 0) return NextResponse.json({ ok: false })

    // Si viene con sesión, se guarda de quién es. No es obligatorio.
    let userId: string | null = null
    const auth = request.headers.get('Authorization')
    if (auth?.startsWith('Bearer ')) {
      const { data } = await supabaseAdmin.auth.getUser(auth.slice(7))
      userId = data?.user?.id ?? null
    }

    const res = await guardarCheckoutEnProgreso({
      email: String(body?.email ?? ''),
      nombre: body?.nombre ?? null,
      telefono: body?.telefono ?? null,
      userId,
      items: items.map((i: Record<string, unknown>) => ({
        id: String(i?.id ?? ''),
        cantidad: Number(i?.cantidad) || 1,
        variante_id: i?.variante_id ? String(i.variante_id) : null,
      })),
    })

    // Un email a medio escribir no es un error del que haya que avisar: el
    // formulario lo va a reintentar en cuanto termine de tipear.
    return NextResponse.json({ ok: res.ok })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
