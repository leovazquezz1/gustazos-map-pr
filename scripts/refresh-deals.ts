import * as cheerio from 'cheerio'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Deal, DealLocation, DealSourceInfo, DealsPayload } from '../src/types'
import { resolveLocations } from './resolve-locations'
import { validateDeals } from './validate-deals'

const GUSTAZOS_BASE_URL = 'https://www.gustazos.com'
const GUSTAZOS_CATEGORY_URL = `${GUSTAZOS_BASE_URL}/c/restaurants1`
const OFERTA_BASE_URL = 'https://www.ofertadeldia.com'
const OFERTA_CATEGORY_URL =
  `${OFERTA_BASE_URL}/puerto-rico-ofertas/categoria/gastronomia/4d382ad7-9d97-461e-8eef-a553ea9ba33c`
const OUTPUT = path.resolve('public/data/deals.json')
const WARNING_OUTPUT = path.resolve('refresh-warnings.log')
const USER_AGENT =
  'RestaurantDealsMapPR/2.0 (+https://github.com/leovazquezz1/gustazos-map-pr; public-deal index)'

const SOURCES: DealSourceInfo[] = [
  { id: 'gustazos', name: 'Gustazos', url: GUSTAZOS_CATEGORY_URL },
  { id: 'oferta-del-dia', name: 'Oferta del Día', url: OFERTA_CATEGORY_URL },
]

const warnings: string[] = []

function recordWarning(message: string) {
  warnings.push(message)
  console.warn(`[warning] ${message}`)
}

type DealSeed = Omit<Deal, 'locations' | 'redemptionHours'>

function clean(value: string) {
  return value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim()
}

function normalizeLabel(value: string) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
}

async function fetchHtml(url: string, referer?: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'es-PR,es;q=0.9,en;q=0.7',
      ...(referer ? { referer } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Source returned ${response.status} for ${url}`)
  return response.text()
}

function parseGustazosSeeds(html: string): DealSeed[] {
  const $ = cheerio.load(html)
  const found = new Map<string, DealSeed>()
  $('.coupon-list-item').each((_, element) => {
    const card = $(element)
    const href = card.find('a[href^="/deals/"]').first().attr('href')
    if (!href) return
    const rawId = href.split('/').filter(Boolean).at(-1)
    const restaurant = clean(card.find('.coupon-list-item__footer__name__title').text())
    const offer = clean(card.find('.coupon-list-item__footer__name__subtitle .tooltop').text())
    const image = card.find('.thumb img').first().attr('src')?.trim() ?? ''
    const logo = card.find('.coupon-list-item__footer__company__logo img').attr('src')?.trim() ?? null
    const discountMatch = clean(card.find('.coupon-list-item__listing_discount__text').text()).match(/(\d+)\s*%/)
    const priceMatch = offer.match(/^\$\s*([\d,.]+)/)
    const countdown = card.find('[data-countdown]').attr('data-countdown')
    if (!rawId || !restaurant || !offer || !image) return
    const id = `gustazos:${rawId}`
    found.set(id, {
      id,
      source: 'gustazos',
      restaurant,
      offer,
      price: priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null,
      discount: discountMatch ? Number(discountMatch[1]) : null,
      image,
      logo,
      url: new URL(href, GUSTAZOS_BASE_URL).toString(),
      saleEndsAt: countdown ? new Date(Number(countdown) * 1000).toISOString() : null,
    })
  })
  return [...found.values()]
}

function parseGustazosLocations(html: string, dealId: string): DealLocation[] {
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
    locations.push({
      id: `${dealId}:${index + 1}`,
      address: clean(addressElement.text().replace(/PR\s*$/i, 'PR')) || 'Puerto Rico',
      latitude,
      longitude,
    })
  })
  return locations
}

function parseGustazosRedemptionHours(html: string): string[] {
  const $ = cheerio.load(html)
  const hours: string[] = []
  $('li').each((_, element) => {
    const item = $(element)
    const heading = item.children('strong').first()
    if (!normalizeLabel(heading.text()).includes('horario de redencion')) return
    const nestedItems = item.children('ul, ol').first().children('li')
    if (nestedItems.length > 0) {
      nestedItems.each((__, nested) => {
        const value = clean($(nested).text())
        if (value) hours.push(value)
      })
      return
    }
    const content = item.clone()
    content.children('strong').first().remove()
    const value = clean(content.text())
    if (value) hours.push(value)
  })
  return [...new Set(hours)]
}

function parseOfertaSeeds(html: string): DealSeed[] {
  const $ = cheerio.load(html)
  const found = new Map<string, DealSeed>()
  $('li.item').each((_, element) => {
    const card = $(element)
    const href = card.find('a[href*="/oferta/"]').first().attr('href')
    if (!href) return
    const cleanUrl = new URL(href, OFERTA_BASE_URL)
    cleanUrl.search = ''
    const rawId = cleanUrl.pathname.split('/').filter(Boolean).at(-1)
    const offer = clean(card.find('.item-title').first().text())
    const image = card.find('img[data-src]').first().attr('data-src')?.trim() ?? ''
    const priceMatch = clean(card.find('.price').first().text()).match(/\$\s*([\d,.]+)/)
    const discountMatch = clean(card.find('.discount').first().text()).match(/(\d+)\s*%/)
    const countdown = card.find('[data-countdown]').first().attr('data-countdown')
    if (!rawId || !offer || !image) return
    const id = `oferta-del-dia:${rawId}`
    found.set(id, {
      id,
      source: 'oferta-del-dia',
      restaurant: '',
      offer,
      price: priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null,
      discount: discountMatch ? Number(discountMatch[1]) : null,
      image,
      logo: null,
      url: cleanUrl.toString(),
      saleEndsAt: countdown
        ? new Date(`${countdown.replace(/\//g, '-').replace(' ', 'T')}:00-04:00`).toISOString()
        : null,
    })
  })
  return [...found.values()]
}

