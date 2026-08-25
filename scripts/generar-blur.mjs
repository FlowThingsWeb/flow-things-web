/**
 * Genera el mapa de placeholders difuminados de todas las imágenes.
 *
 * Mientras una imagen baja, la tarjeta queda en gris. Con `placeholder="blur"`
 * Next muestra en su lugar una versión minúscula y difusa, que ya viene dentro
 * del HTML: el visitante ve la forma y el color del producto desde el primer
 * frame.
 *
 * El blur de cada imagen es un webp de 12px en base64 (~200 bytes). Guardar uno
 * por fila en la DB obligaría a tocar el esquema, así que van todos juntos en
 * `derivadas/blur.json`, que el server lee una vez por hora (ver lib/blur.ts) y
 * del que cada página usa sólo los productos que muestra.
 *
 * La fuente es la derivada de 200px, que ya está en el bucket: no hace falta
 * bajar la imagen grande.
 *
 *   node scripts/generar-blur.mjs
 */
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const BUCKET = 'productos'
const CONCURRENCIA = 8
/** 12px de ancho: la imagen difusa no necesita más, y pesa ~200 bytes. */
const ANCHO_BLUR = 12

for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2].trim()
}
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const cabeceras = { apikey: KEY, Authorization: `Bearer ${KEY}` }

// ── Listar las derivadas de 200px ─────────────────────────────────────────
const bases = []
for (let off = 0; ; ) {
  const r = await fetch(`${URL_SB}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...cabeceras, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prefix: 'derivadas',
      limit: 1000,
      offset: off,
      sortBy: { column: 'name', order: 'asc' },
    }),
  })
  const j = await r.json()
  if (!Array.isArray(j) || j.length === 0) break
  for (const o of j) {
    const m = /^(.+)-200\.webp$/.exec(o.name)
    if (m) bases.push(m[1])
  }
  off += j.length
  if (j.length < 1000) break
}
console.log(`${bases.length} imágenes`)

// ── Generar el blur de cada una ───────────────────────────────────────────
const mapa = {}
let fallos = 0

for (let i = 0; i < bases.length; i += CONCURRENCIA) {
  await Promise.all(
    bases.slice(i, i + CONCURRENCIA).map(async (base) => {
      try {
        const r = await fetch(
          `${URL_SB}/storage/v1/object/public/${BUCKET}/derivadas/${base}-200.webp`
        )
        if (!r.ok) throw new Error(`bajar: ${r.status}`)
        const chico = await sharp(Buffer.from(await r.arrayBuffer()))
          .resize({ width: ANCHO_BLUR })
          .webp({ quality: 40 })
          .toBuffer()
        mapa[base] = `data:image/webp;base64,${chico.toString('base64')}`
      } catch (e) {
        fallos++
        console.error(`✗ ${base}: ${e.message}`)
      }
    })
  )
  if (i % 400 === 0) console.log(`  ${i}/${bases.length}…`)
}

const json = Buffer.from(JSON.stringify(mapa))
const pesos = Object.values(mapa).map(v => v.length)
console.log(
  `${Object.keys(mapa).length} blurs, ${fallos} con error. ` +
    `json: ${(json.length / 1024).toFixed(0)} KB, ` +
    `promedio por imagen: ${Math.round(pesos.reduce((a, b) => a + b, 0) / pesos.length)} bytes`
)

// ── Subir el mapa ─────────────────────────────────────────────────────────
const up = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/derivadas/blur.json`, {
  method: 'POST',
  headers: {
    ...cabeceras,
    'Content-Type': 'application/json',
    'x-upsert': 'true',
    // Corto: este archivo sí cambia cada vez que se sube una imagen nueva.
    'cache-control': 'public, max-age=300',
  },
  body: json,
})
console.log(up.ok ? 'blur.json subido' : `error al subir: ${up.status} ${await up.text()}`)
