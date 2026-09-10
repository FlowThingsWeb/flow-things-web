/**
 * Los eventos del embudo de compra, para las dos plataformas a la vez.
 *
 * Meta y GA4 miden lo mismo pero con nombres distintos —AddToCart contra
 * add_to_cart— y hasta ahora vivían separados: los componentes llamaban sólo
 * al pixel de Meta. Resultado: Meta mostraba 77 "agregar al carrito" y GA4 no
 * mostraba ninguno, así que no había forma de cruzar el embudo con el resto de
 * los datos de la sesión.
 *
 * Esta capa existe para que eso no vuelva a pasar. Los componentes importan de
 * acá y nunca de `fbpixel` ni de `ga4` directamente: agregar un evento nuevo
 * obliga a decidir qué manda a cada plataforma, en vez de acordarse de una y
 * olvidarse de la otra seis meses después.
 */
import { trackAddToCart, trackInitiateCheckout, trackViewContent } from './fbpixel'
import {
  gaAddToCart,
  gaBeginCheckout,
  gaRemoveFromCart,
  gaViewCart,
  gaViewItem,
  idGA4,
  type ItemGA4,
} from './ga4'

export type { ItemGA4 }

type ProductoEvento = {
  id: string
  sku?: string | null
  nombre: string
  precio: number
  cantidad?: number
}

/** Vio la ficha de un producto. */
export function verProducto(p: ProductoEvento) {
  trackViewContent(p)
  gaViewItem(p)
}

/** Agregó al carrito, desde donde sea: ficha, grilla, carrusel o el propio carrito. */
export function agregarAlCarrito(p: ProductoEvento) {
  trackAddToCart(p)
  gaAddToCart(p)
}

/**
 * Sacó algo del carrito.
 *
 * Sólo va a GA4: Meta no tiene un evento estándar equivalente, y uno
 * personalizado no sirve para optimizar campañas.
 */
export function quitarDelCarrito(p: ProductoEvento) {
  gaRemoveFromCart(p)
}

/**
 * Abrió el carrito.
 *
 * Sólo GA4, por lo mismo. Importa igual: es el paso donde aparece el costo de
 * envío, así que la caída entre este evento y el siguiente es la medida de
 * cuánta gente se va cuando ve cuánto sale mandarlo.
 */
export function verCarrito(d: { total: number; items: ItemGA4[] }) {
  gaViewCart(d)
}

/** Apretó "finalizar compra". */
export function empezarCheckout(d: { total: number; items: ItemGA4[] }) {
  trackInitiateCheckout({ value: d.total, numItems: d.items.reduce((s, i) => s + i.quantity, 0) })
  gaBeginCheckout(d)
}

/** Arma los items en el formato de GA4 a partir de las líneas del carrito. */
export function itemsDeCarrito(
  lineas: { id: string; sku?: string | null; nombre: string; precio: number; cantidad: number }[],
): ItemGA4[] {
  return lineas.map((l) => ({
    item_id: idGA4(l),
    item_name: l.nombre,
    price: l.precio,
    quantity: l.cantidad,
  }))
}
