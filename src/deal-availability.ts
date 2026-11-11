import type { Deal } from './types'

export function hasSaleEnded(saleEndsAt: string | null, now = Date.now()) {
  if (!saleEndsAt) return false
  const timestamp = Date.parse(saleEndsAt)
  return Number.isFinite(timestamp) && timestamp <= now
}

export function isDealAvailable(deal: Pick<Deal, 'saleEndsAt'>, now = Date.now()) {
  return !hasSaleEnded(deal.saleEndsAt, now)
}

export function hasUnavailableGustazosMarkup(html: string) {
  return /class=["'][^"']*(?:expired-deal-banner|btn-v2--unavailable)\b[^"']*["']/i.test(html)
}
