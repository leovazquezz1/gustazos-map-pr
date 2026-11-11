import type { Deal, DealsPayload } from '../src/types'
import { hasSaleEnded } from '../src/deal-availability'

const PUERTO_RICO_BOUNDS = {
  minLatitude: 17.8,
  maxLatitude: 18.6,
  minLongitude: -67.4,
  maxLongitude: -65.2,
}

export type DealValidationSummary = {
  dealCount: number
  pinCount: number
  multiLocationDeals: Array<{ id: string; restaurant: string; locationCount: number }>
}

export function validateDeals(deals: Deal[]): DealValidationSummary {
  if (deals.length === 0) throw new Error('The deal feed is empty')

  const dealIds = new Set<string>()
  const locationIds = new Set<string>()
  const multiLocationDeals: DealValidationSummary['multiLocationDeals'] = []
  let pinCount = 0

  for (const deal of deals) {
    if (!deal.id.trim()) throw new Error('A deal is missing its id')
    if (dealIds.has(deal.id)) throw new Error(`Duplicate deal id: ${deal.id}`)
    dealIds.add(deal.id)

    if (deal.source !== 'gustazos' && deal.source !== 'oferta-del-dia') {
      throw new Error(`Deal ${deal.id} has an invalid source`)
    }

    if (deal.locations.length === 0) {
      throw new Error(`Deal ${deal.id} (${deal.restaurant}) has no redemption locations`)
    }

    if (!Array.isArray(deal.redemptionHours)) {
      throw new Error(`Deal ${deal.id} (${deal.restaurant}) has invalid redemption hours`)
    }

    if (deal.saleEndsAt !== null && !Number.isFinite(Date.parse(deal.saleEndsAt))) {
      throw new Error(`Deal ${deal.id} (${deal.restaurant}) has an invalid expiration date`)
    }

    if (hasSaleEnded(deal.saleEndsAt)) {
      throw new Error(`Deal ${deal.id} (${deal.restaurant}) is no longer available`)
    }

    if (deal.locations.length > 1) {
      multiLocationDeals.push({
        id: deal.id,
        restaurant: deal.restaurant,
        locationCount: deal.locations.length,
      })
    }

    for (const location of deal.locations) {
      pinCount += 1

      if (!location.id.trim()) throw new Error(`Deal ${deal.id} has a location without an id`)
      if (locationIds.has(location.id)) throw new Error(`Duplicate location id: ${location.id}`)
      locationIds.add(location.id)

      if (!location.address.trim()) {
        throw new Error(`Location ${location.id} is missing its address`)
      }

      const { latitude, longitude } = location
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error(`Location ${location.id} has invalid coordinates`)
      }

      if (
        latitude < PUERTO_RICO_BOUNDS.minLatitude ||
        latitude > PUERTO_RICO_BOUNDS.maxLatitude ||
        longitude < PUERTO_RICO_BOUNDS.minLongitude ||
        longitude > PUERTO_RICO_BOUNDS.maxLongitude
      ) {
        throw new Error(
          `Location ${location.id} is outside Puerto Rico (${latitude}, ${longitude})`,
        )
      }
    }
  }

  if (locationIds.size !== pinCount) {
    throw new Error(`Expected ${pinCount} pins, but only ${locationIds.size} unique locations exist`)
  }

  return { dealCount: deals.length, pinCount, multiLocationDeals }
}

export function validatePayload(payload: DealsPayload): DealValidationSummary {
  if (!Array.isArray(payload.sources) || payload.sources.length < 2) {
    throw new Error('The deal feed must include every configured source')
  }
  const sourceIds = new Set(payload.sources.map((source) => source.id))
  if (!sourceIds.has('gustazos') || !sourceIds.has('oferta-del-dia')) {
    throw new Error('The deal feed is missing a configured source')
  }
  if (!Number.isFinite(Date.parse(payload.updatedAt))) {
    throw new Error('The deal feed has an invalid updatedAt timestamp')
  }

  for (const sourceId of sourceIds) {
    if (!payload.deals.some((deal) => deal.source === sourceId)) {
      throw new Error(`The deal feed contains no deals from ${sourceId}`)
    }
  }

  return validateDeals(payload.deals)
}
