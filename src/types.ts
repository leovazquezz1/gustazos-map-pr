export type DealLocation = {
  id: string
  address: string
  latitude: number
  longitude: number
}

export type Deal = {
  id: string
  restaurant: string
  offer: string
  price: number | null
  discount: number | null
  image: string
  logo: string | null
  url: string
  saleEndsAt: string | null
  locations: DealLocation[]
}

export type DealsPayload = {
  source: string
  updatedAt: string
  deals: Deal[]
}
