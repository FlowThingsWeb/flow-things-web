/**
 * Los códigos postales del envío en el día.
 *
 * La tabla vive comprimida en rangos para que quepa en una pantalla, y la
 * compresión es justo el lugar donde un error no se ve: un rango de más cubre
 * un barrio al que el cadete no llega —y le promete entrega en el día a un
 * comprador— y un rango de menos le cobra tarifa de correo a alguien que está
 * a diez cuadras.
 *
 * Lo que se verifica:
 *
 *   1. Cuántos CP cubre cada zona. Son los 781 de la lista del cadete, y los
 *      cuatro números tienen que dar exacto: si una zona queda con uno más o
 *      uno menos, la compresión se movió.
 *   2. Que no cubra NADA de más. Se barre el rango 1000–9999 entero.
 *   3. Los CP que aparecen de verdad en las ventas, con los formatos en que
 *      llegan: el CPA de ML (C1425DKE), el de provincia (B1640XAB) y el viejo
 *      de cuatro dígitos.
 *   4. Los bordes de cada rango, que es donde se equivoca un off-by-one.
 *
 * La lista completa, localidad por localidad, está en el CRM —tabla
 * `envio_localidades`, cargada por `20261029_envio_zonas.sql`—. Acá no se
 * duplica: sí los totales, que son lo que ata las dos mitades.
 *
 * Correr con:  npx tsx __test-zonas-cadeteria.mts
 */
import { getZonaCadeteria, type ZonaCadeteria } from './lib/zonas-cadeteria'

let ok = 0
const fallos: string[] = []
const es = <T,>(nombre: string, dio: T, esperado: T) => {
  if (JSON.stringify(dio) === JSON.stringify(esperado)) ok++
  else fallos.push(`${nombre}: dio ${JSON.stringify(dio)}, esperaba ${JSON.stringify(esperado)}`)
}

// ── 1 y 2. Cuántos cubre cada zona, barriendo todos los CP que existen ──
const cuenta: Record<string, number> = { caba: 0, zona1: 0, zona2: 0, zona3: 0 }
for (let cp = 1000; cp <= 9999; cp++) {
  const z = getZonaCadeteria(String(cp))
  if (z) cuenta[z]++
}
es('CABA cubre 500 CP (1000 a 1499)', cuenta.caba, 500)
es('Zona 1 cubre 76 CP', cuenta.zona1, 76)
es('Zona 2 cubre 104 CP', cuenta.zona2, 104)
es('Zona 3 cubre 101 CP', cuenta.zona3, 101)
es('en total, 781 y ni uno más', cuenta.caba + cuenta.zona1 + cuenta.zona2 + cuenta.zona3, 781)

// ── 3. Los CP de las ventas reales, como llegan ──
const reales: [string, ZonaCadeteria | null, string][] = [
  ['C1425DKE', 'caba', 'Palermo — CPA, es lo que manda Mercado Libre'],
  ['C1405', 'caba', 'venta #260'],
  ['1426', 'caba', 'venta #237, sin letras'],
  ['1832', 'zona1', 'Lomas de Zamora — la venta Flex #261'],
  ['B1640XAB', 'zona1', 'Martínez — venta #243'],
  ['1824', 'zona1', 'Lanús — venta #250'],
  ['B1602', 'zona1', 'Florida — venta #219'],
  ['B1881', 'zona2', 'Quilmes — venta #165'],
  ['1722', 'zona2', 'Merlo'],
  ['B1923', 'zona3', 'Berisso — venta #200'],
  ['B1896', 'zona3', 'City Bell — venta #188'],
  ['B1900', 'zona3', 'La Plata'],
  ['2400', null, 'San Francisco, Córdoba — venta #258'],
  ['S3000', null, 'Santa Fe — venta #246'],
  ['X2553', null, 'Justiniano Posse — venta #245'],
  ['T4000', null, 'Tucumán — venta #218'],
  ['V9410', null, 'Ushuaia — venta #186'],
  ['B2700', null, 'Pergamino — venta #175, provincia pero fuera del servicio'],
  ['B7150', null, 'Ayacucho — venta #89'],
]
for (const [cp, esperado, quien] of reales) es(`${cp} (${quien})`, getZonaCadeteria(cp), esperado)

