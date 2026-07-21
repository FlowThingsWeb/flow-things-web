export interface Categoria {
  id: string
  nombre: string
  slug: string
  created_at: string
}

export interface Producto {
  id: string
  nombre: string
  slug: string
  sku: string | null
  descripcion: string | null
  precio: number
  precio_anterior: number | null
  stock: number
  categoria_id: string | null
  imagen_url: string | null
  imagenes: string[]
  activo: boolean
  /** true = lo desactivó el sistema por quedarse sin stock (se reactiva solo al reponer) */
  desactivado_por_stock?: boolean
  destacado: boolean
  created_at: string
  updated_at: string
  categorias?: Categoria
  variantes?: Variante[]
}

export interface Variante {
  id: string
  producto_id: string
  atributos: Record<string, string> // { "Color": "Rosa", "Talle": "M" }
  sku: string | null
  stock: number
  imagen_url: string | null
  imagenes: string[]
  activo: boolean
  /** true = la desactivó el sistema por quedarse sin stock (se reactiva sola al reponer) */
  desactivado_por_stock?: boolean
  created_at: string
}

export interface ItemCarrito {
  producto: Producto
  cantidad: number
  /** ID de la variante seleccionada. Cuando está presente, se usa junto con producto.id
   *  para generar una clave única en el carrito, evitando que dos variantes del mismo
   *  producto se solapen en el mismo slot. */
  varianteId?: string
}

export type EstadoOrden = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'

export interface DatosComprador {
  nombre: string
  email: string
  telefono: string
  direccion: string
  piso?: string | null
  departamento?: string | null
  ciudad: string
  provincia: string
  codigo_postal: string
  dni?: string
  // Datos de envío (guardados dentro de datos_comprador en la DB)
  envio_tipo?: string | null
  envio_nombre?: string | null
  envio_costo?: number
  // Datos de factura AFIP (persistidos tras emitir CAE)
  factura_cae?: string
  factura_nro?: number
  factura_fecha?: string
  factura_vto?: string
}

export interface Orden {
  id: string
  mp_preference_id: string | null
  mp_payment_id: string | null
  estado: EstadoOrden
  total: number
  items: ItemOrden[]
  datos_comprador: DatosComprador | null
  created_at: string
  updated_at: string
}

export interface ItemOrden {
  id: string
  nombre: string
  precio: number
  cantidad: number
  imagen_url: string | null
  /** Variante vendida. Null para productos sin variantes.
   *  Necesario para descontar el stock correcto y para informar al CRM. */
  variante_id?: string | null
  /** Snapshot del SKU y del nombre de la variante al momento de la compra.
   *  Los completa el servidor en /api/checkout — no se confía en el cliente.
   *  Son el puente para mapear la venta contra el CRM (canal tienda). */
  sku?: string | null
  variante_nombre?: string | null
}
