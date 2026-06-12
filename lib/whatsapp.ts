// WhatsApp via Evolution API (self-hosted, open source)
// Repo: https://github.com/EvolutionAPI/evolution-api
// Se instala en cualquier VPS en ~10 minutos con Docker.
// Variables necesarias:
//   EVOLUTION_API_URL  → ej: https://evo.tudominio.com
//   EVOLUTION_API_KEY  → la apikey configurada en tu instancia
//   EVOLUTION_INSTANCE → nombre de la instancia (ej: "flowthings")

export async function sendWhatsApp(params: {
  to: string    // número con código de país sin +, ej: "5491112345678"
  mensaje: string
}): Promise<void> {
  const url      = process.env.EVOLUTION_API_URL
  const apikey   = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE

  if (!url || !apikey || !instance) {
    console.warn('[whatsapp] Variables EVOLUTION_API_* no configuradas')
    return
  }

  // Limpiar número: solo dígitos
  const numero = params.to.replace(/\D/g, '')

  const res = await fetch(`${url}/message/sendText/${instance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apikey,
    },
    body: JSON.stringify({
      number: numero,
      text: params.mensaje,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Evolution API error ${res.status}: ${err.slice(0, 200)}`)
  }
}

export const DEFAULT_WPP_MENSAJE = `Hola {{nombre}} 👋

Tu pedido en *Flow Things* fue confirmado ✅

🧾 *Orden #{{orden_id}}*
💰 Total: {{total}}
📅 Fecha: {{fecha}}

📦 *Productos:*
{{productos}}

Te avisaremos cuando tu pedido sea despachado 🚚
¡Gracias por elegirnos! 🎉

_Flow Things · flowthings.com.ar_`
