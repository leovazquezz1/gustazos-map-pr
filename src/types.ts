export type DealLocation = {
  id: string
  address: string
  latitude: number
  longitude: number
}

export type DealSource = 'gustazos' | 'oferta-del-dia'

export type DealSourceInfo = {
  id: DealSource
  name: string
  url: string
}

export type Deal = {
  id: string
  source: DealSource
  restaurant: string
  offer: string
  price: number | null
  discount: number | null
  image: string
  logo: string | null
  url: string
  saleEndsAt: string | null
  redemptionHours: string[]
  locations: DealLocation[]
}

export type DealsPayload = {
  sources: DealSourceInfo[]
  updatedAt: string
  deals: Deal[]
}
