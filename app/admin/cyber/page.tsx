'use client'

/**
 * El interruptor de las Ofertas Cyber.
 *
 * Esta pantalla no toca ningún precio: prende la promo, le pone hora de
 * arranque y escribe lo que va a leer el comprador. Los precios son otra
 * pantalla y otra decisión — mezclarlas haría que prender la promo y bajar
 * 161 precios fuera el mismo click, y son cosas que conviene poder deshacer
 * por separado.
 *
 * Lo que sí hace, y por eso se avisa fuerte acá: mientras la promo esté
 * prendida, el cron que ajusta precios contra el costo del CRM no toca nada.
 */

import { useState, useEffect } from 'react'

const ZONA_AR = 'America/Argentina/Buenos_Aires'

/** El mismo parseo que usa el servidor, para no prometer acá algo distinto. */
function parsearDesde(texto: string): string | null {
  const t = texto.trim()
  if (!t) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(t)
  if (!m) return null
  const [, y, mes, d, h, min] = m
  if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) return null
  if (Number(h ?? '0') > 23 || Number(min ?? '0') > 59) return null
  return `${y}-${mes}-${d}T${(h ?? '00').padStart(2, '0')}:${(min ?? '00').padStart(2, '0')}`
}

function ahoraEnBuenosAires(): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_AR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const g = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? '00'
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
}

/** "lunes 2 de noviembre a las 00:00" — la fecha dicha como la diría una persona. */
function enCastellano(iso: string): string {
  const [fecha, hora] = iso.split('T')
  const [y, m, d] = fecha.split('-').map(Number)
  const dia = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
  return `${dia} a las ${hora}`
}

