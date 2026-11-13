'use client'

/**
 * Packs: de qué está hecho cada pack.
 *
 * Un pack es un producto más —tiene SKU, precio, ficha y fotos, y se edita en
 * Productos como cualquier otro—. Lo único que tiene de distinto es que por
 * dentro son varios productos, y eso se decide acá.
 *
 * El stock no se edita en ninguna parte: es una cuenta. Hay tantos packs como
 * cajas permita armar el componente más escaso, y se recalcula al guardar y
 * cada vez que el CRM manda stock.
 */

import { useEffect, useState } from 'react'

type Componente = {
  sku: string
  nombre: string
  cantidad: number
  precio_lista: number
  precio_hoy: number
  stock: number
}

type Pack = {
  id: string
  sku: string
  nombre: string
  precio: number
  stock: number
  activo: boolean
  componentes: Componente[]
}

type ProductoOpt = {
  id: string
  sku: string
  nombre: string
  precio: number
  stock: number
}

const money = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')

/** Cuántos packs permite armar el componente más escaso. */
function armables(comps: { cantidad: number; stock: number }[]): number {
  if (comps.length === 0) return 0
  return Math.max(
    0,
    Math.min(...comps.map((c) => Math.floor(c.stock / Math.max(1, c.cantidad)))),
  )
}

