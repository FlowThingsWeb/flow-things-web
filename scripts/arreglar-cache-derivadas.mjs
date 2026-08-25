/**
 * Re-sube las derivadas ya existentes con el header de cache correcto.
 *
 * El backfill original las subió sin `cache-control`, y ahí Supabase Storage
 * responde `no-cache`: el CDN devolvía MISS siempre y el browser volvía a
 * pedir cada imagen en cada visita, así que la grilla tardaba al scrollear.
 * Las derivadas son inmutables (el nombre lleva timestamp y ancho), así que
 * van con un año.
 *
 * Solo cambia la cabecera: baja el archivo y lo vuelve a subir tal cual, sin
 * re-comprimir. Es idempotente — las que ya tienen el header se saltean.
 *
 *   node scripts/arreglar-cache-derivadas.mjs
 */
import { readFileSync } from 'node:fs'

const BUCKET = 'productos'
const CACHE = 'public, max-age=31536000, immutable'
const CONCURRENCIA = 3

for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2].trim()
}
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const cabeceras = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const publico = (path) => `${URL_SB}/storage/v1/object/public/${BUCKET}/${path}`

async function conReintento(fn, intentos = 4) {
  let ultimo
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn()
    } catch (e) {
      ultimo = e
      if (!String(e.message).includes('429')) throw e
      await new Promise(r => setTimeout(r, 1000 * 2 ** i))
    }
  }
  throw ultimo
}

// ── Listar todas las derivadas ────────────────────────────────────────────
const archivos = []
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
  archivos.push(...j.map(o => `derivadas/${o.name}`))
  off += j.length
  if (j.length < 1000) break
}
console.log(`${archivos.length} derivadas en el bucket`)

// ── Re-subir las que no tengan cache largo ────────────────────────────────
let arregladas = 0, saltadas = 0, fallos = 0

for (let i = 0; i < archivos.length; i += CONCURRENCIA) {
  await Promise.all(
    archivos.slice(i, i + CONCURRENCIA).map(async (path) => {
      try {
        const r = await conReintento(async () => {
          const res = await fetch(publico(path))
          if (!res.ok) throw new Error(`bajar ${path}: ${res.status}`)
          return res
        })
        if ((r.headers.get('cache-control') ?? '').includes('max-age=31536000')) {
          saltadas++
          return
        }
        const bytes = Buffer.from(await r.arrayBuffer())
        await conReintento(async () => {
          const up = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${path}`, {
            method: 'POST',
            headers: {
              ...cabeceras,
              'Content-Type': 'image/webp',
              'x-upsert': 'true',
              'cache-control': CACHE,
            },
            body: bytes,
          })
          if (!up.ok) throw new Error(`subir ${path}: ${up.status} ${await up.text()}`)
        })
        arregladas++
      } catch (e) {
        fallos++
        console.error(`✗ ${path}: ${e.message}`)
      }
    })
  )
  if (i % 300 === 0) console.log(`  ${i}/${archivos.length}…`)
}

console.log(`${arregladas} arregladas, ${saltadas} ya estaban, ${fallos} con error`)
