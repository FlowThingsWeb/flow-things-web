'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/lib/store'
import { Producto, Variante } from '@/types'

function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(precio)
}

function waLink(telefono: string, texto: string) {
  const num = telefono.replace(/\D/g, '')
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}

export default function ProductoDetallePage() {
  const { slug } = useParams()
  const [producto, setProducto] = useState<Producto | null>(null)
  const [loading, setLoading]   = useState(true)
  const [imagenActiva, setImagenActiva] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [cantidad, setCantidad] = useState(1)
  const [agregado, setAgregado] = useState(false)
  const [sinStockMsg, setSinStockMsg] = useState(false)
  const touchStartX = useRef(0)

  // Contact info from config
  const [telefono, setTelefono] = useState('+54 9 11 5607 5633')
  const [email,    setEmail]    = useState('contacto@flowthings.com.ar')

  // Variant selection
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({})

  const addItem = useCartStore(s => s.addItem)

  // --- Fetch product + variants + contact config ---
  useEffect(() => {
    async function load() {
      const [prodRes, cfgRes] = await Promise.all([
        supabase
          .from('productos')
          .select('*, categorias(id, nombre, slug), variantes(*)')
          .eq('slug', slug)
          .eq('activo', true)
          .single(),
        supabase
          .from('configuracion')
          .select('clave, valor')
          .in('clave', ['footer_telefono', 'footer_email']),
      ])

      if (!prodRes.data) { setLoading(false); return }
      setProducto(prodRes.data as Producto)

      for (const row of cfgRes.data || []) {
        if (row.clave === 'footer_telefono' && row.valor) setTelefono(row.valor)
        if (row.clave === 'footer_email'    && row.valor) setEmail(row.valor)
      }

      setLoading(false)
    }
    load()
  }, [slug])

  // Active variants only
  const variantes: Variante[] = useMemo(
    () => (producto?.variantes || []).filter(v => v.activo),
    [producto]
  )

  // Group attribute names → unique values: { "Color": ["Rosa","Azul"], "Talle": ["M","L"] }
  const atributoGroups = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const v of variantes) {
      for (const [key, val] of Object.entries(v.atributos)) {
        if (!groups[key]) groups[key] = []
        if (!groups[key].includes(val)) groups[key].push(val)
      }
    }
    return groups
  }, [variantes])

  const atributoKeys   = Object.keys(atributoGroups)
  const tieneVariantes = atributoKeys.length > 0

  // Variant that matches the full current selection
  const varianteSeleccionada: Variante | null = useMemo(() => {
    if (!tieneVariantes) return null
    return variantes.find(v =>
      Object.entries(selectedAttrs).every(([k, val]) => v.atributos[k] === val) &&
      Object.keys(v.atributos).length === Object.keys(selectedAttrs).length
    ) ?? null
  }, [variantes, selectedAttrs, tieneVariantes])

  const seleccionCompleta = !tieneVariantes || atributoKeys.every(k => !!selectedAttrs[k])

  // Effective stock (never shown as a number to the customer)
  const stockEfectivo = varianteSeleccionada?.stock ?? (tieneVariantes ? 0 : (producto?.stock ?? 0))

  // Is a given attr value available given current partial selection?
  const isValueAvailable = (attrKey: string, attrVal: string) =>
    variantes.some(v =>
      v.atributos[attrKey] === attrVal &&
      v.stock > 0 &&
      Object.entries(selectedAttrs).every(([k, val]) => k === attrKey || v.atributos[k] === val)
    )

  const selectAttr = (key: string, val: string) => {
    setSelectedAttrs(prev => ({ ...prev, [key]: val }))
    setCantidad(1)
    setSinStockMsg(false)
    setImagenActiva(0)
  }

  // Build gallery images — if variant selected, show only that variant's images
  const todasLasImagenes = useMemo(() => {
    if (!producto) return []
    if (varianteSeleccionada) {
      const imgs: string[] = []
      if (varianteSeleccionada.imagen_url) imgs.push(varianteSeleccionada.imagen_url)
      for (const img of (varianteSeleccionada.imagenes || [])) {
        if (!imgs.includes(img)) imgs.push(img)
      }
      // fallback: if variant has no images at all, show product images
      if (imgs.length === 0) {
        if (producto.imagen_url) imgs.push(producto.imagen_url)
        for (const img of (producto.imagenes || [])) {
          if (!imgs.includes(img)) imgs.push(img)
        }
      }
      return imgs
    }
    // No variant: show product images
    const imgs: string[] = []
    if (producto.imagen_url) imgs.push(producto.imagen_url)
    for (const img of (producto.imagenes || [])) {
      if (!imgs.includes(img)) imgs.push(img)
    }
    return imgs
  }, [producto, varianteSeleccionada])

  const galeriaLen = todasLasImagenes.length

  // If active image index is out of range after gallery changes (variant switch), reset it
  useEffect(() => {
    if (galeriaLen > 0 && imagenActiva >= galeriaLen) setImagenActiva(0)
  }, [galeriaLen, imagenActiva])

  const prevImg = useCallback(() =>
    setImagenActiva(i => (i - 1 + galeriaLen) % galeriaLen), [galeriaLen])
  const nextImg = useCallback(() =>
    setImagenActiva(i => (i + 1) % galeriaLen), [galeriaLen])

  // Keyboard navigation + Escape to close lightbox
  useEffect(() => {
    if (galeriaLen <= 1 && !lightbox) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prevImg()
      if (e.key === 'ArrowRight') nextImg()
      if (e.key === 'Escape')     setLightbox(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [galeriaLen, lightbox, prevImg, nextImg])

  // Quantity handlers — validate against stock silently
  const incrementarCantidad = () => {
    if (cantidad >= stockEfectivo) {
      setSinStockMsg(true)
    } else {
      setCantidad(c => c + 1)
      setSinStockMsg(false)
    }
  }
  const decrementarCantidad = () => {
    setCantidad(c => Math.max(1, c - 1))
    setSinStockMsg(false)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center">
        <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!producto) return notFound()

  const tieneDescuento = producto.precio_anterior && producto.precio_anterior > producto.precio

  function handleAgregar() {
    if (!producto || !seleccionCompleta || stockEfectivo === 0) return
    if (cantidad > stockEfectivo) { setSinStockMsg(true); return }

    const varLabel = varianteSeleccionada
      ? Object.values(varianteSeleccionada.atributos).join(' / ')
      : null

    for (let i = 0; i < cantidad; i++) {
      addItem(varLabel
        ? { ...producto, nombre: `${producto.nombre} — ${varLabel}` }
        : producto
      )
    }
    setAgregado(true)
    setTimeout(() => setAgregado(false), 2000)
  }

  // Contact message for WhatsApp
  const waMsg = `Hola! Quiero consultar disponibilidad del producto "${producto.nombre}"${
    varianteSeleccionada ? ` (${Object.values(varianteSeleccionada.atributos).join(' / ')})` : ''
  }. Quiero ${cantidad} unidades.`

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-brand-text-muted mb-8">
        <Link href="/" className="hover:text-brand-purple transition-colors">Inicio</Link>
        <span>/</span>
        <Link href="/productos" className="hover:text-brand-purple transition-colors">Catálogo</Link>
        {producto.categorias && (
          <>
            <span>/</span>
            <Link
              href={`/productos?categoria=${(producto.categorias as any).slug}`}
              className="hover:text-brand-purple transition-colors"
            >
              {(producto.categorias as any).nombre}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-brand-text font-medium truncate">{producto.nombre}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

        {/* ── Galería ── */}
        <div className="space-y-3">
          {/* Main image */}
          <div
            className="relative aspect-square bg-brand-bg-card border border-brand-border rounded-3xl overflow-hidden group"
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
            onTouchEnd={e => {
              const dx = e.changedTouches[0].clientX - touchStartX.current
              if (Math.abs(dx) > 40) { dx < 0 ? nextImg() : prevImg() }
            }}
          >
            {todasLasImagenes.length > 0 ? (
              <>
                <Image
                  src={todasLasImagenes[imagenActiva]}
                  alt={producto.nombre}
                  fill
                  className="object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.02]"
                  onClick={() => setLightbox(true)}
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />

                {/* Arrows — hidden when only 1 image */}
                {todasLasImagenes.length > 1 && (
                  <>
                    <button
                      onClick={prevImg}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm z-10"
                      aria-label="Imagen anterior"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={nextImg}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm z-10"
                      aria-label="Imagen siguiente"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Counter badge */}
                    <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm z-10">
                      {imagenActiva + 1} / {todasLasImagenes.length}
                    </span>
                  </>
                )}

                {/* Zoom hint */}
                <span className="absolute bottom-3 left-3 bg-black/50 text-white/70 text-[10px] px-2 py-1 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden sm:flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current stroke-2">
                    <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
                  </svg>
                  Ampliar
                </span>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl">📦</div>
            )}
          </div>

          {/* Thumbnails */}
          {todasLasImagenes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {todasLasImagenes.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImagenActiva(i)}
                  className={`relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                    i === imagenActiva
                      ? 'border-brand-purple w-20 h-20 opacity-100 ring-2 ring-brand-purple/30'
                      : 'border-transparent w-16 h-16 opacity-60 hover:opacity-100 hover:border-brand-purple/50'
                  }`}
                >
                  <Image src={img} alt={`Vista ${i + 1}`} fill className="object-cover" sizes="80px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Lightbox ── */}
        {lightbox && todasLasImagenes.length > 0 && (
          <div
            className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
            onClick={() => setLightbox(false)}
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
            onTouchEnd={e => {
              const dx = e.changedTouches[0].clientX - touchStartX.current
              if (Math.abs(dx) > 40) { e.stopPropagation(); dx < 0 ? nextImg() : prevImg() }
            }}
          >
            {/* Close */}
            <button
              onClick={() => setLightbox(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-2">
                <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12"/>
              </svg>
            </button>

            {/* Counter */}
            {todasLasImagenes.length > 1 && (
              <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
                {imagenActiva + 1} / {todasLasImagenes.length}
              </span>
            )}

            {/* Image */}
            <div
              className="relative w-full h-full max-w-4xl max-h-[90vh] mx-4"
              onClick={e => e.stopPropagation()}
            >
              <Image
                src={todasLasImagenes[imagenActiva]}
                alt={producto.nombre}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>

            {/* Prev / Next */}
            {todasLasImagenes.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); prevImg() }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); nextImg() }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>

                {/* Dot indicators */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {todasLasImagenes.map((_, i) => (
                    <button
                      key={i}
                      onClick={e => { e.stopPropagation(); setImagenActiva(i) }}
                      className={`rounded-full transition-all ${
                        i === imagenActiva
                          ? 'w-6 h-2 bg-white'
                          : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Info ── */}
        <div className="space-y-6">
          {producto.categorias && (
            <Link
              href={`/productos?categoria=${(producto.categorias as any).slug}`}
              className="text-brand-purple text-sm font-medium hover:underline"
            >
              {(producto.categorias as any).nombre}
            </Link>
          )}

          <h1 className="text-3xl font-bold text-brand-text leading-tight">
            {producto.nombre}
          </h1>

          {/* Precio */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-brand-neon">
              {formatPrecio(producto.precio)}
            </span>
            {tieneDescuento && (
              <>
                <span className="text-brand-text-muted text-lg line-through">
                  {formatPrecio(producto.precio_anterior!)}
                </span>
                <span className="bg-brand-purple/20 text-brand-purple-light text-sm font-semibold px-2 py-1 rounded-lg">
                  {Math.round(
                    ((producto.precio_anterior! - producto.precio) / producto.precio_anterior!) * 100
                  )}% OFF
                </span>
              </>
            )}
          </div>

          {/* Descripción */}
          {producto.descripcion && (
            <div className="text-brand-text-muted text-sm leading-relaxed border-t border-brand-border pt-5">
              <p>{producto.descripcion}</p>
            </div>
          )}

          {/* ── Variantes ── */}
          {tieneVariantes && (
            <div className="border-t border-brand-border pt-5 space-y-5">
              {atributoKeys.map(attrKey => (
                <div key={attrKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-sm font-semibold text-brand-text">{attrKey}</p>
                    {selectedAttrs[attrKey] && (
                      <span className="text-xs text-brand-text-muted">
                        — <span className="text-white font-medium">{selectedAttrs[attrKey]}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {atributoGroups[attrKey].map(val => {
                      const isSelected  = selectedAttrs[attrKey] === val
                      const isAvailable = isValueAvailable(attrKey, val)
                      return (
                        <button
                          key={val}
                          onClick={() => isAvailable && selectAttr(attrKey, val)}
                          disabled={!isAvailable}
                          title={!isAvailable ? 'Sin stock disponible' : undefined}
                          className={[
                            'relative px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all',
                            isSelected
                              ? 'border-brand-purple bg-brand-purple text-white'
                              : isAvailable
                              ? 'border-brand-border bg-brand-bg-soft text-brand-text hover:border-brand-purple hover:text-brand-purple'
                              : 'border-brand-border/40 bg-brand-bg-soft/50 text-brand-text-light cursor-not-allowed opacity-40',
                          ].join(' ')}
                        >
                          {val}
                          {!isAvailable && (
                            <span
                              className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none"
                              aria-hidden
                            >
                              <span
                                className="absolute inset-0 border-t border-brand-text-light/40"
                                style={{ transform: 'rotate(-12deg) scaleX(1.3)', transformOrigin: 'center' }}
                              />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Hint when selection incomplete */}
              {!seleccionCompleta && (
                <p className="text-xs text-brand-text-muted italic">
                  Seleccioná {atributoKeys.filter(k => !selectedAttrs[k]).join(' y ')} para continuar
                </p>
              )}
            </div>
          )}

          {/* ── Cantidad + Agregar ── (stock > 0 y selección completa) */}
          {stockEfectivo > 0 && seleccionCompleta && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-4">
                <span className="text-sm text-brand-text-muted font-medium">Cantidad:</span>
                <div className="flex items-center gap-3 bg-brand-bg-soft border border-brand-border rounded-xl px-3 py-2">
                  <button
                    onClick={decrementarCantidad}
                    className="w-6 h-6 flex items-center justify-center text-brand-text-muted hover:text-brand-purple font-bold text-lg"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold text-brand-text">{cantidad}</span>
                  <button
                    onClick={incrementarCantidad}
                    className="w-6 h-6 flex items-center justify-center text-brand-text-muted hover:text-brand-purple font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Sin stock suficiente — aviso de contacto */}
              {sinStockMsg && (
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 space-y-2">
                  <p className="text-sm text-amber-300 font-medium">
                    ⚠️ No hay stock suficiente para entrega inmediata
                  </p>
                  <p className="text-xs text-amber-300/80">
                    Podés contactarnos y coordinamos la cantidad que necesitás:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={waLink(telefono, waMsg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                    >
                      {/* WhatsApp icon */}
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </a>
                    <a
                      href={`mailto:${email}?subject=Consulta de stock - ${producto.nombre}&body=${encodeURIComponent(waMsg)}`}
                      className="flex items-center gap-1.5 bg-brand-bg-soft hover:bg-brand-border border border-brand-border text-brand-text text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                    >
                      ✉️ {email}
                    </a>
                  </div>
                </div>
              )}

              <button
                onClick={handleAgregar}
                disabled={sinStockMsg}
                className={`w-full py-4 rounded-2xl font-semibold text-base transition-all ${
                  agregado
                    ? 'bg-green-500 text-white'
                    : sinStockMsg
                    ? 'bg-brand-bg-soft text-brand-text-muted border border-brand-border cursor-not-allowed'
                    : 'bg-brand-purple hover:bg-brand-purple-dark text-white hover:shadow-soft'
                }`}
              >
                {agregado ? '✓ Agregado al carrito' : sinStockMsg ? 'Contactanos para coordinar' : 'Agregar al carrito'}
              </button>
            </div>
          )}

          {/* Sin stock total — botón de consulta */}
          {stockEfectivo === 0 && seleccionCompleta && (
            <div className="space-y-3 pt-2">
              <div className="bg-brand-bg-soft border border-brand-border rounded-xl p-4 space-y-2">
                <p className="text-sm text-brand-text-muted font-medium">
                  Este producto no tiene stock para entrega inmediata
                </p>
                <p className="text-xs text-brand-text-light">
                  Contactanos y te avisamos cuando esté disponible o coordinamos un pedido especial.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={waLink(telefono, `Hola! Quiero saber cuándo va a haber stock del producto "${producto.nombre}"${varianteSeleccionada ? ` (${Object.values(varianteSeleccionada.atributos).join(' / ')})` : ''}.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Consultar por WhatsApp
                  </a>
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-1.5 bg-brand-bg-soft hover:bg-brand-border border border-brand-border text-brand-text text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  >
                    ✉️ Enviar email
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Pendiente de selección */}
          {tieneVariantes && !seleccionCompleta && (
            <button disabled className="w-full py-4 rounded-2xl font-semibold text-base bg-brand-bg-soft text-brand-text-muted border border-dashed border-brand-border cursor-not-allowed">
              Seleccioná una opción para agregar
            </button>
          )}

          {/* Beneficios */}
          <div className="bg-brand-bg-soft rounded-2xl p-4 space-y-3 text-sm text-brand-text-muted">
            <div className="flex items-center gap-2">
              <span>🚚</span>
              <span>Envío a todo el país</span>
            </div>
            <div className="flex items-start gap-2">
              <span>🎁</span>
              <span>Envío gratis en AMBA +$40.000 · Interior del país +$120.000</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🔒</span>
              <span>Compra 100% segura</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
