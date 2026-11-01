import * as cheerio from 'cheerio'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Deal, DealLocation, DealsPayload } from '../src/types'
import { validateDeals } from './validate-deals'

const BASE_URL = 'https://www.gustazos.com'
const CATEGORY_URL = `${BASE_URL}/c/restaurants1`
const OUTPUT = path.resolve('public/data/deals.json')
const USER_AGENT =
  'GustazosMapPR/1.0 (+https://github.com/leovazquezz1/gustazos-map-pr; public-deal index)'

type DealSeed = Omit<Deal, 'locations'>

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'es-PR,es;q=0.9,en;q=0.7',
    },
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    throw new Error(`Gustazos returned ${response.status} for ${url}`)
  }

  return response.text()
}

function parseSeeds(html: string): DealSeed[] {
  const $ = cheerio.load(html)
  const found = new Map<string, DealSeed>()

  $('.coupon-list-item').each((_, element) => {
    const card = $(element)
    const href = card.find('a[href^="/deals/"]').first().attr('href')
    if (!href) return

    const id = href.split('/').filter(Boolean).at(-1)
    const restaurant = clean(card.find('.coupon-list-item__footer__name__title').text())
    const offer = clean(card.find('.coupon-list-item__footer__name__subtitle .tooltop').text())
    const image = card.find('.thumb img').first().attr('src')?.trim() ?? ''
    const logo = card.find('.coupon-list-item__footer__company__logo img').attr('src')?.trim() ?? null
    const discountText = clean(card.find('.coupon-list-item__listing_discount__text').text())
    const discountMatch = discountText.match(/(\d+)\s*%/)
    const priceMatch = offer.match(/^\$\s*([\d,.]+)/)
    const countdown = card.find('[data-countdown]').attr('data-countdown')

    if (!id || !restaurant || !offer || !image) return

    found.set(id, {
      id,
      restaurant,
      offer,
      price: priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null,
      discount: discountMatch ? Number(discountMatch[1]) : null,
      image,
      logo,
      url: new URL(href, BASE_URL).toString(),
      saleEndsAt: countdown ? new Date(Number(countdown) * 1000).toISOString() : null,
    })
  })

  return [...found.values()]
}

function parseLocations(html: string, dealId: string): DealLocation[] {
  const $ = cheerio.load(html)
  const locations: DealLocation[] = []

  $('a[href*="maps.google.com/?q="]').each((index, element) => {
    const href = $(element).attr('href')
    if (!href) return

    const query = new URL(href).searchParams.get('q')
    if (!query) return

    const [latitude, longitude] = query.split(',').map(Number)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

    const addressElement = $(element).closest('address').clone()
    addressElement.find('a').remove()
    const address = clean(addressElement.text().replace(/PR\s*$/i, 'PR'))

    locations.push({
      id: `${dealId}-${index + 1}`,
      address: address || 'Puerto Rico',
      latitude,
      longitude,
    })
  })

  return locations
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length)
  let next = 0

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await task(items[index], index)
      }
    }),
  )

  return results
}

async function main() {
  const categoryHtml = await fetchHtml(CATEGORY_URL)
  const seeds = parseSeeds(categoryHtml)
  if (seeds.length === 0) throw new Error('No restaurant deals were found on the category page')

  const deals = await mapWithConcurrency(seeds, 4, async (seed, index): Promise<Deal> => {
    const detailHtml = await fetchHtml(seed.url)
    const locations = parseLocations(detailHtml, seed.id)
    console.log(`[${index + 1}/${seeds.length}] ${seed.restaurant}: ${locations.length} location(s)`)
    return { ...seed, locations }
  })

  const usableDeals = deals.filter((deal) => deal.locations.length > 0)
  if (usableDeals.length === 0) throw new Error('Deals were found, but none included usable map coordinates')

  const validation = validateDeals(usableDeals)
  for (const deal of validation.multiLocationDeals) {
    console.log(`Multi-location offer: ${deal.restaurant} has ${deal.locationCount} pins`)
  }

  const payload: DealsPayload = {
    source: CATEGORY_URL,
    updatedAt: new Date().toISOString(),
    deals: usableDeals,
  }

  await mkdir(path.dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${validation.dealCount} deals and ${validation.pinCount} pins to ${OUTPUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
