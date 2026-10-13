'use client'

/**
 * CartSync — sincroniza el carrito de Zustand con la tabla carritos_guardados de Supabase.
 *
 * Lógica:
 * - Al hacer login: carga el carrito guardado en DB y lo mergea con el local.
 * - Al cambiar items (debounced 1.5s): guarda en DB si el usuario está logueado.
 * - Al hacer logout: el carrito local queda, pero el de DB persiste para el próximo login.
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/lib/store'
import { ItemCarrito } from '@/types'
import { firmaCarrito, firmaOrden } from '@/lib/firma-carrito'

/**
 * Cuánto hacia atrás se mira una compra para dar el carrito por consumido.
 *
 * El carrito local sobrevive al pago: si el comprador no vuelve a /exito,
 * `clearCart()` nunca corre y el navegador sigue teniendo lo que ya pagó. Al
 * volver al sitio, eso se vuelve a guardar y reaparece como carrito colgado.
 *
 * La ventana existe para no romper la recompra: alguien que vuelve a los tres
 * días a comprar lo mismo tiene que poder armar ese carrito de nuevo. Una hora
 * cubre el rato entre que se paga y que el navegador se entera, que es el caso
 * real, sin pisar una intención nueva.
 */
const MINUTOS_COMPRA_RECIENTE = 60

export default function CartSync() {
  const { user } = useAuth()
  const { items, hidratado } = useCartStore()
  const prevUserIdRef = useRef<string | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLoadFromDb = useRef(false)
  /**
   * Firma de lo último que se sabe guardado en la DB.
   *
   * Sin esto, cada visita reescribía la fila aunque el carrito fuera idéntico:
   * `updated_at` saltaba a ahora y las tres etapas volvían a null, así que la
   * secuencia de recordatorios arrancaba de cero sin que el usuario hubiera
   * tocado nada. Guardar lo mismo no es un cambio.
   */
  const firmaGuardadaRef = useRef<string | null>(null)

  // Al hacer login, cargar carrito guardado y mergear
  useEffect(() => {
    // Hasta que el carrito del navegador no está cargado, el local se ve
    // vacío: mergear contra eso duplicaría lo que ya tiene el visitante.
    if (!hidratado) return

    const prevId = prevUserIdRef.current
    prevUserIdRef.current = user?.id ?? null

    if (!user || user.id === prevId) return

    // Nuevo login: cargar carrito de DB
    didLoadFromDb.current = false

    async function loadCart() {
      try {
        const { data } = await supabase
          .from('carritos_guardados')
          .select('items')
          .eq('user_id', user!.id)
          .maybeSingle()

        /**
         * ¿Lo que tiene el navegador es lo que se acaba de comprar?
         *
         * Si sí, se vacía en vez de mergear. Es el caso del que paga en el
         * celular y cierra la pestaña sin pasar por /exito: el servidor ya
         * borró la fila al aprobar la orden, pero el carrito local sigue
         * lleno y sin esto lo volvería a crear.
         */
        const desde = new Date(Date.now() - MINUTOS_COMPRA_RECIENTE * 60_000).toISOString()
        const { data: compras } = await supabase
          .from('ordenes')
          .select('items')
          .eq('user_id', user!.id)
          .eq('estado', 'approved')
          .gt('created_at', desde)

        const localAhora = useCartStore.getState().items
        const firmaLocal = firmaCarrito(localAhora)
        if (
          firmaLocal &&
          (compras || []).some((o) => firmaOrden(o.items) === firmaLocal)
        ) {
          useCartStore.setState({ items: [] })
          firmaGuardadaRef.current = ''
          return
        }

        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
          // Mergear con el carrito local (el local tiene prioridad para cantidades).
          // Un solo setState en vez de N addItem: evita N re-renders/escrituras y
          // no fuerza abrir el carrito al iniciar sesión.
          const localItems = useCartStore.getState().items
          const localIds = new Set(
            localItems.map(i => `${i.producto.id}::${i.varianteId ?? ''}`)
          )
          const nuevos = (data.items as ItemCarrito[]).filter(item => {
            const key = `${item.producto.id}::${item.varianteId ?? ''}`
            return item?.producto?.id && !localIds.has(key)
          })
          if (nuevos.length > 0) {
            useCartStore.setState({ items: [...localItems, ...nuevos] })
          }
        }
        // Lo que quedó en la DB después del merge. Si el merge no agregó nada,
        // el efecto de guardado va a ver la misma firma y no va a escribir.
        firmaGuardadaRef.current = firmaCarrito(data?.items ?? [])
      } catch {
        // silenciar errores de red
      } finally {
        didLoadFromDb.current = true
      }
    }

    loadCart()
  }, [user, hidratado])

  // Al cambiar items, guardar en DB (debounced)
  useEffect(() => {
    // Sin el carrito cargado, `items` está vacío y el upsert borraría el
    // carrito guardado del usuario.
    if (!user || !hidratado || !didLoadFromDb.current) return

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)

    syncTimerRef.current = setTimeout(async () => {
      try {
        const firma = firmaCarrito(items)
        // Nada cambió desde la última vez que se guardó: no se toca la fila.
        // Reescribirla movería `updated_at` y reiniciaría los recordatorios
        // por una visita en la que el usuario no agregó ni sacó nada.
        if (firma === firmaGuardadaRef.current) return

        /**
         * Carrito vacío: se borra la fila, no se guarda un array vacío.
         *
         * Vaciar el carrito dejaba una fila con `items: []` para siempre. No
         * rompía nada —el cron las saltea— pero llenaban el panel de carritos
         * abandonados del admin con gente que no tiene nada abandonado: seis
         * de diez filas eran eso.
         */
        if (items.length === 0) {
          await supabase.from('carritos_guardados').delete().eq('user_id', user.id)
          firmaGuardadaRef.current = ''
          return
        }

        await supabase
          .from('carritos_guardados')
          // Tocar el carrito reinicia la secuencia entera de recordatorios: el
          // reloj de las 2 horas, el del día y el de la semana arrancan de
          // nuevo desde este momento. Si sólo se limpiara la primera etapa, a
          // alguien que vuelve a agregar algo le llegaría el mail de la semana
          // por un carrito que acaba de tocar.
          .upsert({
            user_id: user.id,
            items,
            updated_at: new Date().toISOString(),
            recordatorio_enviado: null,
            recordatorio_2h_at: null,
            recordatorio_24h_at: null,
            recordatorio_7d_at: null,
          })
        firmaGuardadaRef.current = firma
      } catch {
        // silenciar errores de red
      }
    }, 1500)

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [user, items, hidratado])

  return null
}
