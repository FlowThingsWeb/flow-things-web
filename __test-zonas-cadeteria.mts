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

console.log(`\n${ok} bien, ${fallos.length} mal`)
for (const f of fallos) console.log(`  ✗ ${f}`)
process.exit(fallos.length === 0 ? 0 : 1)