const NON_RESTAURANT_TERMS = [
  'taller', 'clase', 'curso', 'seminario', 'conviertete', 'confeccion', 'aprende', 'tour',
]
const RESTAURANT_TERMS = [
  'restaurant', 'restaurante', 'bar ', 'bar &', 'grill', 'fonda', 'menu', 'plato', 'mofongo',
  'paella', 'aperitivo', 'bebida', 'comida', 'almuerzo', 'cena', 'consumo', 'steak', 'sopa',
]

function isRestaurantOffer(seed: DealSeed, detailHtml: string) {
  const $ = cheerio.load(detailHtml)
  const haystack = normalizeLabel(`${seed.offer} ${$('#company > p').first().text()} ${$('#details').text()}`)
  if (NON_RESTAURANT_TERMS.some((term) => haystack.includes(term))) return false
  return RESTAURANT_TERMS.some((term) => haystack.includes(term))
}

function parseOfertaRestaurant(html: string) {
  const $ = cheerio.load(html)
  return clean($('#company > p').first().text())
}

function parseOfertaRedemptionHours(html: string): string[] {
  const $ = cheerio.load(html)
  const candidates: Array<{ value: string; mentionsContact: boolean; isAttentionHours: boolean }> = []
  const dayPattern = /(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i
  const timePattern = /\d{1,2}:\d{2}\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm)/i
  $('#details p, #details li, #legal li').each((_, element) => {
    const value = clean($(element).text())
    if (!dayPattern.test(value) || !timePattern.test(value)) return
    const firstDay = value.search(dayPattern)
    if (firstDay < 0) return
    const schedule = clean(value.slice(firstDay).split(/(?:Para más información|Oferta válida|No es válid[oa]|El valor de la promoción)/i)[0])
    if (schedule) candidates.push({
      value: schedule,
      mentionsContact: /reserv|comunicar|llamar/i.test(value),
      isAttentionHours: /horario de atenci[oó]n/i.test(value),
    })
  })
  const withoutContact = candidates.filter((candidate) => !candidate.mentionsContact)
  const nonAttention = withoutContact.filter((candidate) => !candidate.isAttentionHours)
  const preferred = nonAttention.length > 0 ? nonAttention : withoutContact.length > 0 ? withoutContact : candidates
  const unique = [...new Set(preferred.map((candidate) => candidate.value))]
  return unique.filter((value, index) => !unique.some((other, otherIndex) => otherIndex !== index && other.includes(value))).slice(0, 4)
}

async function coordinatesFromGoogleEmbed(embedUrl: string, detailUrl: string) {
  const html = await fetchHtml(embedUrl, detailUrl)
  const matches = html.matchAll(/\[(1[78]\.\d+),(-6[567]\.\d+)\]/g)
  for (const match of matches) {
    const latitude = Number(match[1])
    const longitude = Number(match[2])
    if (latitude >= 17.8 && latitude <= 18.6 && longitude >= -67.4 && longitude <= -65.2) {
      return { latitude, longitude }
    }
  }
  return null
}

