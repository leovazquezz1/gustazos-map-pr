type Coordinates = {
  latitude: number
  longitude: number
}

type VerifiedLocationOverride = {
  restaurant: RegExp
  address: RegExp
  coordinates: Coordinates
  evidence: string
}

const VERIFIED_LOCATION_OVERRIDES: VerifiedLocationOverride[] = [
  {
    restaurant: /\brestaurante puesta del sol\b/i,
    address: /\b(?:carr|carretera)\s*102\b.*\bjoyuda\b.*\bcabo rojo\b/i,
    coordinates: { latitude: 18.1169478, longitude: -67.1833913 },
    evidence: 'Gustazos Restaurants_PuestadelSol16 published map coordinates',
  },
]

function normalizeLocationText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
}

export function findVerifiedLocationOverride(restaurant: string, address: string) {
  const normalizedRestaurant = normalizeLocationText(restaurant)
  const normalizedAddress = normalizeLocationText(address)
  return VERIFIED_LOCATION_OVERRIDES.find((override) =>
    override.restaurant.test(normalizedRestaurant) && override.address.test(normalizedAddress),
  ) ?? null
}