export default function CyberAdminPage() {
  const [activo, setActivo] = useState(false)
  const [desde, setDesde] = useState('')
  const [titulo, setTitulo] = useState('Ofertas Cyber')
  const [bajada, setBajada] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [armando, setArmando] = useState(false)
  const [resultadoMail, setResultadoMail] = useState('')

  const armarDifusion = async () => {
    setArmando(true)
    setResultadoMail('')
    setError('')
    try {
      const r = await fetch('/api/admin/cyber/difusion', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? '')
      setResultadoMail(
        d.productos > 0
          ? `Listo: ${d.productos} productos, hasta ${d.descuento_maximo}% OFF. Revisalo en Mailing antes de mandarlo.`
          : 'Armado, pero sin ningún producto rebajado todavía: aplicá el descuento y rearmalo.',
      )
    } catch (e) {
      setError((e as Error).message || 'No se pudo armar el borrador.')
    } finally {
      setArmando(false)
    }
  }

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then(({ data }) => {
        const cfg: Record<string, string> = {}
        for (const row of data ?? []) cfg[row.clave] = row.valor ?? ''
        /**
         * Sin fila en la base manda el valor por defecto del código, que es
         * el que está usando el servidor en este momento. Con fila, manda la
         * fila aunque esté vacía: vaciar la fecha a propósito significa
         * "arranca apenas la prendo", y no se puede confundir con "nunca se
         * configuró".
         */
        const conDefecto = (clave: string, defecto: string) =>
          cfg[clave] === undefined ? defecto : cfg[clave]
        setActivo(cfg.cyber_activo === '1')
        setDesde(conDefecto('cyber_desde', '2026-11-02'))
        setTitulo(conDefecto('cyber_titulo', 'Ofertas Cyber'))
        setBajada(
          conDefecto('cyber_bajada', 'Hasta 20% en toda la tienda · Envío gratis desde $61.000'),
        )
      })
      .catch(() => setError('No se pudo leer la configuración.'))
      .finally(() => setLoading(false))
  }, [])

  const desdeOk = desde.trim() === '' || parsearDesde(desde) !== null
  const normalizada = parsearDesde(desde)
  const yaArrancó = !normalizada || ahoraEnBuenosAires() >= normalizada

  const guardar = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            cyber_activo: activo ? '1' : '0',
            cyber_desde: desde.trim(),
            cyber_titulo: titulo,
            cyber_bajada: bajada,
          },
        }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Ofertas Cyber</h1>
        <p className="text-brand-text-muted mt-1 text-sm">
          El interruptor de la promo. Acá no se toca ningún precio.
        </p>
      </div>

      <div className="mb-6 bg-brand-bg-card border border-brand-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-white">Estado</h2>
            <p className="text-xs text-brand-text-muted">
              Prendela con tiempo y poné la fecha: la promo sale sola el día y la hora
              que digas, con el reloj de Buenos Aires.
            </p>
          </div>
          <label className="flex items-center gap-2 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="w-4 h-4 accent-brand-purple"
            />
            <span className="text-sm text-brand-text">{activo ? 'Prendida' : 'Apagada'}</span>
          </label>
        </div>

        {/*
          Tres estados que desde afuera se parecen y no son lo mismo. "Apagada"
          y "prendida pero arranca el lunes" dejan la tienda igual: sin esto,
          el lunes a la mañana no hay forma de saber si va a salir sola o si
          alguien se olvidó de prenderla.
        */}
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            activo && yaArrancó
              ? 'border-brand-neon/35 bg-brand-neon/5 text-brand-neon'
              : activo
                ? 'border-amber-500/35 bg-amber-500/5 text-amber-400'
                : 'border-brand-border bg-brand-bg-soft text-brand-text-muted'
          }`}
        >
          {activo && yaArrancó && (
            <>
              <strong>Corriendo ahora.</strong> La tienda está mostrando la promo
              {normalizada ? ` desde el ${enCastellano(normalizada)}` : ''}.
            </>
          )}
          {activo && !yaArrancó && (
            <>
              <strong>Programada.</strong> Todavía no se ve nada en la tienda. Arranca
              sola el {enCastellano(normalizada!)}.
            </>
          )}
          {!activo && (
            <>
              <strong>Apagada.</strong> La tienda se ve como siempre y el cron de precios
              trabaja normal.
            </>
          )}
        </div>
      </div>

      <div className="mb-6 bg-brand-bg-card border border-brand-border rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-brand-text mb-1">Arranca el</label>
          <input
            type="text"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            placeholder="2026-11-02 o 2026-11-02T09:00"
            className="input-dark w-full"
          />
          <p className="mt-1 text-xs text-brand-text-muted">
            Día solo = arranca a las 00:00. Vacío = arranca apenas la prendés.
            {!desdeOk && (
              <span className="text-red-400">
                {' '}
                Así escrita no se entiende, y una fecha que no se entiende deja la promo
                prendida pero invisible. Usá 2026-11-02 o 2026-11-02T09:00.
              </span>
            )}
          </p>
        </div>

        {/*
          No hay campo de "termina el". La promo se apaga a mano: cuándo
          conviene cortarla depende de cómo venga la venta, y una fecha puesta
          hoy la apaga sola un martes a la noche en medio de un pico.
        */}

        <div>
          <label className="block text-sm text-brand-text mb-1">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="input-dark w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-brand-text mb-1">Bajada</label>
          <input
            type="text"
            value={bajada}
            onChange={(e) => setBajada(e.target.value)}
            placeholder="Hasta 20% en toda la tienda · Envío gratis desde $61.000"
            className="input-dark w-full"
          />
          <p className="mt-1 text-xs text-brand-text-muted">
            Lo que se lee abajo del título, en la barra y en la portada.
          </p>
        </div>
      </div>

      {/*
        Esto es consecuencia de prender el interruptor, no un detalle: el cron
        de precios corre todos los días a las 10:23 y llevaría los precios de
        la promo de vuelta al margen objetivo, de a 25 por día, con el tachado
        ya anunciado.
      */}
      <div className="mb-6 rounded-2xl border border-brand-border bg-brand-bg-soft p-4 text-xs text-brand-text-muted">
        <strong className="text-brand-text">Mientras esté prendida:</strong> el cron que
        ajusta precios contra el costo del CRM <strong>no toca ningún precio</strong> y
        manda un mail diario de un renglón recordándolo. Vuelve a trabajar solo en cuanto
        la apagues — no hay nada que prender a mano después.
      </div>

      {/*
        El borrador del mail se arma acá y se manda desde Mailing.

        Separado a propósito: armarlo lee los precios del momento —por eso se
        rearma después de aplicar el descuento, no antes— y mandarlo elige
        destinatarios y filtra bajas. Un solo botón que hiciera las dos cosas
        mandaría un mail a toda la base por un click de más.
      */}
      <div className="mb-6 rounded-2xl border border-brand-border bg-brand-bg-card p-4">
        <p className="font-semibold text-white">Mail de la promo</p>
        <p className="mt-1 text-xs text-brand-text-muted">
          Arma el borrador con los <strong>precios de este momento</strong> y los 8
          productos que más bajan. Rearmalo después de aplicar el descuento, así el mail
          dice lo mismo que la tienda. Se manda desde Mailing, eligiendo a quién.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={armarDifusion}
            disabled={armando}
            className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold text-brand-text disabled:opacity-50"
          >
            {armando ? 'Armando…' : 'Armar el borrador'}
          </button>
          <a href="/admin/difusiones" className="text-sm text-brand-purple underline">
            Ver borradores
          </a>
          {resultadoMail && <span className="text-xs text-brand-neon">{resultadoMail}</span>}
        </div>
      </div>

      <a
        href="/admin/cyber/precios"
        className="mb-6 flex items-center justify-between rounded-2xl border border-brand-border bg-brand-bg-card p-4 hover:border-brand-purple"
      >
        <span>
          <span className="block font-semibold text-white">Precios del Cyber →</span>
          <span className="block text-xs text-brand-text-muted">
            Subir el precio de lista, aplicar el descuento y volver atrás. Con el costo del
            CRM y el margen de cada uno a la vista.
          </span>
        </span>
      </a>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <button
        onClick={guardar}
        disabled={saving || !desdeOk}
        className="rounded-xl bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar'}
      </button>
    </div>
  )
}