async function parseOfertaLocations(html: string, dealId: string, detailUrl: string) {
  const $ = cheerio.load(html)
  const locationPairs: Array<{ address: string; embedUrl: string }> = []
  $('#company address').each((index, element) => {
    const addressElement = $(element).clone()
    addressElement.find('br').replaceWith(', ')
    const address = clean(addressElement.text())
    const embedUrl = $('#company iframe').eq(index).attr('src')?.trim()
    if (address && embedUrl) locationPairs.push({ address, embedUrl })
  })
  return resolveLocations(
    locationPairs,
    dealId,
    detailUrl,
    coordinatesFromGoogleEmbed,
    recordWarning,
  )
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

async function fetchGustazosDeals() {
  const seeds = parseGustazosSeeds(await fetchHtml(GUSTAZOS_CATEGORY_URL))
  if (seeds.length === 0) throw new Error('No Gustazos restaurant deals were found')
  return mapWithConcurrency(seeds, 4, async (seed, index): Promise<Deal> => {
    const html = await fetchHtml(seed.url)
    const locations = parseGustazosLocations(html, seed.id)
    const redemptionHours = parseGustazosRedemptionHours(html)
    console.log(`[Gustazos ${index + 1}/${seeds.length}] ${seed.restaurant}: ${locations.length} pin(s)`)
    return { ...seed, redemptionHours, locations }
  })
}

async function fetchOfertaDelDiaDeals() {
  const seeds = parseOfertaSeeds(await fetchHtml(OFERTA_CATEGORY_URL))
  if (seeds.length === 0) throw new Error('No Oferta del Día gastronomy offers were found')
  const results = await mapWithConcurrency(seeds, 3, async (seed, index) => {
    const html = await fetchHtml(seed.url)
    const restaurant = parseOfertaRestaurant(html)
    if (!isRestaurantOffer(seed, html)) {
      console.log(`[Oferta del Día ${index + 1}/${seeds.length}] Excluded non-restaurant: ${seed.offer}`)
      return null
    }
    if (!restaurant) throw new Error(`Oferta del Día deal ${seed.id} is missing its restaurant name`)
    const locations = await parseOfertaLocations(html, seed.id, seed.url)
    if (locations.length === 0) {
      recordWarning(`Skipped deal with no resolvable locations: ${restaurant} (${seed.url})`)
      return null
    }
    const redemptionHours = parseOfertaRedemptionHours(html)
    console.log(`[Oferta del Día ${index + 1}/${seeds.length}] ${restaurant}: ${locations.length} pin(s)`)
    return { ...seed, restaurant, redemptionHours, locations } satisfies Deal
  })
  return results.filter((deal): deal is Deal => deal !== null)
}

async function main() {
  await rm(WARNING_OUTPUT, { force: true })
  const [gustazosDeals, ofertaDelDiaDeals] = await Promise.all([
    fetchGustazosDeals(),
    fetchOfertaDelDiaDeals(),
  ])
  const deals = [...gustazosDeals, ...ofertaDelDiaDeals].filter((deal) => deal.locations.length > 0)
  if (gustazosDeals.length === 0 || ofertaDelDiaDeals.length === 0) {
    throw new Error('Every configured restaurant source must return at least one usable deal')
  }
  const validation = validateDeals(deals)
  for (const deal of validation.multiLocationDeals) {
    console.log(`Multi-location offer: ${deal.restaurant} has ${deal.locationCount} pins`)
  }
  const payload: DealsPayload = { sources: SOURCES, updatedAt: new Date().toISOString(), deals }
  await mkdir(path.dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  if (warnings.length > 0) {
    await writeFile(WARNING_OUTPUT, `${warnings.join('\n')}\n`, 'utf8')
    console.warn(`Refresh completed with ${warnings.length} warning(s); details written to ${WARNING_OUTPUT}`)
  }
  console.log(
    `Wrote ${validation.dealCount} deals and ${validation.pinCount} pins ` +
    `(${gustazosDeals.length} Gustazos, ${ofertaDelDiaDeals.length} Oferta del Día) to ${OUTPUT}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
