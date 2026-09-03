import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, escapeHtml } from '@/lib/email'
import { CARRITO_ETAPAS, type EtapaCarrito } from '@/lib/email-constants'
import { armarMailCarrito } from '@/lib/carrito-abandonado'
import { formatMonto } from '@/lib/format'
import { enviarRecordatorioCheckout } from '@/lib/checkout-abandonado'

export const maxDuration = 60

/** La primera etapa es a las 2 horas: antes de eso no hay nada para mandar. */
const MIN_HORAS = 2
const BATCH = 25

/**
 * Las etapas, de la más vieja a la más nueva.
 *
 * El orden importa: para un carrito se busca la etapa MÁS avanzada que ya
 * venció y todavía no salió. Un carrito de diez días al que nunca se le mandó
 * nada —porque el cron estuvo caído, o porque se cargó después— recibe el de
 * la semana, no el de las 2 horas.
 */
const ETAPAS = (['7d', '24h', '2h'] as EtapaCarrito[]).map((k) => ({
  clave: k,
  ...CARRITO_ETAPAS[k],
}))

/**
 * Hasta cuándo se sigue insistiendo.
 *
 * Después de la semana no hay más mails, así que un carrito más viejo que eso
 * sólo ensucia la consulta. Se deja margen para que el de la semana salga
 * aunque el cron no haya corrido justo ese día.
 */
const MAX_HORAS = 24 * 21

