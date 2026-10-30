/**
 * El interruptor del Cyber, probado en los momentos que importan.
 *
 * Correr con: node --experimental-strip-types __test-cyber.mts
 */
import assert from 'node:assert'
import { estadoCyber, parsearDesde } from './lib/cyber.ts'

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

/** Un instante dado en hora de Buenos Aires (UTC-3). */
const ar = (iso: string) => new Date(`${iso}:00-03:00`)

t('apagado es apagado, aunque la fecha ya haya pasado', () => {
  const e = estadoCyber({ cyber_activo: '0', cyber_desde: '2026-11-02' }, ar('2026-11-03T10:00'))
  assert.equal(e.activo, false)
  assert.equal(e.programado, false)
})

t('prendido antes de la fecha: programado, no activo', () => {
  const e = estadoCyber({ cyber_activo: '1', cyber_desde: '2026-11-02' }, ar('2026-11-01T23:59'))
  assert.equal(e.activo, false)
  assert.equal(e.programado, true)
})

t('arranca al minuto exacto', () => {
  const justoAntes = estadoCyber({ cyber_activo: '1', cyber_desde: '2026-11-02' }, ar('2026-11-01T23:59'))
  const justoDespues = estadoCyber({ cyber_activo: '1', cyber_desde: '2026-11-02' }, ar('2026-11-02T00:00'))
  assert.equal(justoAntes.activo, false)
  assert.equal(justoDespues.activo, true)
})

t('sin fecha de fin: sigue activo una semana después', () => {
  const e = estadoCyber({ cyber_activo: '1', cyber_desde: '2026-11-02' }, ar('2026-11-09T12:00'))
  assert.equal(e.activo, true)
})

t('la hora que vale es la de Buenos Aires, no la del servidor', () => {
  // 2026-11-02T02:00Z son las 23:00 del 1/11 en Buenos Aires: todavía no.
  const e = estadoCyber({ cyber_activo: '1', cyber_desde: '2026-11-02' }, new Date('2026-11-02T02:00:00Z'))
  assert.equal(e.activo, false)
  // 2026-11-02T03:00Z son las 00:00 del 2/11 acá: ahora sí.
  const e2 = estadoCyber({ cyber_activo: '1', cyber_desde: '2026-11-02' }, new Date('2026-11-02T03:00:00Z'))
  assert.equal(e2.activo, true)
})

t('con hora cargada respeta la hora', () => {
  const antes = estadoCyber({ cyber_activo: '1', cyber_desde: '2026-11-02T09:00' }, ar('2026-11-02T08:59'))
  const despues = estadoCyber({ cyber_activo: '1', cyber_desde: '2026-11-02T09:00' }, ar('2026-11-02T09:00'))
  assert.equal(antes.activo, false)
  assert.equal(despues.activo, true)
})

t('sin fecha arranca apenas se prende', () => {
  const e = estadoCyber({ cyber_activo: '1', cyber_desde: '' }, ar('2026-10-30T15:00'))
  assert.equal(e.activo, true)
  assert.equal(e.desde, null)
})

t('una fecha ilegible no deja la promo prendida e invisible', () => {
  // Es el error que más tarda en descubrirse: el interruptor dice "prendida"
  // y la tienda no muestra nada. Preferimos que salga a que no se vea.
  for (const basura of ['02/11/2026', 'lunes', '2026-13-02', '2026-11-02T25:00', 'noviembre']) {
    assert.equal(parsearDesde(basura), null, `debería rechazar ${basura}`)
    assert.equal(
      estadoCyber({ cyber_activo: '1', cyber_desde: basura }, ar('2026-10-30T15:00')).activo,
      true,
      `con ${basura} debería arrancar igual`,
    )
  }
})

t('normaliza el día solo a medianoche', () => {
  assert.equal(parsearDesde('2026-11-02'), '2026-11-02T00:00')
  assert.equal(parsearDesde(' 2026-11-02T9:00 '), null) // la hora va con dos dígitos
  assert.equal(parsearDesde('2026-11-02T09:00'), '2026-11-02T09:00')
  assert.equal(parsearDesde('2026-11-02 09:00'), '2026-11-02T09:00')
})

t('título y bajada tienen valores por defecto', () => {
  const e = estadoCyber({ cyber_activo: '1' }, ar('2026-11-02T10:00'))
  assert.equal(e.titulo, 'Ofertas Cyber')
  assert.equal(e.bajada, '')
})

console.log(`${ok} casos en verde`)
