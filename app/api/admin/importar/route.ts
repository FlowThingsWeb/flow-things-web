import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import * as XLSX from 'xlsx'

// ----------------------------------------------------------------
// GET ?template=1 — descarga la plantilla Excel
// ----------------------------------------------------------------
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get('template') !== '1') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const wb = XLSX.utils.book_new()

  // Instrucciones
  const instrucciones = [
    ['INSTRUCCIONES'],
    [''],
    ['• Cada fila es una variante. Si el producto no tiene variantes, llenás solo una fila.'],
    ['• Para un producto con variantes, repetís el mismo SKU en varias filas (una por combinación).'],
    ['• Los campos obligatorios son: nombre, sku, precio, categoria.'],
    ['• Si hay variantes: completá atributo_1_tipo, atributo_1_valor y variante_sku.'],
    ['• Categorías disponibles: libreria, jugueteria, utiles-escolares, juegos-de-mesa'],
    ['• destacado: SI o NO'],
    [''],
    ['EJEMPLO — Mochila con Color + Talle:'],
    ['nombre', 'sku', 'descripcion', 'precio', 'stock', 'categoria', 'destacado',
      'atributo_1_tipo', 'atributo_1_valor', 'atributo_2_tipo', 'atributo_2_valor',
      'variante_sku', 'variante_stock'],
    ['Mochila Escolar', 'MOC-001', 'Mochila resistente 20L', 5000, '', 'libreria', 'SI', 'Color', 'Rosa', 'Talle', 'M', 'MOC-001-ROS-M', 10],
    ['Mochila Escolar', 'MOC-001', '', '', '', '', '', 'Color', 'Rosa', 'Talle', 'XL', 'MOC-001-ROS-XL', 8],
    ['Mochila Escolar', 'MOC-001', '', '', '', '', '', 'Color', 'Azul', 'Talle', 'M', 'MOC-001-AZU-M', 12],
    [''],
    ['EJEMPLO — Producto sin variantes:'],
    ['nombre', 'sku', 'descripcion', 'precio', 'stock', 'categoria', 'destacado', ...Array(6).fill('')],
    ['Pelota de Fútbol N5', 'PEL-001', 'Pelota oficial', 3000, 50, 'jugueteria', 'NO', ...Array(6).fill('')],
  ]
  const wsInfo = XLSX.utils.aoa_to_sheet(instrucciones)
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Instrucciones')

  // Plantilla vacía
  const headers = [
    'nombre', 'sku', 'descripcion', 'precio', 'stock', 'categoria', 'destacado',
    'atributo_1_tipo', 'atributo_1_valor',
    'atributo_2_tipo', 'atributo_2_valor',
    'atributo_3_tipo', 'atributo_3_valor',
    'variante_sku', 'variante_stock',
  ]
  const wsData = XLSX.utils.aoa_to_sheet([headers])
  XLSX.utils.book_append_sheet(wb, wsData, 'Productos')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_productos_flow_things.xlsx"',
    },
  })
}

// ----------------------------------------------------------------
// POST — parsear Excel y (si no es preview) importar a Supabase
// ----------------------------------------------------------------

interface FilaExcel {
  nombre?: string
  sku?: string
  descripcion?: string
  precio?: number | string
  stock?: number | string
  categoria?: string
  destacado?: string
  atributo_1_tipo?: string
  atributo_1_valor?: string
  atributo_2_tipo?: string
  atributo_2_valor?: string
  atributo_3_tipo?: string
  atributo_3_valor?: string
  variante_sku?: string
  variante_stock?: number | string
}

