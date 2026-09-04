function fmt(n: number) {
  return n.toLocaleString('es-AR')
}

/**
 * La barra de arriba de todo: una tarifa, un umbral, unas cuotas.
 *
 * Antes decía tres umbrales distintos —CABA, AMBA e interior— porque la tienda
 * cobraba tres tarifas. Ahora el envío cuesta lo mismo a cualquier punto del
 * país y es gratis desde un solo monto, así que el mensaje entra en una línea
 * y no hay que buscarse en un listado de zonas.
 */
export default function AnnouncementBar({
  envio = 15000,
  gratisDesde = 61000,
  cuotas = 3,
}: {
  /** Lo que cuesta el envío a cualquier punto del país. */
  envio?: number
  /** Monto desde el que el envío es gratis. */
  gratisDesde?: number
  /** Cuotas sin interés vigentes. */
  cuotas?: number
}) {
  return (
    <div className="w-full bg-brand-purple text-white text-xs font-medium py-2 px-4 text-center">
      <span className="inline-block">
        🚚 <span className="font-bold">Envío ${fmt(envio)}</span> a todo el país
        {gratisDesde > 0 && <> · <span className="font-bold">Gratis desde ${fmt(gratisDesde)}</span></>}
      </span>
      {cuotas > 0 && (
        <span className="inline-block"> · 💳 <span className="font-bold">{cuotas} cuotas sin interés</span></span>
      )}
    </div>
  )
}
