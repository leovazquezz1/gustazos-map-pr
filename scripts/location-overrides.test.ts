import assert from 'node:assert/strict'
import test from 'node:test'
import { findVerifiedLocationOverride } from './location-overrides'

test('resolves Puesta del Sol when Oferta del Día publishes invalid map coordinates', () => {
  const override = findVerifiedLocationOverride(
    'Restaurante Puesta del Sol Inc.',
    'Carr 102 km 13.8, Bo joyuda, Cabo Rojo, PR 00623',
  )

  assert.deepEqual(override?.coordinates, {
    latitude: 18.1169478,
    longitude: -67.1833913,
  })
  assert.match(override?.evidence ?? '', /Gustazos/)
})

test('does not apply the override to a different merchant', () => {
  assert.equal(
    findVerifiedLocationOverride(
      'Otro Restaurante',
      'Carr 102 km 13.8, Bo Joyuda, Cabo Rojo, PR 00623',
    ),
    null,
  )
})
