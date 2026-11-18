/**
 * Feriados nacionales, en hora de Buenos Aires.
 *
 * Un feriado no es día hábil: el cadete no sale, así que un pedido hecho ese
 * día llega al siguiente hábil. Hay que extenderla cada año; el 31 de
 * diciembre del último año cargado el cálculo empieza a tratar feriados como
 * días comunes, que es el modo de fallar menos grave —promete una entrega que
 * después hay que correr un día, en vez de esconder dos días de ventas—.
 *
 * No hay forma de calcularlos: los trasladables y los puentes turísticos
 * salen por decreto. Y pedirlos a una API en el checkout sería colgar una
 * venta de que un tercero conteste.
 *
 * Vivía en `lib/franjas-entrega`, junto a las franjas horarias que el
 * comprador elegía en el carrito. Las franjas se sacaron —ahora la promesa es
 * "llega hoy si comprás antes de las 12, si no mañana", sin que el comprador
 * elija nada— pero los feriados siguen haciendo falta para calcular ese día,
 * así que se mudaron acá en vez de quedar colgados en un archivo cuyo nombre
 * ya no decía nada.
 *
 * La lista la comparten `lib/envio` —que cotiza— y `/api/envio/entrega` —que
 * promete en la ficha de producto—. Dos listas de feriados en el mismo repo se
 * separan sin que nadie se entere, y la forma en que se separan es la peor: la
 * ficha dice "Llega hoy" un día que no sale nadie.
 */
export const FERIADOS: string[] = [
  // 2026 — lo que queda del año
  "2026-10-12", // Diversidad Cultural
  "2026-11-23", // Soberanía Nacional (trasladado del viernes 20)
  "2026-12-07", // No laborable con fines turísticos
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25", // Navidad
  // 2027 — sólo el Año Nuevo, que es inamovible y no depende de ningún
  // decreto. Va cargado porque una compra del 30 o el 31 de diciembre
  // entrega en enero, y sin esto el sistema prometería el 1º.
  "2027-01-01", // Año Nuevo
];

