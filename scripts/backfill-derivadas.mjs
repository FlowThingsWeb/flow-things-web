/**
 * Migra las imágenes existentes al esquema de derivadas propias.
 *
 * Para cada imagen referenciada en la DB genera `derivadas/<base>-200.webp`,
 * `-640` y `-1280`, y apunta la fila al master de 1280. A partir de ahí el
 * loader de Next (lib/image-loader.ts) sirve la derivada que corresponde y el
 * optimizador de Vercel no se usa nunca más.
 *
 * Es idempotente y se puede cortar y retomar: lo que ya apunta a /derivadas/
 * se saltea, y lo que ya está subido no se vuelve a generar.
 *
 *   node scripts/backfill-derivadas.mjs --dry            # solo informa
 *   node scripts/backfill-derivadas.mjs --limite 20      # prueba con 20
 *   node scripts/backfill-derivadas.mjs                  # todo
 *
 * No borra los originales. Para eso está --borrar-originales, que conviene
 * correr recién cuando la web ya se ve bien con las derivadas (las órdenes
 * viejas guardan la URL de la imagen tal como estaba al momento de la compra).
 */
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const ANCHOS = [200, 640, 1280]
const MASTER = ANCHOS[ANCHOS.length - 1]
const BUCKET = 'productos'
const CALIDAD = 80
/**
 * Un año e immutable. El nombre de una derivada lleva timestamp y ancho, así
 * que su contenido nunca cambia. Sin este header, Storage responde `no-cache`:
 * el CDN no la guarda y el browser la vuelve a pedir en cada visita.
 */
const CACHE_DERIVADAS = 'public, max-age=31536000, immutable'

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const BORRAR = args.includes('--borrar-originales')
const LIMITE = (() => {
  const i = args.indexOf('--limite')
  return i >= 0 ? Number(args[i + 1]) : Infinity
})()

