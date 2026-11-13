import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recalcularStockPacks } from '@/lib/packs'

/**
 * Los packs: de qué está hecho cada uno.
 *
 * El precio y la ficha del pack se editan donde se edita cualquier producto,
 * porque un pack ES un producto. Acá sólo se decide qué trae adentro, que es
 * lo único que un pack tiene de distinto.
 *
 * El stock no se toca a mano en ningún caso: se recalcula al guardar, porque
 * es una cuenta sobre el stock de los componentes.
 */

export const runtime = 'nodejs'

type ComponenteEntrada = { sku?: string; cantidad?: number }

export async function GET(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  const [{ data: items, error: errItems }, { data: productos, error: errProd }] =
    await Promise.all([
      supabaseAdmin
        .from('items_pack')
        .select(
          'pack_id, componente_id, cantidad, precio_lista, componente:productos!items_pack_componente_id_fkey(sku, nombre, stock, precio)',
        ),
      supabaseAdmin
        .from('productos')
        .select('id, sku, nombre, precio, stock, activo')
        .order('nombre'),
    ])

  if (errItems) {
    return NextResponse.json({ error: errItems.message }, { status: 500 })
  }
  if (errProd) {
    return NextResponse.json({ error: errProd.message }, { status: 500 })
  }

  type Fila = {
    pack_id: string
    componente_id: string
    cantidad: number
    precio_lista: number
    componente: { sku: string; nombre: string; stock: number; precio: number } | null
  }

  const porPack = new Map<string, Fila[]>()
  for (const f of (items ?? []) as unknown as Fila[]) {
    porPack.set(f.pack_id, [...(porPack.get(f.pack_id) ?? []), f])
  }

  const porId = new Map((productos ?? []).map((p) => [p.id as string, p]))

  const packs = [...porPack.entries()].map(([packId, filas]) => {
    const prod = porId.get(packId)
    return {
      id: packId,
      sku: prod?.sku ?? '—',
      nombre: prod?.nombre ?? '(producto borrado)',
      precio: Number(prod?.precio ?? 0),
      stock: Number(prod?.stock ?? 0),
      activo: Boolean(prod?.activo),
      componentes: filas.map((f) => ({
        sku: f.componente?.sku ?? '—',
        nombre: f.componente?.nombre ?? '—',
        cantidad: Number(f.cantidad) || 1,
        precio_lista: Number(f.precio_lista) || 0,
        precio_hoy: Number(f.componente?.precio ?? 0),
        stock: Number(f.componente?.stock ?? 0),
      })),
    }
  })

  packs.sort((a, b) => a.nombre.localeCompare(b.nombre))

  return NextResponse.json({
    packs,
    productos: (productos ?? []).map((p) => ({
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      precio: Number(p.precio ?? 0),
      stock: Number(p.stock ?? 0),
    })),
  })
}

/**
 * Guarda la composición de un pack: reemplaza la lista entera.
 *
 * Reemplazar y no ir fila por fila porque la pantalla edita la lista
 * completa: un borrado que no llegara dejaría un componente fantasma
 * descontando stock en cada venta.
 *
 * `precio_lista` se congela con el precio que el componente tiene HOY, que
 * es la definición: el reparto de una venta vieja no se mueve porque mañana
 * cambie un precio. Para refrescarlo, se vuelve a guardar el pack.
 */
export async function POST(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  let body: { pack_id?: string; componentes?: ComponenteEntrada[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const packId = String(body.pack_id ?? '').trim()
  if (!packId) {
    return NextResponse.json({ error: 'Falta el pack.' }, { status: 400 })
  }

  const entradas = (body.componentes ?? []).filter((c) => c?.sku)
  if (entradas.length === 0) {
    return NextResponse.json(
      { error: 'Un pack sin componentes no se puede vender: no habría cómo descontar stock.' },
      { status: 400 },
    )
  }

  const { data: pack } = await supabaseAdmin
    .from('productos')
    .select('id, sku, nombre')
    .eq('id', packId)
    .maybeSingle()
  if (!pack) {
    return NextResponse.json({ error: 'El producto no existe.' }, { status: 404 })
  }

  const skus = [...new Set(entradas.map((c) => String(c.sku).trim()))]
  const { data: comps } = await supabaseAdmin
    .from('productos')
    .select('id, sku, precio')
    .in('sku', skus)

  const porSku = new Map((comps ?? []).map((c) => [c.sku as string, c]))
  const faltan = skus.filter((s) => !porSku.has(s))
  if (faltan.length > 0) {
    return NextResponse.json(
      { error: `No existe ningún producto con el SKU ${faltan.join(', ')}.` },
      { status: 400 },
    )
  }
  if (porSku.get(pack.sku as string)?.id === packId && skus.includes(pack.sku as string)) {
    return NextResponse.json(
      { error: 'Un pack no puede contenerse a sí mismo.' },
      { status: 400 },
    )
  }

  const filas = entradas.map((c) => {
    const comp = porSku.get(String(c.sku).trim())!
    const cantidad = Math.max(1, Math.trunc(Number(c.cantidad) || 1))
    return {
      pack_id: packId,
      componente_id: comp.id as string,
      cantidad,
      precio_lista: Number(comp.precio ?? 0),
    }
  })

  const { error: errDel } = await supabaseAdmin
    .from('items_pack')
    .delete()
    .eq('pack_id', packId)
  if (errDel) {
    return NextResponse.json({ error: errDel.message }, { status: 500 })
  }

  const { error: errIns } = await supabaseAdmin.from('items_pack').insert(filas)
  if (errIns) {
    return NextResponse.json({ error: errIns.message }, { status: 500 })
  }

  let stock: number | null = null
  try {
    const cambios = await recalcularStockPacks()
    stock = cambios.find((c) => c.sku === pack.sku)?.a ?? null
  } catch (err) {
    console.error('[admin/packs] no se pudo recalcular el stock:', err)
  }
  revalidateTag('catalogo')

  return NextResponse.json({ ok: true, componentes: filas.length, stock })
}

/** Deja de ser un pack. El producto sigue existiendo; pierde su composición. */
export async function DELETE(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  const packId = String(new URL(request.url).searchParams.get('pack_id') ?? '').trim()
  if (!packId) {
    return NextResponse.json({ error: 'Falta el pack.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('items_pack').delete().eq('pack_id', packId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidateTag('catalogo')
  return NextResponse.json({ ok: true })
}
