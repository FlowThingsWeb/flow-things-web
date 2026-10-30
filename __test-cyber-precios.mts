/**
 * La cuenta de los precios del Cyber.
 *
 * Correr con: node --experimental-strip-types __test-cyber-precios.mts
 */
import assert from 'node:assert'
import {
  CONFIG_CYBER_DEFAULT,
  FACTORES_DEFAULT,
  aCentena,
  margenDe,
  simular,
  type ProductoCyber,
} from './lib/cyber-precios.ts'

let ok = 0
const t = (nombre: string, fn: () => void) => {
  try {
    fn()
    ok++
  } catch (e) {
    console.error(`✗ ${nombre}\n  ${(e as Error).message}`)
    process.exitCode = 1
  }
}

const cfg = CONFIG_CYBER_DEFAULT
const prod = (precio: number, extra: Partial<ProductoCyber> = {}): ProductoCyber => ({
  id: 'x',
  sku: 'SKU1',
  nombre: 'Producto',
  precio,
  stock: 5,
  ...extra,
})

t('el margen se mide sobre lo facturado, no sobre el costo', () => {
  // $10.000 de costo vendido a $13.000: "le gano 30%" sobre el costo, pero el
  // margen real es mucho menor, y con la comisión de cobro encima.
  const m = margenDe(13_000, 10_000, cfg)
  assert.ok(m < 0.12, `debería quedar bien abajo del 30%, dio ${(m * 100).toFixed(1)}%`)
  // 1 − 10.000/13.000 − 11,98% = 23,08% − 11,98%
  assert.ok(Math.abs(m - 0.111) < 0.001, `dio ${(m * 100).toFixed(2)}%`)
})

t('arriba del umbral el envío lo paga la tienda y el margen baja', () => {
  const conEnvio = margenDe(70_000, 30_000, cfg) // 70.000 ≥ 61.000 → paga envío
  const sinEnvio = margenDe(60_000, 30_000, cfg) // 60.000 < 61.000 → no paga
  assert.ok(sinEnvio > conEnvio, 'más barato puede dejar MÁS margen al cruzar el umbral')
})

t('+15% y −20% deja el precio 8% abajo, no 20%', () => {
  const f = simular(prod(10_000), 5_000, FACTORES_DEFAULT, cfg)
  assert.equal(f.precio_inflado, 11_500)
  assert.equal(f.precio_oferta, 9_200)
  // Lo que dice el cartel
  assert.ok(Math.abs(f.descuento_anunciado - 0.2) < 0.001)
  // Lo que el comprador ahorra de verdad
  assert.ok(Math.abs(f.descuento_real - 0.08) < 0.001)
})

t('el ahorro real se mide contra el precio ORIGINAL, no contra el inflado', () => {
  // Segundo paso: el producto ya está inflado a 11.500 y el original era 10.000.
  const f = simular(prod(11_500), 5_000, FACTORES_DEFAULT, cfg, 10_000)
  assert.equal(f.precio_oferta, 9_200)
  assert.ok(Math.abs(f.descuento_real - 0.08) < 0.001, 'contra 10.000, no contra 11.500')
  assert.equal(f.precio_original, 10_000)
})

t('inflar dos veces no compone: el original manda siempre', () => {
  const primera = simular(prod(10_000), 5_000, FACTORES_DEFAULT, cfg)
  const segunda = simular(prod(primera.precio_inflado), 5_000, FACTORES_DEFAULT, cfg, 10_000)
  assert.equal(segunda.precio_inflado, primera.precio_inflado, 'no puede llegar a 13.225')
})

t('al que cruzaría el umbral se lo deja clavado en el umbral', () => {
  // Caso real del catálogo: $64.900 bajaría a $59.700 y perdería envío gratis.
  const f = simular(prod(64_900), 30_000, FACTORES_DEFAULT, cfg)
  assert.equal(f.precio_oferta, 61_000, 'queda en el umbral, no abajo')
  assert.equal(f.clavado_al_umbral, true)
  assert.equal(f.pierde_envio_gratis, false)
  assert.equal(f.cuanto_mas_caro, 0)
})

t('sin cuidar el envío gratis, se ve el daño', () => {
  const f = simular(prod(64_900), 30_000, { ...FACTORES_DEFAULT, cuidar_envio_gratis: false }, cfg)
  assert.equal(f.pierde_envio_gratis, true)
  // Ahorra ~5.200 en el producto y paga 15.000 de flete: paga ~9.800 más.
  assert.ok(f.cuanto_mas_caro > 9_000, `dio ${f.cuanto_mas_caro}`)
  assert.ok(f.precio_oferta < 61_000)
})

t('el que ya estaba abajo del umbral no "pierde" nada', () => {
  const f = simular(prod(50_000), 25_000, FACTORES_DEFAULT, cfg)
  assert.equal(f.pierde_envio_gratis, false)
  assert.equal(f.cuanto_mas_caro, 0)
})

t('sin costo cuenta como bajo piso: no se puede afirmar que no se pierde plata', () => {
  const f = simular(prod(10_000), null, FACTORES_DEFAULT, cfg)
  assert.equal(f.bajo_piso, true)
  assert.equal(f.margen_oferta, null)
})

t('el piso deja afuera al fino y adentro al sano', () => {
  // Masa Inteligente: $15.600 con costo alto queda en 3,7% → afuera.
  const fino = simular(prod(15_600), 12_800, FACTORES_DEFAULT, cfg)
  assert.equal(fino.bajo_piso, true)
  // Un producto con costo sano queda muy arriba del piso.
  const sano = simular(prod(20_000), 8_000, FACTORES_DEFAULT, cfg)
  assert.equal(sano.bajo_piso, false)
})

t('los precios quedan redondeados a la centena', () => {
  const f = simular(prod(7_337), 3_000, FACTORES_DEFAULT, cfg)
  assert.equal(f.precio_inflado % 100, 0)
  assert.equal(f.precio_oferta % 100, 0)
  assert.equal(aCentena(7_337 * 1.15), 8_400)
})

t('sin descuento el precio de oferta es el de lista', () => {
  const f = simular(prod(10_000), 5_000, { inflar: 1, descuento: 0 }, cfg)
  assert.equal(f.precio_oferta, 10_000)
  assert.equal(f.descuento_real, 0)
})

console.log(`${ok} casos en verde`)
