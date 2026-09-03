/**
 * Filtros de la grilla: subcategoría, marca, precio, disponibilidad y ofertas.
 *
 * Todo se navega con links, no con estado de cliente. Tres razones: la URL
 * queda compartible ("mirá estos peluches hasta $30.000"), el botón Atrás del
 * navegador funciona como la gente espera, y Google puede seguir los enlaces
 * de subcategoría, que son los que tienen palabras que alguien busca.
 *
 * Cada opción muestra cuántos productos daría. Una opción que daría cero no
 * se ofrece: un filtro que lleva a una grilla vacía es peor que no tenerlo.
 */
import Link from 'next/link'
import type { Filtros, Subcategoria } from '@/lib/catalogo'

/** Tramos de precio. Fijos y en números redondos: se leen de un vistazo. */
export const TRAMOS_PRECIO: { etiqueta: string; min?: number; max?: number }[] = [
  { etiqueta: 'Hasta $20.000', max: 20000 },
  { etiqueta: '$20.000 a $40.000', min: 20000, max: 40000 },
  { etiqueta: '$40.000 a $70.000', min: 40000, max: 70000 },
  { etiqueta: 'Más de $70.000', min: 70000 },
]

type Props = {
  /** Ruta de la categoría, sin subcategoría: /categoria/jugueteria */
  basePath: string
  subcategorias: Subcategoria[]
  conteoSub: Map<string, number>
  conteoMarca: Map<string, number>
  filtros: Filtros
  orden?: string
}

/**
 * Un cambio sobre los filtros vigentes.
 *
 * `sub: null` es distinto de omitirlo: null significa "sacá la subcategoría",
 * omitirlo significa "dejá la que está".
 */
export type CambioFiltro = Omit<Partial<Filtros>, 'sub'> & { sub?: string | null }

/** Arma una URL conservando los filtros vigentes y cambiando uno solo. */
export function linkCon(
  basePath: string,
  filtros: Filtros,
  orden: string | undefined,
  cambio: CambioFiltro,
): string {
  const f: Filtros = { ...filtros, ...cambio, sub: undefined }
  // La subcategoría es un segmento de la ruta, no un parámetro: /categoria/
  // jugueteria/peluches posiciona por "peluches", ?sub=peluches no.
  const sub = cambio.sub === null ? undefined : (cambio.sub ?? filtros.sub)
  const ruta = sub ? `${basePath}/${sub}` : basePath

  const sp = new URLSearchParams()
  if (f.q) sp.set('q', f.q)
  if (f.marca) sp.set('marca', f.marca)
  if (f.min != null) sp.set('min', String(f.min))
  if (f.max != null) sp.set('max', String(f.max))
  if (f.disponible) sp.set('disponible', '1')
  if (f.oferta) sp.set('oferta', '1')
  if (orden) sp.set('orden', orden)
  // Al cambiar un filtro se vuelve a la página 1: quedarse en la 4 de un
  // resultado que ahora tiene 2 páginas muestra una grilla vacía.
  return sp.toString() ? `${ruta}?${sp.toString()}` : ruta
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-brand-border pt-4 mt-4 first:border-0 first:pt-0 first:mt-0">
      <h3 className="font-semibold text-white text-sm mb-3">{titulo}</h3>
      {children}
    </div>
  )
}

function Opcion({
  href, activa, children, cuenta,
}: {
  href: string
  activa: boolean
  children: React.ReactNode
  cuenta?: number
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={activa ? 'true' : undefined}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          activa
            ? 'bg-brand-purple text-white font-medium'
            : 'text-brand-text-muted hover:bg-brand-bg-soft hover:text-white'
        }`}
      >
        <span>{children}</span>
        {cuenta != null && (
          <span className={activa ? 'text-white/70 text-xs' : 'text-brand-text-light text-xs'}>
            {cuenta}
          </span>
        )}
      </Link>
    </li>
  )
}

export default function FiltrosCatalogo({
  basePath, subcategorias, conteoSub, conteoMarca, filtros, orden,
}: Props) {
  const link = (cambio: CambioFiltro) => linkCon(basePath, filtros, orden, cambio)

  // Sólo las subcategorías que tienen algo. Las sembradas para el futuro
  // —carpetas, mochilas— no aparecen hasta que entre el primer producto.
  const subsConProductos = subcategorias.filter((s) => (conteoSub.get(s.slug) ?? 0) > 0)

  const marcas = [...conteoMarca.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))

  const hayFiltros =
    !!filtros.sub || !!filtros.marca || filtros.min != null || filtros.max != null ||
    !!filtros.disponible || !!filtros.oferta

  const tramoActivo = (t: { min?: number; max?: number }) =>
    filtros.min === t.min && filtros.max === t.max

  return (
    <div className="bg-brand-bg-card border border-brand-border rounded-2xl p-5">
      {hayFiltros && (
        <Link
          href={linkCon(basePath, { q: filtros.q }, orden, { sub: null })}
          className="inline-block mb-4 text-xs text-brand-purple hover:underline"
        >
          ✕ Limpiar filtros
        </Link>
      )}

      {subsConProductos.length > 0 && (
        <Grupo titulo="Tipo de producto">
          <ul className="space-y-1">
            <Opcion href={link({ sub: null })} activa={!filtros.sub}>
              Todo
            </Opcion>
            {subsConProductos.map((s) => (
              <Opcion
                key={s.id}
                href={link({ sub: s.slug })}
                activa={filtros.sub === s.slug}
                cuenta={conteoSub.get(s.slug)}
              >
                {s.nombre}
              </Opcion>
            ))}
          </ul>
        </Grupo>
      )}

      {marcas.length > 1 && (
        <Grupo titulo="Marca">
          <ul className="space-y-1 max-h-72 overflow-y-auto">
            <Opcion href={link({ marca: undefined })} activa={!filtros.marca}>
              Todas
            </Opcion>
            {marcas.map(([marca, n]) => (
              <Opcion
                key={marca}
                href={link({ marca })}
                activa={filtros.marca === marca}
                cuenta={n}
              >
                {marca}
              </Opcion>
            ))}
          </ul>
        </Grupo>
      )}

      <Grupo titulo="Precio">
        <ul className="space-y-1">
          <Opcion
            href={link({ min: undefined, max: undefined })}
            activa={filtros.min == null && filtros.max == null}
          >
            Cualquiera
          </Opcion>
          {TRAMOS_PRECIO.map((t) => (
            <Opcion
              key={t.etiqueta}
              href={link({ min: t.min, max: t.max })}
              activa={tramoActivo(t)}
            >
              {t.etiqueta}
            </Opcion>
          ))}
        </ul>
      </Grupo>

      <Grupo titulo="Mostrar">
        <ul className="space-y-1">
          <Opcion
            href={link({ disponible: filtros.disponible ? undefined : true })}
            activa={!!filtros.disponible}
          >
            Sólo disponibles
          </Opcion>
          <Opcion
            href={link({ oferta: filtros.oferta ? undefined : true })}
            activa={!!filtros.oferta}
          >
            Sólo ofertas
          </Opcion>
        </ul>
      </Grupo>
    </div>
  )
}