// ── Credenciales ──────────────────────────────────────────────────────────
for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2].trim()
}
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_SB || !KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}
const cabeceras = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const rest = async (path, init = {}) => {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, {
    ...init,
    headers: { ...cabeceras, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`)
  return r.status === 204 ? null : r.json()
}

const PREFIJO_PUBLICO = `${URL_SB}/storage/v1/object/public/`

/** Una URL es migrable si vive en nuestro storage y no es ya una derivada. */
function migrable(url) {
  return (
    typeof url === 'string' &&
    url.startsWith(PREFIJO_PUBLICO) &&
    !url.includes('/derivadas/') &&
    !url.toLowerCase().endsWith('.gif') // los gif animados van tal cual
  )
}

/** `.../public/productos/productos/1785-abc.webp` → `1785-abc` */
function baseDe(url) {
  const archivo = decodeURIComponent(url.split('/').pop())
  return archivo.replace(/\.[^.]+$/, '')
}

const urlDerivada = (base, ancho) =>
  `${PREFIJO_PUBLICO}${BUCKET}/derivadas/${base}-${ancho}.webp`

/**
 * fetch con reintentos. Supabase corta con 429 `too_many_connections` cuando
 * se le va la mano con el paralelismo; esperar y volver a intentar alcanza.
 */
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

async function existe(url) {
  const r = await fetch(url, { method: 'HEAD' })
  return r.ok
}

async function subir(path, buffer) {
  await conReintento(async () => {
    const r = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        ...cabeceras,
        'Content-Type': 'image/webp',
        'x-upsert': 'true',
        // Ver CACHE_DERIVADAS: sin esto Storage sirve `no-cache`.
        'cache-control': CACHE_DERIVADAS,
      },
      body: buffer,
    })
    if (!r.ok) throw new Error(`subir ${path}: ${r.status} ${await r.text()}`)
  })
}

/** Genera y sube las 3 derivadas. Devuelve la URL del master. */
async function derivar(url) {
  const base = baseDe(url)

  // Si el master ya está, esta imagen ya se procesó en una corrida anterior.
  if (await existe(urlDerivada(base, MASTER))) return urlDerivada(base, MASTER)

  const original = await conReintento(async () => {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`bajar ${url}: ${r.status}`)
    return Buffer.from(await r.arrayBuffer())
  })
  const { width = MASTER } = await sharp(original).metadata()

  let bytes = 0
  for (const ancho of ANCHOS) {
    const pipe = sharp(original).rotate()
    if (width > ancho) pipe.resize({ width: ancho })
    const salida = await pipe.webp({ quality: CALIDAD }).toBuffer()
    bytes += salida.length
    await subir(`derivadas/${base}-${ancho}.webp`, salida)
  }

  return { url: urlDerivada(base, MASTER), bytes, antes: original.length }
}

async function borrarOriginal(url) {
  const path = url.slice(PREFIJO_PUBLICO.length + BUCKET.length + 1)
  const r = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'DELETE',
    headers: cabeceras,
  })
  if (!r.ok) console.warn(`  ⚠ no se pudo borrar ${path}: ${r.status}`)
}

// ── Recolectar todo lo que hay que migrar ─────────────────────────────────
const productos = await rest('productos?select=id,imagen_url,imagenes')
const variantes = await rest('variantes?select=id,imagen_url,imagenes')
const config = await rest('configuracion?select=clave,valor&tipo=eq.image')

const pendientes = new Set()
const juntar = (fila) => {
  for (const u of [fila.imagen_url, ...(Array.isArray(fila.imagenes) ? fila.imagenes : [])]) {
    if (migrable(u)) pendientes.add(u)
  }
}
productos.forEach(juntar)
variantes.forEach(juntar)
config.forEach(c => { if (migrable(c.valor)) pendientes.add(c.valor) })

const lista = [...pendientes].slice(0, LIMITE)
console.log(
  `${pendientes.size} imágenes por migrar` +
    (LIMITE < Infinity ? ` (se procesan ${lista.length})` : '') +
    (DRY ? ' — modo --dry, no se toca nada' : '')
)
if (DRY) process.exit(0)

// ── Generar derivadas ─────────────────────────────────────────────────────
const mapa = new Map() // url vieja → url nueva
let bytesAntes = 0, bytesDespues = 0, fallos = 0

// En paralelo, pero poquito: una por una tardaba ~3s cada una (bajar + 3
// encodes + 3 subidas), y con 5 en paralelo Supabase empezaba a cortar con
// 429 `too_many_connections`.
const CONCURRENCIA = 3
let hechas = 0

for (let i = 0; i < lista.length; i += CONCURRENCIA) {
  await Promise.all(
    lista.slice(i, i + CONCURRENCIA).map(async (url) => {
      try {
        const res = await derivar(url)
        if (typeof res === 'string') {
          mapa.set(url, res)
        } else {
          mapa.set(url, res.url)
          bytesAntes += res.antes
          bytesDespues += res.bytes
        }
      } catch (e) {
        fallos++
        console.error(`✗ ${url}\n  ${e.message}`)
      }
      hechas++
    })
  )
  if (i % 50 === 0) console.log(`  ${hechas}/${lista.length}…`)
}

console.log(
  `derivadas listas: ${mapa.size} ok, ${fallos} con error. ` +
    `${(bytesAntes / 1048576).toFixed(0)} MB de originales → ` +
    `${(bytesDespues / 1048576).toFixed(0)} MB en derivadas`
)

// ── Apuntar la DB a las derivadas ─────────────────────────────────────────
const nueva = (u) => mapa.get(u) ?? u
let filas = 0

for (const [tabla, datos] of [['productos', productos], ['variantes', variantes]]) {
  for (const fila of datos) {
    const imagenes = Array.isArray(fila.imagenes) ? fila.imagenes.map(nueva) : fila.imagenes
    const imagen_url = fila.imagen_url ? nueva(fila.imagen_url) : fila.imagen_url
    const cambio =
      imagen_url !== fila.imagen_url ||
      JSON.stringify(imagenes) !== JSON.stringify(fila.imagenes)
    if (!cambio) continue

    await rest(`${tabla}?id=eq.${fila.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ imagen_url, imagenes }),
    })
    filas++
  }
}

for (const c of config) {
  if (nueva(c.valor) === c.valor) continue
  await rest(`configuracion?clave=eq.${c.clave}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ valor: nueva(c.valor) }),
  })
  filas++
}

console.log(`${filas} filas actualizadas`)

if (BORRAR) {
  for (const url of mapa.keys()) await borrarOriginal(url)
  console.log(`${mapa.size} originales borrados`)
}
