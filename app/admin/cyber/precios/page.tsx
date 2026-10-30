'use client'

/**
 * Los precios del Cyber, en dos pasos y con vuelta atrás.
 *
 * Paso 1 sube el precio de lista. Paso 2 aplica el descuento sobre ese
 * precio y prende el tachado. "Restaurar" devuelve todo al número con el que
 * arrancó, que quedó guardado antes de tocar nada.
 *
 * La pantalla muestra el margen que deja cada precio y no deja aplicar lo que
 * no llega al piso. Esa cuenta se repite en el servidor antes de escribir: lo
 * que se ve acá puede estar viejo, y el costo del proveedor cambia solo.
 */

import { useState, useEffect, useCallback } from 'react'
import type { FilaCyber, ConfigCyber } from '@/lib/cyber-precios'

const money = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')
const pct = (n: number | null) => (n == null ? '—' : (n * 100).toFixed(1) + '%')

interface Respuesta {
  cfg: ConfigCyber
  factores: { inflar: number; descuento: number }
  error_crm: string | null
  estado: { inflados: number; aplicados: number }
  filas: FilaCyber[]
}

export default function CyberPreciosPage() {
  const [data, setData] = useState<Respuesta | null>(null)
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [inflar, setInflar] = useState('15')
  const [descuento, setDescuento] = useState('20')
  const [cuidarEnvio, setCuidarEnvio] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const qs = new URLSearchParams({
        inflar: String(1 + Number(inflar) / 100),
        descuento: String(Number(descuento) / 100),
        cuidar_envio_gratis: String(cuidarEnvio),
      })
      const r = await fetch(`/api/admin/cyber/precios?${qs}`)
      if (!r.ok) throw new Error()
      const d: Respuesta = await r.json()
      setData(d)
      /**
       * Vienen tildados los que aguantan y destildados los que no. Es la
       * diferencia entre una pantalla que te ayuda y una que te hace revisar
       * 161 casillas para encontrar las cinco que importan.
       */
      setElegidos(
        new Set(d.filas.filter((f) => !f.bajo_piso && !f.sin_descuento_real).map((f) => f.id)),
      )
    } catch {
      setError('No se pudo leer la lista de precios.')
    } finally {
      setCargando(false)
    }
  }, [inflar, descuento, cuidarEnvio])

  useEffect(() => {
    cargar()
  }, [cargar])

  const toggle = (id: string) =>
    setElegidos((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  const correr = async (accion: 'inflar' | 'aplicar' | 'restaurar', confirmacion: string) => {
    if (!confirm(confirmacion)) return
    setTrabajando(true)
    setError('')
    setAviso('')
    try {
      const r = await fetch('/api/admin/cyber/precios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          ids: [...elegidos],
          inflar: 1 + Number(inflar) / 100,
          descuento: Number(descuento) / 100,
          cuidar_envio_gratis: cuidarEnvio,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? '')
      const omitidos = (d.omitidos ?? []) as { sku: string | null; motivo: string }[]
      setAviso(
        `${d.cambiados} precio(s) cambiados.` +
          (omitidos.length
            ? ` Quedaron ${omitidos.length} afuera: ${omitidos
                .slice(0, 5)
                .map((o) => `${o.sku ?? '—'} (${o.motivo})`)
                .join(', ')}${omitidos.length > 5 ? '…' : ''}`
            : ''),
      )
      await cargar()
    } catch (e) {
      setError((e as Error).message || 'No se pudo aplicar. Nada quedó a medias: revisá y probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  if (cargando && !data) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const filas = data?.filas ?? []
  const elegidas = filas.filter((f) => elegidos.has(f.id))
  const conCosto = elegidas.filter((f) => f.margen_oferta != null)
  const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const bajoPiso = filas.filter((f) => f.bajo_piso).length
  const pierden = filas.filter((f) => f.pierde_envio_gratis).length
  const sinCosto = filas.filter((f) => f.costo == null).length

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Precios del Cyber</h1>
        <p className="text-brand-text-muted mt-1 text-sm">
          Paso 1: subir el precio de lista. Paso 2: aplicar el descuento sobre ese precio.
          Al final, restaurar.
        </p>
      </div>

      {data?.error_crm && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          <strong>Sin costos del CRM:</strong> {data.error_crm}. Sin costo no se puede saber
          qué margen deja cada descuento, así que no se puede aplicar nada.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-2xl border border-brand-border bg-brand-bg-card p-4">
        <div>
          <label className="block text-xs text-brand-text-muted mb-1">Paso 1 — subir</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={inflar}
              onChange={(e) => setInflar(e.target.value)}
              className="input-dark w-20"
              min={0}
              max={50}
            />
            <span className="text-brand-text-muted text-sm">%</span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-brand-text-muted mb-1">Paso 2 — descontar</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
              className="input-dark w-20"
              min={0}
              max={50}
            />
            <span className="text-brand-text-muted text-sm">%</span>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-2">
          <input
            type="checkbox"
            checked={cuidarEnvio}
            onChange={(e) => setCuidarEnvio(e.target.checked)}
            className="h-4 w-4 accent-brand-purple"
          />
          <span className="text-sm text-brand-text">
            Cuidar el envío gratis
            <span className="block text-xs text-brand-text-muted">
              Al que cruzaría los {money(data?.cfg.umbral_envio_gratis ?? 61000)} hacia abajo
              se le recorta el descuento y queda justo en el umbral.
            </span>
          </span>
        </label>

        {/*
          El número que de verdad importa y que nadie calcula de cabeza:
          +15% y −20% no es −20%, es −8%. Va grande para que sea lo primero
          que se lee antes de apretar cualquier botón.
        */}
        <div className="ml-auto text-right">
          <p className="text-xs text-brand-text-muted">El comprador termina pagando</p>
          <p className="text-xl font-bold text-brand-neon">
            {((1 - (1 + Number(inflar) / 100) * (1 - Number(descuento) / 100)) * 100).toFixed(1)}%
            menos que hoy
          </p>
          <p className="text-xs text-brand-text-muted">
            aunque el cartel diga {descuento}%
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { k: 'Elegidos', v: `${elegidas.length} / ${filas.length}` },
          { k: 'Margen hoy', v: pct(prom(conCosto.map((f) => f.margen_actual!))) },
          { k: 'Margen con la promo', v: pct(prom(conCosto.map((f) => f.margen_oferta!))) },
          { k: 'Bajo el piso', v: String(bajoPiso) },
          { k: 'Pierden envío gratis', v: String(pierden) },
        ].map((x) => (
          <div key={x.k} className="rounded-xl border border-brand-border bg-brand-bg-soft p-3">
            <p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{x.k}</p>
            <p className="text-lg font-semibold text-white">{x.v}</p>
          </div>
        ))}
      </div>

      {(bajoPiso > 0 || pierden > 0 || sinCosto > 0) && (
        <div className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/5 p-4 text-sm text-amber-300 space-y-1">
          {bajoPiso > 0 && (
            <p>
              <strong>{bajoPiso}</strong> no llegan al piso de{' '}
              {pct(data?.cfg.piso_margen ?? 0.08)} de margen. Vienen destildados.
            </p>
          )}
          {pierden > 0 && (
            <p>
              <strong>{pierden}</strong> hoy tienen envío gratis y con el descuento lo
              pierden: el comprador ahorra en el producto y paga el flete entero, así que
              termina pagando <strong>más</strong>. Están marcados en la tabla.
            </p>
          )}
          {filas.filter((f) => f.sin_descuento_real).length > 0 && (
            <p>
              <strong>{filas.filter((f) => f.sin_descuento_real).length}</strong> ya están
              en el umbral: el precio no bajaría pero el tachado aparecería igual. Van
              afuera — un cartel de descuento sobre un precio que no se mueve no se
              publica ni forzándolo.
            </p>
          )}
          {sinCosto > 0 && (
            <p>
              <strong>{sinCosto}</strong> no tienen costo cargado en el CRM. No se puede
              saber si se venden a pérdida.
            </p>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <button
          disabled={trabajando || elegidas.length === 0}
          onClick={() =>
            correr(
              'inflar',
              `Subir ${inflar}% el precio de ${elegidas.length} producto(s).\n\n` +
                `Esto cambia la tienda AHORA: los compradores van a ver los precios nuevos.\n` +
                `El precio original queda guardado para poder volver.`,
            )
          }
          className="rounded-xl bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Paso 1 · Subir {inflar}%
        </button>
        <button
          disabled={trabajando || elegidas.length === 0}
          onClick={() =>
            correr(
              'aplicar',
              `Aplicar ${descuento}% de descuento a ${elegidas.length} producto(s).\n\n` +
                `Arranca la promo: precios tachados y nuevos, visibles para todos.`,
            )
          }
          className="rounded-xl border border-brand-neon/50 bg-brand-neon/10 px-5 py-2.5 text-sm font-semibold text-brand-neon disabled:opacity-50"
        >
          Paso 2 · Aplicar −{descuento}%
        </button>
        <button
          disabled={trabajando}
          onClick={() =>
            correr(
              'restaurar',
              'Devolver TODOS los precios tocados a su valor original.\n\n' +
                'No importa lo que esté tildado: vuelve todo. Se saca el tachado.',
            )
          }
          className="ml-auto rounded-xl border border-brand-border px-5 py-2.5 text-sm font-semibold text-brand-text disabled:opacity-50"
        >
          Restaurar todo
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      {aviso && <p className="mb-3 text-sm text-brand-neon">{aviso}</p>}

      <div className="overflow-x-auto rounded-2xl border border-brand-border">
        <table className="w-full text-sm">
          <thead className="bg-brand-bg-soft text-xs uppercase tracking-wide text-brand-text-muted">
            <tr>
              <th className="p-2 w-8">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-purple"
                  checked={elegidos.size === filas.length && filas.length > 0}
                  onChange={(e) =>
                    setElegidos(e.target.checked ? new Set(filas.map((f) => f.id)) : new Set())
                  }
                />
              </th>
              <th className="p-2 text-left">Producto</th>
              <th className="p-2 text-right">Costo</th>
              <th className="p-2 text-right">Hoy</th>
              <th className="p-2 text-right">Lista promo</th>
              <th className="p-2 text-right">Oferta</th>
              <th className="p-2 text-right">Margen</th>
              <th className="p-2 text-left">Avisos</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.id}
                className={`border-t border-brand-border ${
                  elegidos.has(f.id) ? '' : 'opacity-50'
                }`}
              >
                <td className="p-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-purple"
                    checked={elegidos.has(f.id)}
                    onChange={() => toggle(f.id)}
                  />
                </td>
                <td className="p-2">
                  <span className="font-mono text-xs text-brand-text-muted">{f.sku ?? '—'}</span>{' '}
                  <span className="text-brand-text">{f.nombre.slice(0, 40)}</span>
                </td>
                <td className="p-2 text-right tabular-nums text-brand-text-muted">
                  {f.costo == null ? '—' : money(f.costo)}
                </td>
                <td className="p-2 text-right tabular-nums text-brand-text">
                  {money(f.precio_original)}
                </td>
                <td className="p-2 text-right tabular-nums text-brand-text-muted">
                  {money(f.precio_inflado)}
                </td>
                <td className="p-2 text-right tabular-nums font-semibold text-white">
                  {money(f.precio_oferta)}
                </td>
                <td
                  className={`p-2 text-right tabular-nums ${
                    f.bajo_piso ? 'text-red-400' : 'text-brand-text'
                  }`}
                >
                  {pct(f.margen_actual)} → <strong>{pct(f.margen_oferta)}</strong>
                </td>
                <td className="p-2 text-xs">
                  {f.pierde_envio_gratis && (
                    <span className="text-amber-400">
                      pierde envío gratis · paga {money(f.cuanto_mas_caro)} más
                    </span>
                  )}
                  {f.clavado_al_umbral && !f.sin_descuento_real && (
                    <span className="text-brand-neon">
                      clavado en el umbral para no perder el envío gratis
                    </span>
                  )}
                  {f.sin_descuento_real && (
                    <span className="text-red-400">
                      el precio no baja · sería un tachado sin descuento
                    </span>
                  )}
                  {f.costo == null && <span className="text-red-400">sin costo en el CRM</span>}
                  {f.stock === 0 && <span className="text-brand-text-muted"> sin stock</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
