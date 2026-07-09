'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCartStore } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DatosComprador } from '@/types'
import DireccionesManager, { Direccion } from '@/components/DireccionesManager'
import { formatPrecio } from '@/lib/format'

function validarDNI(dni: string): boolean {
  const limpio = (dni || '').replace(/\./g, '').trim()
  return /^\d{7,8}$/.test(limpio)
}

const formInicial: DatosComprador = {
  nombre: '',
  email: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  provincia: '',
  codigo_postal: '',
  dni: '',
}

interface DescuentoAplicado {
  codigo: string
  tipo: 'porcentaje' | 'monto_fijo'
  valor: number
  descuento_monto: number
  mensaje: string
}

interface OpcionEnvio {
  id: string
  nombre: string
  modalidad: string
  precio: number | null
  moneda: string
  descripcion: string | null
  tiempo_estimado: string | null
}

function CarritoContent() {
  const searchParams = useSearchParams()
  const { items, removeItem, total } = useCartStore()
  const { user, session } = useAuth()
  const [form, setForm] = useState<DatosComprador>(formInicial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dniTooltip, setDniTooltip] = useState(false)
  const [dniError, setDniError] = useState('')

  // Dirección seleccionada del selector
  const [dirSeleccionadaId, setDirSeleccionadaId] = useState<string | undefined>()

  // Perfil cargado: cuando el usuario está logueado y trajimos sus datos
  const [perfilCargado, setPerfilCargado] = useState(false)
  // Permite editar datos de contacto aunque estén pre-completados
  const [editandoDatos, setEditandoDatos] = useState(false)

  // Descuento primera compra
  const [primerCompraDescuento, setPrimerCompraDescuento] = useState(false)

  // Cargar perfil del usuario logueado y pre-completar formulario
  useEffect(() => {
    if (!user) {
      setPerfilCargado(false)
      setEditandoDatos(false)
      setForm(formInicial)
      setPrimerCompraDescuento(false)
      return
    }

    async function cargarPerfil() {
      try {
        const [perfilRes, ordenesRes] = await Promise.all([
          supabase
            .from('perfiles')
            .select('nombre, telefono, dni, primer_compra_usada')
            .eq('user_id', user!.id)
            .single(),
          supabase
            .from('ordenes')
            .select('id')
            .eq('user_id', user!.id)
            .eq('estado', 'approved')
            .limit(1),
        ])

        const p = perfilRes.data
        if (p) {
          setForm(f => ({
            ...f,
            nombre: p.nombre || f.nombre,
            email: user!.email || f.email,
            telefono: p.telefono || f.telefono,
            dni: p.dni || f.dni,
          }))
          setPerfilCargado(true)

          const yaUsada = p.primer_compra_usada ?? false
          const tieneOrdenes = (ordenesRes.data?.length ?? 0) > 0
          setPrimerCompraDescuento(!yaUsada && !tieneOrdenes)
        }
      } catch {
        // silencioso
      }
    }

    cargarPerfil()
  }, [user])

  // Mostrar error si el usuario volvió de un pago rechazado
  useEffect(() => {
    if (searchParams.get('error') === 'pago_rechazado') {
      setError('El pago fue rechazado. Revisá los datos de tu tarjeta o intentá con otro medio de pago.')
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  // Descuento
  const [codigoInput, setCodigoInput] = useState('')
  const [descuento, setDescuento] = useState<DescuentoAplicado | null>(null)
  const [descuentoError, setDescuentoError] = useState('')
  const [validandoCodigo, setValidandoCodigo] = useState(false)

  // Envío
  const [envioOpciones, setEnvioOpciones] = useState<OpcionEnvio[]>([])
  const [envioSeleccionado, setEnvioSeleccionado] = useState<OpcionEnvio | null>(null)
  const [calculandoEnvio, setCalculandoEnvio] = useState(false)
  const [envioError, setEnvioError] = useState('')
  const [envioCalculado, setEnvioCalculado] = useState(false)

  const subtotal = total()
  const costoEnvio = envioSeleccionado?.precio ?? 0
  const descuentoCodigo = descuento?.descuento_monto ?? 0
  const descuentoPrimerCompra = primerCompraDescuento ? Math.round(subtotal * 0.1) : 0
  const descuentoTotal = descuentoCodigo + descuentoPrimerCompra
  const totalFinal = Math.max(0, subtotal - descuentoTotal) + costoEnvio

  function aplicarDireccion(dir: Direccion) {
    setDirSeleccionadaId(dir.id)
    setForm(f => ({
      ...f,
      direccion: dir.direccion,
      ciudad: dir.ciudad,
      provincia: dir.provincia,
      codigo_postal: dir.codigo_postal,
    }))
    // Resetear envío calculado porque cambió la provincia
    setEnvioSeleccionado(null)
    setEnvioOpciones([])
    setEnvioCalculado(false)
    setEnvioError('')
  }

  const puedeCalcularEnvio = !!form.provincia.trim()

  const calcularEnvio = async () => {
    setEnvioError('')
    setCalculandoEnvio(true)
    setEnvioSeleccionado(null)
    setEnvioCalculado(false)

    try {
      const res = await fetch('/api/envio/cotizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direccion: form.direccion,
          ciudad: form.ciudad,
          provincia: form.provincia,
          codigo_postal: form.codigo_postal,
          subtotal,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setEnvioError(data.error || 'No se pudo calcular el envío.')
        return
      }

      setEnvioOpciones(data.opciones ?? [])
      setEnvioCalculado(true)

      if (data.opciones?.length === 1) {
        setEnvioSeleccionado(data.opciones[0])
      }
    } catch {
      setEnvioError('Error de conexión. Intentá de nuevo.')
    } finally {
      setCalculandoEnvio(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })

    if (name === 'provincia') {
      setEnvioSeleccionado(null)
      setEnvioOpciones([])
      setEnvioCalculado(false)
      setEnvioError('')
    }
  }

  const aplicarCodigo = async () => {
    if (!codigoInput.trim()) return
    setDescuentoError('')
    setDescuento(null)
    setValidandoCodigo(true)

    try {
      const res = await fetch('/api/descuentos/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigoInput.trim(), subtotal, user_id: user?.id ?? null }),
      })
      const data = await res.json()

      if (data.valido) {
        setDescuento({
          codigo: data.codigo,
          tipo: data.tipo,
          valor: data.valor,
          descuento_monto: data.descuento_monto,
          mensaje: data.mensaje,
        })
      } else {
        setDescuentoError(data.mensaje || 'No existe un código de descuento así.')
      }
    } catch {
      setDescuentoError('No se pudo verificar el código. Intentá de nuevo.')
    } finally {
      setValidandoCodigo(false)
    }
  }

  const quitarDescuento = () => {
    setDescuento(null)
    setCodigoInput('')
    setDescuentoError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (items.length === 0) return

    if (form.dni && !validarDNI(form.dni)) {
      setError('El DNI debe tener 7 u 8 dígitos numéricos, sin puntos ni espacios.')
      return
    }

    if (!envioSeleccionado) {
      setError('Por favor calculá y seleccioná una opción de envío antes de continuar.')
      return
    }

    setLoading(true)

    try {
      const orderItems = items.map(({ producto, cantidad }) => ({
        id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad,
        imagen_url: producto.imagen_url,
      }))

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: orderItems,
          comprador: form,
          codigo_descuento: descuento?.codigo ?? null,
          primer_compra: primerCompraDescuento,
          envio_tipo: envioSeleccionado?.modalidad ?? null,
          envio_nombre: envioSeleccionado?.nombre ?? null,
          // envio_costo NO se envía: el servidor lo recalcula desde la config.
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al procesar el pedido')
        return
      }

      window.location.href = data.initPoint
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <span className="text-6xl block mb-4">🛒</span>
        <h1 className="text-2xl font-bold text-brand-text mb-2">Tu carrito está vacío</h1>
        <p className="text-brand-text-muted mb-8">¡Explorá nuestros productos y encontrá algo que te guste!</p>
        <Link
          href="/productos"
          className="bg-brand-purple hover:bg-brand-purple-dark text-white font-semibold px-8 py-3 rounded-2xl transition-colors"
        >
          Ir al catálogo
        </Link>
      </div>
    )
  }

  // Card con resumen de datos del usuario logueado
  const DatosGuardadosCard = () => (
    <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white">Datos de contacto</h2>
        <button
          type="button"
          onClick={() => setEditandoDatos(true)}
          className="text-xs text-brand-purple hover:text-brand-purple-light transition-colors"
        >
          Editar
        </button>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        <p className="text-brand-text font-medium">{form.nombre}</p>
        <p className="text-brand-text-muted">{form.email}</p>
        {form.telefono && <p className="text-brand-text-muted">{form.telefono}</p>}
        {form.dni && <p className="text-brand-text-muted">DNI {form.dni}</p>}
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-brand-text mb-8">Finalizar compra</h1>

      {/* Banner primera compra */}
      {primerCompraDescuento && (
        <div className="mb-6 flex items-center gap-3 bg-brand-purple/10 border border-brand-purple/30 rounded-2xl px-5 py-4">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="text-sm font-semibold text-brand-text">¡Descuento de primera compra aplicado!</p>
            <p className="text-xs text-brand-text-muted">10% off sobre el subtotal — acumulable con códigos de descuento.</p>
          </div>
          <span className="ml-auto font-bold text-green-400 text-sm whitespace-nowrap">− {formatPrecio(descuentoPrimerCompra)}</span>
        </div>
      )}

      {/* Banner registro (para usuarios sin cuenta) */}
      {!user && (
        <div className="mb-6 flex items-center gap-3 bg-brand-bg-soft border border-brand-border rounded-2xl px-5 py-4">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="text-sm font-semibold text-brand-text">¿Sabías que podés registrarte y obtener 10% off?</p>
            <p className="text-xs text-brand-text-muted">Creá tu cuenta y el descuento se aplica automáticamente.</p>
          </div>
          <Link
            href="/cuenta/registro"
            className="ml-auto text-xs bg-brand-purple hover:bg-brand-purple-light text-white font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
          >
            Registrarme
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Datos de contacto: resumen (logueado) o formulario completo */}
          {perfilCargado && !editandoDatos && !!form.dni ? (
            <DatosGuardadosCard />
          ) : (
            <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">Datos de contacto</h2>
                {perfilCargado && (
                  <button
                    type="button"
                    onClick={() => setEditandoDatos(false)}
                    className="text-xs text-brand-text-muted hover:text-brand-text transition-colors"
                  >
                    ✕ Cancelar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="nombre" className="block text-sm font-medium text-brand-text-muted mb-1">Nombre completo *</label>
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    required
                    value={form.nombre}
                    onChange={handleChange}
                    className="input-dark"
                    placeholder="Juan García"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-brand-text-muted mb-1">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="input-dark"
                    placeholder="juan@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="telefono" className="block text-sm font-medium text-brand-text-muted mb-1">Teléfono *</label>
                  <input
                    type="tel"
                    id="telefono"
                    name="telefono"
                    required
                    value={form.telefono}
                    onChange={handleChange}
                    className="input-dark"
                    placeholder="11 1234-5678"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <label htmlFor="dni" className="text-sm font-medium text-brand-text-muted">DNI *</label>
                    <div className="relative">
                      <button
                        type="button"
                        onMouseEnter={() => setDniTooltip(true)}
                        onMouseLeave={() => setDniTooltip(false)}
                        onClick={() => setDniTooltip(v => !v)}
                        className="w-4 h-4 rounded-full bg-brand-border text-brand-text-muted text-[10px] font-bold flex items-center justify-center hover:bg-brand-purple hover:text-white transition-colors"
                        aria-label="¿Por qué necesitamos tu DNI?"
                      >
                        ?
                      </button>
                      {dniTooltip && (
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-30 w-64 bg-brand-bg-card border border-brand-border text-brand-text-muted text-xs rounded-xl px-3 py-2.5 shadow-lg leading-relaxed">
                          Necesitamos tu DNI para emitir la factura electrónica de tu compra, tal como lo exige ARCA.
                        </div>
                      )}
                    </div>
                  </div>
                  <input
                    id="dni"
                    type="text"
                    name="dni"
                    required
                    value={form.dni ?? ''}
                    onChange={e => { handleChange(e); setDniError('') }}
                    onBlur={e => {
                      const v = e.target.value
                      if (v && !validarDNI(v)) setDniError('DNI inválido. Ingresá 7 u 8 dígitos sin puntos.')
                      else setDniError('')
                    }}
                    className={`input-dark ${dniError ? 'border-red-500' : ''}`}
                    placeholder="12345678"
                    maxLength={10}
                    inputMode="numeric"
                    pattern="[0-9]{7,8}"
                    title="Ingresá tu DNI (7 u 8 dígitos, sin puntos)"
                  />
                  {dniError && <p className="text-red-400 text-xs mt-1">{dniError}</p>}
                </div>
              </div>

              {perfilCargado && form.dni && (
                <button
                  type="button"
                  onClick={() => setEditandoDatos(false)}
                  className="w-full text-sm text-brand-purple border border-brand-purple/30 hover:bg-brand-purple/10 py-2 rounded-xl transition-colors"
                >
                  Usar datos guardados
                </button>
              )}
              {perfilCargado && !form.dni && (
                <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-2.5">
                  ⚠ Necesitamos tu DNI para emitir la factura electrónica de tu compra.
                </p>
              )}
            </div>
          )}

          {/* Dirección de envío — siempre visible */}
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-brand-text">Dirección de envío</h2>
            {user && (
              <div className="mb-2">
                <p className="text-xs text-brand-text-muted mb-2">Tus direcciones guardadas:</p>
                <DireccionesManager
                  userId={user.id}
                  compact
                  onSelect={aplicarDireccion}
                  seleccionadaId={dirSeleccionadaId}
                />
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-brand-border" />
                  <span className="text-xs text-brand-text-muted">o ingresá una dirección nueva</span>
                  <div className="flex-1 h-px bg-brand-border" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="direccion" className="block text-sm font-medium text-brand-text-muted mb-1">Calle y número *</label>
                <input
                  type="text"
                  id="direccion"
                  name="direccion"
                  required
                  value={form.direccion}
                  onChange={handleChange}
                  className="input-dark"
                  placeholder="Av. Corrientes 1234, Piso 2"
                />
              </div>

              <div>
                <label htmlFor="ciudad" className="block text-sm font-medium text-brand-text-muted mb-1">Ciudad *</label>
                <input
                  type="text"
                  id="ciudad"
                  name="ciudad"
                  required
                  value={form.ciudad}
                  onChange={handleChange}
                  className="input-dark"
                  placeholder="Buenos Aires"
                />
              </div>

              <div>
                <label htmlFor="codigo_postal" className="block text-sm font-medium text-brand-text-muted mb-1">Código postal *</label>
                <input
                  type="text"
                  id="codigo_postal"
                  name="codigo_postal"
                  required
                  value={form.codigo_postal}
                  onChange={handleChange}
                  className="input-dark"
                  placeholder="C1414"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="provincia" className="block text-sm font-medium text-brand-text-muted mb-1">Provincia *</label>
                <select
                  id="provincia"
                  name="provincia"
                  required
                  value={form.provincia}
                  onChange={handleChange}
                  className="input-dark"
                >
                  <option value="">Seleccioná tu provincia</option>
                  {['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Envío */}
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Envío</h2>
              <button
                type="button"
                onClick={calcularEnvio}
                disabled={calculandoEnvio || !puedeCalcularEnvio}
                className="text-sm bg-brand-purple hover:bg-brand-purple-light disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {calculandoEnvio ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Calculando...
                  </>
                ) : (
                  envioCalculado ? '↻ Recalcular' : 'Calcular costo'
                )}
              </button>
            </div>

            {!puedeCalcularEnvio && !envioCalculado && (
              <p className="text-xs text-brand-text-muted">
                Seleccioná tu provincia para calcular el costo de envío.
              </p>
            )}

            {envioError && (
              <p className="text-red-400 text-sm flex items-center gap-1.5">
                <span>⚠</span> {envioError}
              </p>
            )}

            {envioCalculado && envioOpciones.length === 0 && (
              <p className="text-brand-text-muted text-sm">
                No hay opciones de envío disponibles. Contactanos por WhatsApp.
              </p>
            )}

            {envioOpciones.length > 0 && (
              <div className="space-y-2">
                {envioOpciones.map((op) => (
                  <label
                    key={op.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      envioSeleccionado?.id === op.id
                        ? 'border-brand-purple bg-brand-purple/10'
                        : 'border-brand-border hover:border-brand-purple/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="envio"
                      value={op.id}
                      checked={envioSeleccionado?.id === op.id}
                      onChange={() => setEnvioSeleccionado(op)}
                      className="accent-brand-purple"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white capitalize">{op.nombre}</p>
                      {op.tiempo_estimado && (
                        <p className="text-xs text-brand-text-muted">{op.tiempo_estimado}</p>
                      )}
                      {op.descripcion && (
                        <p className="text-xs text-brand-text-muted">{op.descripcion}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-brand-neon whitespace-nowrap">
                      {op.precio != null ? formatPrecio(op.precio) : 'A confirmar'}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Código de descuento */}
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-4">¿Tenés un código de descuento?</h2>

            {descuento ? (
              <div className="flex items-center justify-between bg-green-900/25 border border-green-500/40 rounded-xl px-4 py-3">
                <div>
                  <p className="text-green-300 font-semibold text-sm">✅ {descuento.mensaje}</p>
                  <p className="text-green-400/70 text-xs mt-0.5 font-mono tracking-widest">{descuento.codigo}</p>
                </div>
                <button
                  type="button"
                  onClick={quitarDescuento}
                  className="text-brand-text-light hover:text-red-400 text-xs transition-colors ml-4 shrink-0"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={codigoInput}
                  onChange={e => {
                    setCodigoInput(e.target.value.toUpperCase())
                    setDescuentoError('')
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aplicarCodigo() } }}
                  placeholder="Ingresá tu código"
                  maxLength={50}
                  className="input-dark flex-1 uppercase tracking-widest font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={aplicarCodigo}
                  disabled={validandoCodigo || !codigoInput.trim()}
                  className="bg-brand-purple hover:bg-brand-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-xl transition-colors text-sm whitespace-nowrap"
                >
                  {validandoCodigo ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Aplicar'
                  )}
                </button>
              </div>
            )}

            {descuentoError && (
              <p className="text-red-400 text-sm mt-3 flex items-center gap-1.5">
                <span>⚠</span> {descuentoError}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-purple hover:bg-brand-purple-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-all hover:shadow-soft text-base flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              envioSeleccionado
                ? `Pagar ${formatPrecio(totalFinal)} con Mercado Pago`
                : 'Seleccioná una opción de envío para continuar'
            )}
          </button>

          <p className="text-center text-xs text-brand-text-light">
            Serás redirigido a Mercado Pago para completar el pago de forma segura
          </p>
        </form>

        {/* Resumen del pedido */}
        <div className="space-y-4">
          <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-4">Resumen del pedido</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {items.map(({ producto, cantidad, varianteId }) => (
                <div key={`${producto.id}::${varianteId ?? ''}`} className="flex gap-3 items-center">
                  <div className="relative w-12 h-12 bg-brand-bg-soft rounded-lg overflow-hidden flex-shrink-0">
                    {producto.imagen_url ? (
                      <Image
                        src={producto.imagen_url}
                        alt={producto.nombre}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-text line-clamp-1">{producto.nombre}</p>
                    <p className="text-xs text-brand-text-muted">x{cantidad}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-brand-text whitespace-nowrap">
                      {formatPrecio(producto.precio * cantidad)}
                    </span>
                    <button
                      onClick={() => removeItem(producto.id, varianteId)}
                      className="text-brand-text-light hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-brand-border mt-4 pt-4 space-y-2">
              <div className="flex justify-between items-center text-sm text-brand-text-muted">
                <span>Subtotal</span>
                <span>{formatPrecio(subtotal)}</span>
              </div>

              {descuento && (
                <div className="flex justify-between items-center text-sm text-green-400">
                  <span className="flex items-center gap-1">
                    🏷️ Descuento
                    <span className="text-xs font-mono text-green-500/70 ml-1">({descuento.codigo})</span>
                  </span>
                  <span className="font-semibold">− {formatPrecio(descuento.descuento_monto)}</span>
                </div>
              )}

              {primerCompraDescuento && (
                <div className="flex justify-between items-center text-sm text-green-400">
                  <span className="flex items-center gap-1">
                    🎁 Primera compra (10%)
                  </span>
                  <span className="font-semibold">− {formatPrecio(descuentoPrimerCompra)}</span>
                </div>
              )}

              {envioSeleccionado && (
                <div className="flex justify-between items-center text-sm text-brand-text-muted">
                  <span className="flex items-center gap-1">
                    🚚 Envío
                    <span className="text-xs text-brand-text-light ml-1">({envioSeleccionado.nombre})</span>
                  </span>
                  <span className="font-semibold text-brand-text">
                    {envioSeleccionado.precio != null
                      ? formatPrecio(envioSeleccionado.precio)
                      : 'A confirmar'}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-brand-border">
                <span className="font-semibold text-brand-text">Total</span>
                <span className="font-bold text-xl text-brand-text">
                  {formatPrecio(totalFinal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CarritoPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-20 flex justify-center"><div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" /></div>}>
      <CarritoContent />
    </Suspense>
  )
}