export default function PacksAdminPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [productos, setProductos] = useState<ProductoOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [nuevoPackId, setNuevoPackId] = useState('')

  async function cargar() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/packs')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'No se pudo cargar.')
      setPacks(d.packs ?? [])
      setProductos(d.productos ?? [])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function editar(packId: string, cambio: (c: Componente[]) => Componente[]) {
    setPacks((prev) =>
      prev.map((p) => (p.id === packId ? { ...p, componentes: cambio(p.componentes) } : p)),
    )
  }

  async function guardar(pack: Pack) {
    setGuardando(pack.id)
    setError('')
    setAviso('')
    try {
      const r = await fetch('/api/admin/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_id: pack.id,
          componentes: pack.componentes.map((c) => ({ sku: c.sku, cantidad: c.cantidad })),
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'No se pudo guardar.')
      setAviso(
        `${pack.nombre}: ${d.componentes} componentes guardados` +
          (d.stock != null ? ` · stock recalculado a ${d.stock}` : ''),
      )
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(null)
    }
  }

  async function dejarDeSerPack(pack: Pack) {
    if (
      !confirm(
        `"${pack.nombre}" deja de ser un pack.\n\n` +
          'El producto sigue existiendo, pero al venderse no se va a descontar ' +
          'el stock de sus componentes y su stock pasa a cargarse a mano.',
      )
    ) {
      return
    }
    setGuardando(pack.id)
    try {
      const r = await fetch(`/api/admin/packs?pack_id=${pack.id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'No se pudo borrar.')
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.')
    } finally {
      setGuardando(null)
    }
  }

  function convertirEnPack() {
    const prod = productos.find((p) => p.id === nuevoPackId)
    if (!prod) return
    if (packs.some((p) => p.id === prod.id)) return
    setPacks((prev) => [
      {
        id: prod.id,
        sku: prod.sku,
        nombre: prod.nombre,
        precio: prod.precio,
        stock: prod.stock,
        activo: true,
        componentes: [],
      },
      ...prev,
    ])
    setNuevoPackId('')
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Packs</h1>
        <p className="text-brand-text-muted mt-1 text-sm">
          Un pack es un producto que por dentro son varios. Su precio, su ficha y sus
          fotos se editan en <strong className="text-brand-text">Productos</strong>, como
          cualquier otro; acá se decide sólo qué trae adentro.
        </p>
        <p className="text-brand-text-muted mt-2 text-xs">
          El stock no se carga: hay tantos packs como cajas permita armar el componente
          más escaso. Se recalcula al guardar y cada vez que el CRM manda stock. Al
          venderse, la venta viaja al CRM abierta en sus componentes, así que el stock y
          el costo siguen saliendo producto por producto.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {aviso && (
        <p className="mb-4 rounded-xl border border-brand-neon/40 bg-brand-neon/10 p-3 text-sm text-brand-neon">
          {aviso}
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-brand-border bg-brand-bg-card p-4">
        <div className="min-w-[260px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-brand-text-muted">
            Convertir un producto en pack
          </label>
          <select
            value={nuevoPackId}
            onChange={(e) => setNuevoPackId(e.target.value)}
            className="input-dark w-full"
          >
            <option value="">Elegí el producto que se vende como pack…</option>
            {productos
              .filter((p) => !packs.some((k) => k.id === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.nombre}
                </option>
              ))}
          </select>
        </div>
        <button
          onClick={convertirEnPack}
          disabled={!nuevoPackId}
          className="rounded-xl bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Agregar
        </button>
      </div>

      {packs.length === 0 && (
        <p className="rounded-2xl border border-dashed border-brand-border p-6 text-center text-sm text-brand-text-muted">
          No hay packs todavía.
        </p>
      )}

      <div className="space-y-4">
        {packs.map((pack) => {
          const stockCalculado = armables(pack.componentes)
          return (
            <div
              key={pack.id}
              className="rounded-2xl border border-brand-border bg-brand-bg-card p-5"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">{pack.nombre}</h2>
                  <p className="text-xs text-brand-text-muted">
                    {pack.sku} · {money(pack.precio)} ·{' '}
                    {pack.activo ? 'publicado' : 'despublicado'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-brand-text-muted">Stock</p>
                  <p className="text-lg font-bold text-white">{stockCalculado}</p>
                  {stockCalculado !== pack.stock && (
                    <p className="text-[11px] text-amber-400">
                      guardado: {pack.stock} — guardá para actualizarlo
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {pack.componentes.map((c, i) => (
                  <div
                    key={`${c.sku}-${i}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-border bg-brand-bg-soft p-2"
                  >
                    <input
                      type="number"
                      min="1"
                      value={c.cantidad}
                      onChange={(e) =>
                        editar(pack.id, (comps) =>
                          comps.map((x, j) =>
                            j === i
                              ? { ...x, cantidad: Math.max(1, Number(e.target.value) || 1) }
                              : x,
                          ),
                        )
                      }
                      className="input-dark w-16 text-center"
                    />
                    <span className="min-w-[90px] font-mono text-xs text-brand-text-muted">
                      {c.sku}
                    </span>
                    <span className="flex-1 text-sm text-brand-text">{c.nombre}</span>
                    <span className="text-xs text-brand-text-muted">
                      stock {c.stock} · lista {money(c.precio_lista)}
                      {Math.round(c.precio_hoy) !== Math.round(c.precio_lista) && (
                        <span className="text-amber-400"> (hoy {money(c.precio_hoy)})</span>
                      )}
                    </span>
                    <button
                      onClick={() =>
                        editar(pack.id, (comps) => comps.filter((_, j) => j !== i))
                      }
                      className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-900/30"
                    >
                      Quitar
                    </button>
                  </div>
                ))}

                <select
                  value=""
                  onChange={(e) => {
                    const prod = productos.find((p) => p.id === e.target.value)
                    if (!prod) return
                    editar(pack.id, (comps) =>
                      comps.some((c) => c.sku === prod.sku)
                        ? comps
                        : [
                            ...comps,
                            {
                              sku: prod.sku,
                              nombre: prod.nombre,
                              cantidad: 1,
                              precio_lista: prod.precio,
                              precio_hoy: prod.precio,
                              stock: prod.stock,
                            },
                          ],
                    )
                  }}
                  className="input-dark w-full"
                >
                  <option value="">+ Agregar un producto al pack…</option>
                  {productos
                    .filter((p) => p.id !== pack.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.nombre} (stock {p.stock})
                      </option>
                    ))}
                </select>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => guardar(pack)}
                  disabled={guardando === pack.id || pack.componentes.length === 0}
                  className="rounded-xl bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {guardando === pack.id ? 'Guardando…' : 'Guardar composición'}
                </button>
                <button
                  onClick={() => dejarDeSerPack(pack)}
                  disabled={guardando === pack.id}
                  className="rounded-xl border border-brand-border px-4 py-2.5 text-sm text-brand-text-muted hover:text-white disabled:opacity-40"
                >
                  Dejar de ser pack
                </button>
                {/*
                  Guardar congela el precio de lista de cada componente con el
                  precio de hoy: es lo que se usa para repartir el precio del
                  pack entre sus partes cuando la venta viaja al CRM.
                */}
                <span className="text-[11px] text-brand-text-muted">
                  Al guardar se congela el precio de lista de cada componente.
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
