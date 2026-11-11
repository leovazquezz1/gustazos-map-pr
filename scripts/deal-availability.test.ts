import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasSaleEnded,
  hasUnavailableGustazosMarkup,
  isDealAvailable,
} from '../src/deal-availability'

const NOW = Date.parse('2026-11-11T16:00:00-04:00')

test('offers without an expiration remain available', () => {
  assert.equal(hasSaleEnded(null, NOW), false)
  assert.equal(isDealAvailable({ saleEndsAt: null }, NOW), true)
})

test('future offers remain available', () => {
  assert.equal(hasSaleEnded('2026-11-11T20:00:01.000Z', NOW), false)
})

test('offers disappear when their sale deadline is reached', () => {
  assert.equal(hasSaleEnded('2026-11-11T20:00:00.000Z', NOW), true)
  assert.equal(hasSaleEnded('2026-11-11T19:59:59.000Z', NOW), true)
  assert.equal(isDealAvailable({ saleEndsAt: '2026-11-11T19:59:59.000Z' }, NOW), false)
})

test('invalid dates are left for feed validation to reject', () => {
  assert.equal(hasSaleEnded('not-a-date', NOW), false)
})

test('Gustazos expired and unavailable controls are detected', () => {
  assert.equal(
    hasUnavailableGustazosMarkup('<div class="expired-deal-banner"><img></div>'),
    true,
  )
  assert.equal(
    hasUnavailableGustazosMarkup('<button class="btn-v2 btn-v2--unavailable">Comprar</button>'),
    true,
  )
  assert.equal(
    hasUnavailableGustazosMarkup('<div id="wlt-DealExpiredBanner" class="worklet"><div class="worklet-content"></div></div>'),
    false,
  )
})
