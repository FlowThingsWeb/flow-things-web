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
  created_at: string
}

export interface ItemCarrito {
  producto: Producto
  cantidad: number
}

export type EstadoOrden = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'

export interface DatosComprador {
  nombre: string
  email: string
  telefono: string
  direccion: string
  ciudad: string
  provincia: string
  codigo_postal: string
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
}