// ── 3b. Lo que no es un CP ──
es('vacío', getZonaCadeteria(''), null)
es('null', getZonaCadeteria(null), null)
es('sin dígitos', getZonaCadeteria('sin dato'), null)
// Cinco dígitos no se recortan a cuatro: es un dato que no se entiende, y
// adivinar sería cobrarle a alguien la zona de otro.
es('cinco dígitos no se recortan', getZonaCadeteria('14256'), null)
es('tres dígitos', getZonaCadeteria('999'), null)

// ── 4. Los bordes, que es donde vive el off-by-one ──
es('999 está afuera de CABA', getZonaCadeteria('0999'), null)
es('1000 es el primero de CABA', getZonaCadeteria('1000'), 'caba')
es('1499 es el último de CABA', getZonaCadeteria('1499'), 'caba')
es('1500 ya no es CABA', getZonaCadeteria('1500'), null)
es('1601 es Isla Martín García, Zona 2', getZonaCadeteria('1601'), 'zona2')
es('1602 es Florida, Zona 1', getZonaCadeteria('1602'), 'zona1')
es('1608 es Troncos del Talar, Zona 2', getZonaCadeteria('1608'), 'zona2')
es('1609 es Boulogne, Zona 1', getZonaCadeteria('1609'), 'zona1')
// 1785 es Aldo Bonzi (Zona 2) y está pegado a los CP de Marcos Paz (Zona 3).
// Es el caso que obliga a enumerar y no a redondear por rango.
es('1785 es Aldo Bonzi, Zona 2', getZonaCadeteria('1785'), 'zona2')
es('1784 es Marcos Paz, Zona 3', getZonaCadeteria('1784'), 'zona3')
es('1786 no existe en la lista', getZonaCadeteria('1786'), null)
es('1787 vuelve a Marcos Paz', getZonaCadeteria('1787'), 'zona3')
es('7221 es Gobernador Udaondo, Zona 3', getZonaCadeteria('7221'), 'zona3')
es('7222 está afuera', getZonaCadeteria('7222'), null)


/* ────────────────────────── Cuándo llega ────────────────────────── */
import { entregaCadeteria, parsearFeriados } from './lib/zonas-cadeteria'

// Buenos Aires es UTC−3: 14:00Z son las 11 de la mañana de acá.
const ar = (iso: string) => new Date(iso)
const et = (iso: string, feriados: string[] = []) =>
  entregaCadeteria({ ahora: ar(iso), feriados }).etiqueta

// Jueves 29/10/2026.
es('11:00, antes del corte', et('2026-10-29T14:00:00Z'), 'Llega hoy')
es('09:00, antes del corte', et('2026-10-29T12:00:00Z'), 'Llega hoy')
// En la última hora la promesa se condiciona: el que lee 12:58 no llega a pagar.
es('12:01, última hora', et('2026-10-29T15:01:00Z'), 'Llega hoy si comprás antes de las 13')
es('12:59, última hora', et('2026-10-29T15:59:00Z'), 'Llega hoy si comprás antes de las 13')
// A las 13 en punto ya es tarde: el corte es "antes de las 13".
es('13:00 en punto', et('2026-10-29T16:00:00Z'), 'Llega mañana')
es('18:10, como entró la #261', et('2026-10-29T21:10:00Z'), 'Llega mañana')

// Viernes 30: después del corte cae sábado, y el sábado no reparte.
es('viernes 15:00 → lunes', et('2026-10-30T18:00:00Z'), 'Llega el lunes')
es('viernes 11:00 → hoy', et('2026-10-30T14:00:00Z'), 'Llega hoy')
// El sábado no reparte ni siquiera temprano.
es('sábado 10:00 → lunes', et('2026-10-31T13:00:00Z'), 'Llega el lunes')
es('domingo 10:00 → mañana', et('2026-11-01T13:00:00Z'), 'Llega mañana')

// Feriados: el martes 8/12/2026 no reparte.
es('lunes 7/12 tarde → el 9, miércoles', et('2026-12-07T18:00:00Z', ['2026-12-08']), 'Llega el miércoles')
es('el 8/12 a la mañana tampoco llega hoy', et('2026-12-08T13:00:00Z', ['2026-12-08']), 'Llega mañana')
// Dos feriados pegados a un fin de semana: el salto es de varios días.
es(
  'jueves 24/12 tarde con 25 y 28 feriados',
  et('2026-12-24T18:00:00Z', ['2026-12-25', '2026-12-28']),
  'Llega el martes',
)