/**
 * Cron: envía email de recuperación a carritos abandonados (usuarios logueados
 * con carrito guardado). Protegido con CRON_SECRET. Marca recordatorio_enviado
 * para no repetir; CartSync lo re-arma (null) cuando el carrito cambia.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  const ahora = Date.now()
  const desde = new Date(ahora - MAX_HORAS * 3600_000).toISOString()
  const hasta = new Date(ahora - MIN_HORAS * 3600_000).toISOString()

  const { data: carritos } = await supabaseAdmin
    .from('carritos_guardados')
    .select('user_id, items, updated_at, recordatorio_2h_at, recordatorio_24h_at, recordatorio_7d_at')
    .is('recordatorio_7d_at', null)
    .gt('updated_at', desde)
    .lt('updated_at', hasta)
    // Primero los más viejos: son los que tienen la etapa más avanzada
    // pendiente. Sin orden, una tanda de 25 podía llenarse de carritos de
    // ayer y dejar los de la semana pasada esperando otra corrida.
    .order('updated_at', { ascending: true })
    .limit(BATCH)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')
  let enviados = 0
  let yaCompraron = 0
  const porEtapa: Record<string, number> = {}

  /**
   * Quién ya compró, y cuándo.
   *
   * A alguien que ya pagó no se le manda nada: el mail diría "te quedó algo
   * pendiente" cuando no le quedó nada. Se mira por `user_id` y también por
   * email, porque una compra hecha sin sesión iniciada no queda atada a la
   * cuenta aunque sea la misma persona.
   *
   * Se compara contra `updated_at` del carrito y no contra el momento actual:
   * lo que interesa es si compró DESPUÉS de dejar estas cosas ahí. Una compra
   * de la semana pasada no dice nada sobre el carrito de hoy.
   */
  const { data: aprobadasUsuarios } = await supabaseAdmin
    .from('ordenes')
    .select('user_id, datos_comprador, created_at')
    .eq('estado', 'approved')
  const compraPorUser = new Map<string, string>()
  const compraPorEmail = new Map<string, string>()
  for (const o of aprobadasUsuarios || []) {
    const guardarMax = (mapa: Map<string, string>, clave: string | undefined | null) => {
      if (!clave) return
      const previo = mapa.get(clave)
      if (!previo || o.created_at > previo) mapa.set(clave, o.created_at)
    }
    guardarMax(compraPorUser, o.user_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    guardarMax(compraPorEmail, (o.datos_comprador as any)?.email?.toLowerCase())
  }

  for (const c of carritos || []) {
    const items = Array.isArray(c.items) ? c.items : []
    if (items.length === 0) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fila = c as any
    const horas = (ahora - new Date(c.updated_at).getTime()) / 3600_000
    // Vencidas y sin enviar. La primera de la lista es la más avanzada.
    const vencidas = ETAPAS.filter((e) => horas >= e.horas && !fila[e.columna])
    if (vencidas.length === 0) continue
    const etapa = vencidas[0]

    const compraDelUsuario = compraPorUser.get(c.user_id)
    if (compraDelUsuario && compraDelUsuario > c.updated_at) {
      yaCompraron++
      continue
    }

    // Email del usuario
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(c.user_id)
    const email = userRes?.user?.email
    if (!email) continue

    // La compra puede haber salido sin sesión: se chequea también por email.
    const compraDelEmail = compraPorEmail.get(email.toLowerCase())
    if (compraDelEmail && compraDelEmail > c.updated_at) {
      yaCompraron++
      continue
    }

    // Nombre desde perfil (fallback: parte local del email)
    const { data: perfil } = await supabaseAdmin
      .from('perfiles').select('nombre').eq('user_id', c.user_id).single()
    const nombre = perfil?.nombre || email.split('@')[0] || 'Hola'

    // Lista de productos (HTML seguro)
    const filas = items.map((it: any) => {
      const n = escapeHtml(String(it?.producto?.nombre ?? it?.nombre ?? 'Producto'))
      const cant = Number(it?.cantidad) || 1
      const precio = Number(it?.producto?.precio ?? it?.precio ?? 0)
      return `<tr>
        <td style="padding:8px 0;font-size:14px;color:#374151">${cant}× ${n}</td>
        <td style="padding:8px 0;font-size:14px;color:#374151;text-align:right;font-weight:600">${formatMonto(precio * cant)}</td>
      </tr>`
    }).join('')
    const productosLista = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${filas}</table>`

    const { asunto, cuerpo } = armarMailCarrito(
      etapa.clave, nombre, productosLista, `${appUrl}/carrito`,
    )

    try {
      await sendEmail({ to: email, asunto, cuerpo })
      /**
       * Se marcan TODAS las etapas vencidas, no sólo la que salió.
       *
       * Si a un carrito de diez días le mandamos el de la semana, el de las 2
       * horas y el del día ya no corresponden: quedarían pendientes y saldrían
       * en la corrida siguiente, tres mails seguidos por algo que se abandonó
       * hace rato. Se las da por cumplidas con la misma fecha.
       */
      const marca = new Date().toISOString()
      const update: Record<string, string> = { recordatorio_enviado: marca }
      for (const v of vencidas) update[v.columna] = marca
      await supabaseAdmin
        .from('carritos_guardados')
        .update(update)
        .eq('user_id', c.user_id)
      enviados++
      porEtapa[etapa.clave] = (porEtapa[etapa.clave] ?? 0) + 1
    } catch (e: any) {
      console.error('[carrito-abandonado] error enviando a', email, e.message)
    }
  }

  // ── Checkouts abandonados: órdenes pendientes con email (invitados incl.) ──
  // Ventana 1h–72h, sin recordatorio previo, que no hayan comprado después.
  const ckDesde = new Date(ahora - 72 * 3600_000).toISOString()
  const ckHasta = new Date(ahora - MIN_HORAS * 3600_000).toISOString()

  const { data: pendientes } = await supabaseAdmin
    .from('ordenes')
    .select('id, items, datos_comprador, created_at')
    .eq('estado', 'pending')
    .is('recordatorio_carrito_at', null)
    .gt('created_at', ckDesde)
    .lt('created_at', ckHasta)
    .limit(BATCH)

  // Emails que ya concretaron una compra aprobada (para no molestarlos).
  const { data: aprobadas } = await supabaseAdmin
    .from('ordenes')
    .select('datos_comprador, created_at')
    .eq('estado', 'approved')
  const ultimaAprobada = new Map<string, string>()
  for (const o of aprobadas || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const em = (o.datos_comprador as any)?.email?.toLowerCase()
    if (!em) continue
    const prev = ultimaAprobada.get(em)
    if (!prev || o.created_at > prev) ultimaAprobada.set(em, o.created_at)
  }

  let enviadosCk = 0
  for (const o of pendientes || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const em = (o.datos_comprador as any)?.email?.toLowerCase()
    if (!em) continue
    const ultima = ultimaAprobada.get(em)
    if (ultima && ultima > o.created_at) continue // ya compró después
    const res = await enviarRecordatorioCheckout(o.id)
    if (res.ok) enviadosCk++
  }

  return NextResponse.json({
    candidatos: carritos?.length ?? 0,
    enviados,
    por_etapa: porEtapa,
    // Los que estaban en ventana pero ya habían comprado.
    salteados_por_compra: yaCompraron,
    checkouts_candidatos: pendientes?.length ?? 0,
    checkouts_enviados: enviadosCk,
  })
}
