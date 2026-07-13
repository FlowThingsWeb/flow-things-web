'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import Stars from '@/components/Stars'

interface Resena {
  id: string
  nombre: string
  rating: number
  comentario: string | null
  created_at: string
}

function formatFecha(f: string) {
  return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ProductReviews({ productoId }: { productoId: string }) {
  const { user, session } = useAuth()
  const [resenas, setResenas] = useState<Resena[]>([])
  const [promedio, setPromedio] = useState(0)
  const [cantidad, setCantidad] = useState(0)

  // Form
  const [rating, setRating] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/resenas?producto_id=${productoId}`)
    const d = await r.json()
    setResenas(d.resenas ?? [])
    setPromedio(d.promedio ?? 0)
    setCantidad(d.cantidad ?? 0)
  }, [productoId])

  useEffect(() => { cargar() }, [cargar])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) { setMsg({ tipo: 'error', texto: 'Elegí una puntuación (1 a 5 estrellas).' }); return }
    setEnviando(true)
    setMsg(null)
    try {
      const res = await fetch('/api/resenas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ producto_id: productoId, rating, comentario }),
      })
      const d = await res.json()
      if (!res.ok) { setMsg({ tipo: 'error', texto: d.error || 'No se pudo enviar.' }); return }
      setMsg({ tipo: 'ok', texto: '¡Gracias por tu reseña!' })
      setComentario('')
      setRating(0)
      cargar()
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de conexión. Probá de nuevo.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="border-t border-brand-border pt-8 mt-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-brand-text">Reseñas</h2>
        {cantidad > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={promedio} />
            <span className="text-sm text-brand-text-muted">
              {promedio} · {cantidad} reseña{cantidad !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Formulario (solo logueados) */}
      {user ? (
        <form onSubmit={enviar} className="bg-brand-bg-card border border-brand-border rounded-2xl p-5 mb-6 space-y-3">
          <p className="text-sm font-medium text-brand-text">Dejá tu reseña</p>
          <Stars value={rating} onChange={setRating} size={26} />
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Contanos qué te pareció (opcional)"
            rows={3}
            maxLength={1000}
            className="input-dark w-full text-sm"
          />
          {msg && (
            <p className={`text-sm ${msg.tipo === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg.texto}</p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {enviando ? 'Enviando...' : 'Publicar reseña'}
          </button>
          <p className="text-xs text-brand-text-light">Solo podés reseñar productos que compraste.</p>
        </form>
      ) : (
        <p className="text-sm text-brand-text-muted mb-6">
          <a href="/cuenta/login" className="text-brand-purple hover:underline">Iniciá sesión</a> para dejar una reseña.
        </p>
      )}

      {/* Lista */}
      {resenas.length === 0 ? (
        <p className="text-sm text-brand-text-muted">Todavía no hay reseñas. ¡Sé el primero!</p>
      ) : (
        <div className="space-y-5">
          {resenas.map((r) => (
            <div key={r.id} className="border-b border-brand-border pb-5 last:border-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-brand-text">{r.nombre}</span>
                <span className="text-xs text-brand-text-light">{formatFecha(r.created_at)}</span>
              </div>
              <Stars value={r.rating} size={14} />
              {r.comentario && <p className="text-sm text-brand-text-muted mt-2 leading-relaxed">{r.comentario}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