interface FilaParsed {
  nombre: string
  sku: string
  descripcion: string
  precio: number
  stock: number
  categoria: string
  destacado: boolean
  atributos: Record<string, string>
  variante_sku?: string
  variante_stock: number
  _fila: number
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function parseFilas(rows: FilaExcel[]): { filas: FilaParsed[]; errores: { fila: number; mensaje: string }[] } {
  const filas: FilaParsed[] = []
  const errores: { fila: number; mensaje: string }[] = []

  // Estado del último producto "cabecera" — se propaga a las filas de variantes siguientes
  // que comparten el mismo SKU y solo completan los campos de variante.
  let ultimoProducto: {
    nombre: string
    sku: string
    descripcion: string
    precio: number
    stock: number
    categoria: string
    destacado: boolean
  } | null = null

  rows.forEach((row, idx) => {
    const fila = idx + 2 // +2 por header + 1-index

    const nombre = String(row.nombre || '').trim()
    const sku    = String(row.sku    || '').trim()
    const precioRaw = parseFloat(String(row.precio || '0'))
    const tieneNombre = nombre !== ''
    const tienePrecio = !isNaN(precioRaw) && precioRaw > 0

    // Atributos de variante
    const atributos: Record<string, string> = {}
    for (let i = 1; i <= 3; i++) {
      const tipo  = String((row as any)[`atributo_${i}_tipo`]  || '').trim()
      const valor = String((row as any)[`atributo_${i}_valor`] || '').trim()
      if (tipo && valor) atributos[tipo] = valor
    }
    const tieneAtributos = Object.keys(atributos).length > 0
    const variante_sku   = String(row.variante_sku || '').trim()

    // ── Fila de continuación (variante del producto anterior):
    //    mismo SKU que la cabecera, sin precio propio, solo aporta atributos y variante_sku
    if (
      !tienePrecio &&
      ultimoProducto !== null &&
      (sku === ultimoProducto.sku || (!sku && tieneAtributos))
    ) {
      if (tieneAtributos && !variante_sku) {
        errores.push({ fila, mensaje: `Variante sin variante_sku (SKU: ${ultimoProducto.sku})` })
        return
      }
      filas.push({
        ...ultimoProducto,
        atributos,
        variante_sku: variante_sku || undefined,
        variante_stock: parseInt(String(row.variante_stock || '0')) || 0,
        _fila: fila,
      })
      return
    }

    // ── Fila cabecera (nuevo producto)
    if (!tieneNombre) { errores.push({ fila, mensaje: 'Falta el nombre' }); return }
    if (!sku)         { errores.push({ fila, mensaje: 'Falta el SKU' });    return }
    if (!tienePrecio) { errores.push({ fila, mensaje: `Precio inválido: ${row.precio}` }); return }

    if (tieneAtributos && !variante_sku) {
      errores.push({ fila, mensaje: `Producto con atributos pero sin variante_sku` })
      return
    }

    ultimoProducto = {
      nombre,
      sku,
      descripcion: String(row.descripcion || '').trim(),
      precio: precioRaw,
      stock: parseInt(String(row.stock || '0')) || 0,
      categoria: String(row.categoria || '').trim().toLowerCase(),
      destacado: String(row.destacado || '').trim().toUpperCase() === 'SI',
    }

    filas.push({
      ...ultimoProducto,
      atributos,
      variante_sku: variante_sku || undefined,
      variante_stock: parseInt(String(row.variante_stock || row.stock || '0')) || 0,
      _fila: fila,
    })
  })

  return { filas, errores }
}

export async function POST(req: NextRequest) {
  // Auth check
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  // Verificar env vars (detecta si faltan en Vercel)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      error: `Variables de entorno faltantes en Vercel: ${!supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL ' : ''}${!supabaseKey ? 'SUPABASE_SERVICE_ROLE_KEY' : ''}. Configurálas en Vercel → Settings → Environment Variables.`,
    }, { status: 500 })
  }

  // Crear cliente con env vars verificadas (evita problemas de inicialización en cold start)
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const formData = await req.formData()
  const file = formData.get('file') as Blob | null
  const isPreview = formData.get('preview') === '1'

  if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  let workbook: XLSX.WorkBook

  try {
    workbook = XLSX.read(arrayBuffer, { type: 'array' })
  } catch {
    return NextResponse.json({ error: 'Archivo Excel inválido' }, { status: 400 })
  }

  // Buscar hoja "Productos" o usar la primera
  const sheetName = workbook.SheetNames.includes('Productos')
    ? 'Productos'
    : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows: FilaExcel[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (rows.length === 0) {
    return NextResponse.json({ error: 'El Excel está vacío' }, { status: 400 })
  }

  const { filas, errores } = parseFilas(rows)

  // Preview — solo devolver filas parseadas
  if (isPreview) {
    return NextResponse.json({
      filas: filas.map(f => ({
        sku: f.sku,
        nombre: f.nombre,
        precio: f.precio,
        categoria: f.categoria,
        variante_sku: f.variante_sku,
        atributos: f.atributos,
        stock: f.variante_sku ? f.variante_stock : f.stock,
        error: errores.find(e => e.fila === f._fila)?.mensaje,
      })),
    })
  }

  // ---- IMPORTACIÓN ----

  // 2. Obtener categorías
  const { data: categorias } = await db.from('categorias').select('*')
  const catMap: Record<string, string> = {}
  for (const c of categorias || []) {
    catMap[c.slug] = c.id
    catMap[c.nombre.toLowerCase()] = c.id
  }

  // 3. Cargar TODOS los productos existentes (select * para máxima compatibilidad)
  const { data: productosExistentes, error: loadError } = await db
    .from('productos')
    .select('*')

  if (loadError) {
    return NextResponse.json({
      error: `No se pudo cargar productos: ${loadError.message} (code: ${loadError.code}) | URL: ${supabaseUrl}`,
    }, { status: 500 })
  }

  // Mapa sku → id y slug → id (match en memoria)
  const skuExistenteMap = new Map<string, string>()
  const slugExistenteMap = new Map<string, string>()
  for (const p of (productosExistentes ?? [])) {
    const skuVal = p['sku'] ?? p.sku
    if (skuVal) skuExistenteMap.set(String(skuVal), p.id)
    if (p.slug) slugExistenteMap.set(String(p.slug), p.id)
  }

  // 4. Agrupar filas por SKU
  const grupos = new Map<string, FilaParsed[]>()
  for (const fila of filas) {
    if (!grupos.has(fila.sku)) grupos.set(fila.sku, [])
    grupos.get(fila.sku)!.push(fila)
  }

  let insertados = 0
  let actualizados = 0
  const erroresImport: { fila: number; mensaje: string }[] = [...errores]

  for (const [skuBase, grupo] of grupos) {
    const primera = grupo[0]
    const tieneVariantes = grupo.some(f => f.variante_sku)
    const categoriaId = catMap[primera.categoria] || null
    const slug = slugify(primera.nombre) + '-' + slugify(skuBase)
    const stockTotal = tieneVariantes
      ? grupo.reduce((acc, f) => acc + f.variante_stock, 0)
      : primera.stock

    // Buscar por SKU primero, luego por slug (match en memoria)
    const existenteId = skuExistenteMap.get(skuBase) || slugExistenteMap.get(slug)

    let productoId: string

    if (existenteId) {
      const { error: updateError } = await db
        .from('productos')
        .update({
          nombre: primera.nombre,
          sku: skuBase,
          descripcion: primera.descripcion || null,
          precio: primera.precio,
          stock: stockTotal,
          categoria_id: categoriaId,
          destacado: primera.destacado,
          activo: true,
        })
        .eq('id', existenteId)

      if (updateError) {
        erroresImport.push({ fila: primera._fila, mensaje: `[SKU ${skuBase}] Update: ${updateError.message}` })
        continue
      }
      productoId = existenteId
      actualizados++
    } else {
      const { data: nuevo, error: insertError } = await db
        .from('productos')
        .insert({
          nombre: primera.nombre,
          slug,
          sku: skuBase,
          descripcion: primera.descripcion || null,
          precio: primera.precio,
          stock: stockTotal,
          categoria_id: categoriaId,
          destacado: primera.destacado,
          activo: true,
          imagenes: [],
        })
        .select('id')
        .single()

      if (insertError) {
        erroresImport.push({ fila: primera._fila, mensaje: `[SKU ${skuBase}] Insert: ${insertError.message}` })
        continue
      }
      productoId = nuevo.id
      insertados++
    }

    // Variantes
    if (tieneVariantes) {
      // Cargar variantes existentes del producto
      const { data: variantesExistentes } = await db
        .from('variantes')
        .select('id, sku')
        .eq('producto_id', productoId)

      const varSkuMap = new Map<string, string>()
      for (const v of variantesExistentes || []) {
        if (v.sku) varSkuMap.set(v.sku, v.id)
      }

      for (const fila of grupo) {
        if (!fila.variante_sku || Object.keys(fila.atributos).length === 0) continue

        const varId = varSkuMap.get(fila.variante_sku)
        if (varId) {
          await db
            .from('variantes')
            .update({ atributos: fila.atributos, stock: fila.variante_stock, activo: true })
            .eq('id', varId)
        } else {
          const { error: varError } = await db.from('variantes').insert({
            producto_id: productoId,
            atributos: fila.atributos,
            sku: fila.variante_sku,
            stock: fila.variante_stock,
            activo: true,
          })
          if (varError) {
            erroresImport.push({ fila: fila._fila, mensaje: `Variante ${fila.variante_sku}: ${varError.message}` })
          }
        }
      }
    }
  }

  return NextResponse.json({ insertados, actualizados, errores: erroresImport })
}
