import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import ProductForm from '@/components/admin/ProductForm'

interface PageProps {
  searchParams: Promise<{ id?: string }>
}

export default async function NuevoProductoPage({ searchParams }: PageProps) {
  const params = await searchParams
  const isEdit = !!params.id

  const [categoriasResult, productoResult] = await Promise.all([
    supabaseAdmin.from('categorias').select('*').order('nombre'),
    isEdit
      ? supabaseAdmin.from('productos').select('*').eq('id', params.id).single()
      : Promise.resolve({ data: null }),
  ])

  const categorias = categoriasResult.data || []
  const producto = productoResult.data

  if (isEdit && !producto) {
    return (
      <div className="p-8">
        <p className="text-brand-text-muted">Producto no encontrado</p>
        <Link href="/admin/productos" className="text-brand-purple text-sm mt-2 inline-block hover:underline">
          Volver
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/productos"
          className="text-brand-text-muted hover:text-brand-purple transition-colors"
        >
          ← Volver
        </Link>
        <div className="w-px h-4 bg-brand-border" />
        <h1 className="text-2xl font-bold text-brand-text">
          {isEdit ? 'Editar producto' : 'Nuevo producto'}
        </h1>
      </div>

      <ProductForm
        producto={producto || undefined}
        categorias={categorias}
        mode={isEdit ? 'edit' : 'create'}
      />
    </div>
  )
}
