import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLocations } from './resolve-locations'

test('keeps valid locations when another coordinate lookup cannot be resolved', async () => {
  const warnings: string[] = []
  const locations = await resolveLocations(
    [
      { address: 'Unresolved address', embedUrl: 'https://maps.example/unresolved' },
      { address: 'Resolved address', embedUrl: 'https://maps.example/resolved' },
    ],
    'oferta-del-dia:test',
    'https://example.com/deal',
    async (embedUrl) => embedUrl.endsWith('/resolved')
      ? { latitude: 18.2, longitude: -66.1 }
      : null,
    (message) => warnings.push(message),
  )

  assert.deepEqual(locations, [{
    id: 'oferta-del-dia:test:2',
    address: 'Resolved address',
    latitude: 18.2,
    longitude: -66.1,
  }])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /Skipped unresolved location/)
})

test('turns a coordinate lookup error into a warning', async () => {
  const warnings: string[] = []
  const locations = await resolveLocations(
    [{ address: 'Temporary failure', embedUrl: 'https://maps.example/error' }],
    'oferta-del-dia:test',
    'https://example.com/deal',
    async () => {
      throw new Error('temporary upstream error')
    },
    (message) => warnings.push(message),
  )

  assert.deepEqual(locations, [])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /temporary upstream error/)
})
