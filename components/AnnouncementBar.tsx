function fmt(n: number) {
  return n.toLocaleString('es-AR')
}

/**
 * La barra de arriba de todo: el envío gratis y las cuotas.
 *
 * Antes decía tres umbrales distintos —CABA, AMBA e interior— porque la tienda
 * cobraba tres tarifas. Ahora es un solo monto para todo el país y el mensaje
 * entra en una línea.
 *
 * No dice cuánto sale el envío por debajo del umbral a propósito: acá el
 * mensaje es el beneficio, y el costo lo muestra el checkout cuando el
 * comprador pone su dirección, que es cuando el número es real.
 */
export default function AnnouncementBar({
  gratisDesde = 61000,
  cuotas = 3,
}: {
  /** Monto desde el que el envío es gratis. */
  gratisDesde?: number
  /** Cuotas sin interés vigentes. */
  cuotas?: number
}) {
  return (
    <div className="w-full bg-brand-purple text-white text-xs font-medium py-2 px-4 text-center">
      {gratisDesde > 0 && (
        <span className="inline-block">
          🚚 <span className="font-bold">Envío gratis a todo el país</span> desde ${fmt(gratisDesde)}
        </span>
      )}
      {cuotas > 0 && (
        <span className="inline-block"> · 💳 <span className="font-bold">{cuotas} cuotas sin interés</span></span>
      )}
    </div>
  )
}
