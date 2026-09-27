import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, escapeHtml, filaProducto } from '@/lib/email'
import { armarMailCarrito } from '@/lib/carrito-abandonado'
import type { EtapaCarrito } from '@/lib/email-constants'
import { formatMonto } from '@/lib/format'

/**
 * El carrito de quien dejó su email en el checkout y no terminó de pagar.
 *
 * Antes esto no existía: el carrito sólo se guardaba si el visitante tenía
 * sesión iniciada, y en 30 días hubo UN inicio de sesión sobre 399 visitas.
 * El panel de carritos abandonados mostraba cuatro filas, la más nueva de
 * hacía un mes. Todo lo que se abandonaba se perdía.
 *
 * La otra mitad del panel —las órdenes pendientes— tampoco alcanzaba: esa
 * fila recién nace cuando el comprador aprieta "Pagar". El que carga su mail
 * y se traba eligiendo el envío no quedaba registrado en ningún lado, y es
 * justamente el que se puede recuperar.
 */

/** Lo mínimo para que un mail sea un mail. No valida que exista. */
export function emailPlausible(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

/** Tope de ítems que se aceptan de un borrador. Un carrito real no llega. */
export const MAX_ITEMS = 50

export type ItemBorrador = {
  id: string
  cantidad: number
  variante_id?: string | null
}

/**
 * Guarda (o pisa) el checkout en progreso de un email.
 *
 * Los precios y los nombres salen de la base, nunca de lo que manda el
 * navegador: este contenido termina dentro de un mail con el logo de la
 * tienda, y no puede decir lo que alguien quiera que diga.
 *
 * Tocar el carrito reinicia la secuencia de recordatorios, igual que en
 * `CartSync`: quien acaba de cambiar algo no tiene que recibir el mail de la
 * semana por un carrito de hace un minuto.
 */
export async function guardarCheckoutEnProgreso(datos: {
  email: string
  nombre?: string | null
  telefono?: string | null
  userId?: string | null
  items: ItemBorrador[]
}): Promise<{ ok: boolean; error?: string }> {
  const email = datos.email.trim().toLowerCase()
  if (!emailPlausible(email)) return { ok: false, error: 'Email inválido.' }

  const pedidos = datos.items
    .filter((i) => i?.id && Number.isInteger(i.cantidad) && i.cantidad > 0 && i.cantidad <= 999)
    .slice(0, MAX_ITEMS)
  if (pedidos.length === 0) return { ok: false, error: 'Sin ítems.' }

  const { data: productos } = await supabaseAdmin
    .from('productos')
    .select('id, nombre, precio, imagen_url, sku')
    .in('id', pedidos.map((i) => i.id))

  const porId = new Map((productos ?? []).map((p) => [p.id, p]))
  const items = pedidos
    .map((i) => {
      const p = porId.get(i.id)
      if (!p) return null
      return {
        id: p.id,
        nombre: p.nombre,
        precio: Number(p.precio) || 0,
        cantidad: i.cantidad,
        imagen_url: p.imagen_url ?? null,
        sku: p.sku ?? null,
        variante_id: i.variante_id ?? null,
      }
    })
    .filter((i): i is NonNullable<typeof i> => i !== null)

  // Todos los ids eran de productos que ya no están: no hay nada que recuperar.
  if (items.length === 0) return { ok: false, error: 'Sin ítems válidos.' }

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const ahora = new Date().toISOString()

  // Los campos personales se recortan: entran a un mail y a una pantalla del
  // admin, y nadie se llama con 200 caracteres.
  const recorte = (v: string | null | undefined, largo: number) =>
    v ? String(v).trim().slice(0, largo) || null : null

  const { error } = await supabaseAdmin
    .from('checkouts_en_progreso')
    .upsert(
      {
        email,
        nombre: recorte(datos.nombre, 120),
        telefono: recorte(datos.telefono, 40),
        items,
        total,
        user_id: datos.userId ?? null,
        updated_at: ahora,
        recordatorio_2h_at: null,
        recordatorio_24h_at: null,
        recordatorio_7d_at: null,
        convertido_at: null,
      },
      { onConflict: 'email' },
    )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Deja de perseguir a quien terminó comprando.
 *
 * Se llama con el email de la orden recién creada. Marcarlo en vez de borrar
 * la fila deja ver en el panel cuáles se recuperaron y cuáles no.
 */
export async function marcarCheckoutConvertido(email: string | null | undefined) {
  const limpio = (email ?? '').trim().toLowerCase()
  if (!limpio) return
  await supabaseAdmin
    .from('checkouts_en_progreso')
    .update({ convertido_at: new Date().toISOString() })
    .eq('email', limpio)
}

/** Los ítems de un checkout en progreso, para volver a armar el carrito. */
export async function itemsDeCheckout(id: string) {
  const { data } = await supabaseAdmin
    .from('checkouts_en_progreso')
    .select('items, convertido_at')
    .eq('id', id)
    .maybeSingle()
  if (!data || data.convertido_at) return []
  return Array.isArray(data.items) ? data.items : []
}

/**
 * Manda el recordatorio de una etapa y lo marca. Lo comparten el cron y el
 * botón de envío manual del admin.
 */
export async function enviarRecordatorioCheckoutEnProgreso(
  id: string,
  etapa: EtapaCarrito = '2h',
): Promise<{ ok: boolean; error?: string }> {
  const { data: fila } = await supabaseAdmin
    .from('checkouts_en_progreso')
    .select('id, email, nombre, items, convertido_at')
    .eq('id', id)
    .maybeSingle()

  if (!fila) return { ok: false, error: 'No existe.' }
  if (fila.convertido_at) return { ok: false, error: 'Ya compró.' }

  const items = Array.isArray(fila.items) ? fila.items : []
  if (items.length === 0) return { ok: false, error: 'Sin ítems.' }

  const nombre = fila.nombre || String(fila.email).split('@')[0] || 'Hola'
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')

  const filas = items
    .map((it: Record<string, unknown>) => {
      const n = escapeHtml(String(it?.nombre ?? 'Producto'))
      const cant = Number(it?.cantidad) || 1
      const precio = Number(it?.precio ?? 0)
      return filaProducto(it?.imagen_url as string | null, n, cant, formatMonto(precio * cant), appUrl)
    })
    .join('')
  const productosLista = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${filas}</table>`

  // El link lleva a /retomar/<id>, que vuelve a cargar los productos en el
  // carrito: el mismo camino que el mail de orden pendiente.
  const { asunto, cuerpo } = armarMailCarrito(
    etapa, nombre, productosLista, `${appUrl}/retomar/${fila.id}`,
  )

  try {
    await sendEmail({ to: fila.email, asunto, cuerpo })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al enviar.' }
  }
}