/**
 * El huso es SIEMPRE el de Buenos Aires.
 *
 * 2026-10-29T16:30:00Z son las 13:30 de acá —ya pasó el corte— y las 18:30 en
 * Madrid. Si la cuenta saliera del reloj del visitante, a un comprador en
 * España se le prometería una entrega que ya no entra.
 */
es('13:30 de acá es tarde, mire quien mire', et('2026-10-29T16:30:00Z'), 'Llega mañana')
// Y 01:30Z del 30 son las 22:30 del 29 acá: sigue siendo jueves, y el jueves
// ya pasó su corte.
es('22:30 del jueves', et('2026-10-30T01:30:00Z'), 'Llega mañana')
// 03:30Z del 30 son las 00:30 del 30 acá: ya es viernes y todavía no son las 13.
es('00:30 del viernes', et('2026-10-30T03:30:00Z'), 'Llega hoy')

es('la fecha que devuelve', entregaCadeteria({ ahora: ar('2026-10-30T18:00:00Z') }).fecha, '2026-11-02')
es('hoy es hoy', entregaCadeteria({ ahora: ar('2026-10-29T14:00:00Z') }).hoy, true)
es('mañana no es hoy', entregaCadeteria({ ahora: ar('2026-10-29T18:00:00Z') }).hoy, false)

// Los feriados se escriben a mano, así que la lectura tiene que aguantar
// cualquier cosa sin tirar la cotización abajo.
es('feriados con espacios', parsearFeriados(' 2026-12-08 , 2026-12-25 '), ['2026-12-08', '2026-12-25'])
es('feriados vacío', parsearFeriados(''), [])
es('feriados null', parsearFeriados(null), [])
es('fecha mal escrita se ignora', parsearFeriados('8/12/2026, 2026-12-25'), ['2026-12-25'])

/* ───────── Que el envío y las franjas no se contradigan ───────── */
import { franjasEntrega, FERIADOS } from './lib/franjas-entrega'

/**
 * Las dos mitades del carrito tienen que decir el mismo día.
 *
 * "Cuándo llega" sale del corte del cadete (13) y "cuándo podés recibirlo" del
 * de despacho propio (16). Entre esas tres horas el carrito ofrecía una franja
 * de HOY justo al lado de un "Llega mañana": dos promesas distintas en la
 * misma pantalla, y la que el comprador elige es la que no se puede cumplir.
 *
 * Y los feriados tienen que salir de la misma lista. Cuando eran dos, el 23 de
 * noviembre —el 20, trasladado al lunes— quedaba sin franjas y con "Llega
 * hoy".
 */
const mismoDia = (iso: string) => {
  const ahora = new Date(iso)
  const e = entregaCadeteria({ ahora, feriados: FERIADOS })
  const primera = franjasEntrega(ahora, { horaCorte: 13 })[0]?.etiqueta ?? ''
  return { envioHoy: e.hoy, franjaHoy: /^Hoy/.test(primera), etiqueta: e.etiqueta, primera }
}
for (const [nombre, iso] of [
  ['jueves 11:00', '2026-10-29T14:00:00Z'],
  ['jueves 14:30, entre los dos cortes', '2026-10-29T17:30:00Z'],
  ['jueves 17:00', '2026-10-29T20:00:00Z'],
  ['lunes 23/11, feriado trasladado del 20', '2026-11-23T14:00:00Z'],
  ['domingo 6/12, con el 7 y el 8 feriados', '2026-12-06T14:00:00Z'],
] as const) {
  const r = mismoDia(iso)
  es(`${nombre}: el envío y la franja dicen lo mismo`, r.envioHoy, r.franjaHoy)
}
// El 23/11 no es "hoy" aunque sea lunes a la mañana: es feriado.
es(
  'el 23/11 no promete entrega',
  entregaCadeteria({ ahora: new Date('2026-11-23T14:00:00Z'), feriados: FERIADOS }).hoy,
  false,
)

console.log(`\n${ok} bien, ${fallos.length} mal`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length === 0 ? 0 : 1)
