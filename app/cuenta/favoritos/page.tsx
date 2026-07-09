'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import FavoritoButton from '@/components/FavoritoButton'
import { formatPrecio } from '@/lib/format'

interface Producto {
  id: string
  nombre: string
  slug: string
  precio: number
  imagen_url: string | null
  activo: boolean
}

export default function FavoritosPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/cuenta/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    supabase
      .from('favoritos')
      .select('productos(id, nombre, slug, precio, imagen_url, activo)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setProductos(data.map((f: any) => f.productos).filter(Boolean))
        }
        setCargando(false)
      })
  }, [user])

  // Cuando el usuario quita un favorito, lo sacamos de la lista local
  function handleRemoveFavorito(productoId: string) {
    setProductos(prev => prev.filter(p => p.id !== productoId))
  }

  if (loading || cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/cuenta" className="text-brand-text-muted hover:text-brand-text transition-colors text-sm">
          ← Mi cuenta
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-brand-text mb-8">Mis favoritos</h1>

      {productos.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-5xl block mb-4">❤️</span>
          <p className="text-brand-text-muted mb-4">Todavía no guardaste ningún favorito.</p>
          <Link
            href="/productos"
            className="bg-brand-purple hover:bg-brand-purple-light text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm inline-block"
          >
            Ver catálogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {productos.map(producto => (
            <div key={producto.id} className="bg-brand-bg-card border border-brand-border rounded-2xl overflow-hidden group relative">
              {/* Botón quitar favorito */}
              <div className="absolute top-2 right-2 z-10">
                <FavoritoButton
                  productoId={producto.id}
                  initialFav={true}
                  onToggle={(esFav) => { if (!esFav) handleRemoveFavorito(producto.id) }}
                />
              </div>

              <Link href={`/productos/${producto.slug}`}>
                <div className="relative aspect-square bg-brand-bg">
                  {producto.imagen_url ? (
                    <Image
                      src={producto.imagen_url}
                      alt={producto.nombre}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-brand-text line-clamp-2 leading-snug mb-1">{producto.nombre}</p>
                  <p className="text-sm font-bold text-brand-purple">{formatPrecio(producto.precio)}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
