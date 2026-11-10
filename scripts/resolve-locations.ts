import type { DealLocation } from '../src/types'

type LocationPair = {
  address: string
  embedUrl: string
}

type Coordinates = {
  latitude: number
  longitude: number
}

type ResolveCoordinates = (embedUrl: string, detailUrl: string) => Promise<Coordinates | null>

export async function resolveLocations(
  locationPairs: LocationPair[],
  dealId: string,
  detailUrl: string,
  resolveCoordinates: ResolveCoordinates,
  onWarning: (message: string) => void,
): Promise<DealLocation[]> {
  const results = new Array<DealLocation | null>(locationPairs.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(2, locationPairs.length) }, async () => {
      while (next < locationPairs.length) {
        const index = next++
        const { address, embedUrl } = locationPairs[index]
        try {
          const coordinates = await resolveCoordinates(embedUrl, detailUrl)
          if (!coordinates) {
            onWarning(`Skipped unresolved location for ${dealId}: ${address} (${detailUrl})`)
            results[index] = null
            continue
          }
          results[index] = { id: `${dealId}:${index + 1}`, address, ...coordinates }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          onWarning(`Skipped location for ${dealId}: ${address} (${detailUrl}) — ${reason}`)
          results[index] = null
        }
      }
    }),
  )
  return results.filter((location): location is DealLocation => location !== null)
}
