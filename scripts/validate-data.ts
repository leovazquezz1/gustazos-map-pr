import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { DealsPayload } from '../src/types'
import { validatePayload } from './validate-deals'

const input = path.resolve('public/data/deals.json')
const payload = JSON.parse(await readFile(input, 'utf8')) as DealsPayload
const summary = validatePayload(payload)

console.log(
  `Validated ${summary.dealCount} deals and ${summary.pinCount} pins, including ${summary.multiLocationDeals.length} multi-location offer(s)`,
)

for (const deal of summary.multiLocationDeals) {
  console.log(`- ${deal.restaurant}: ${deal.locationCount} locations (${deal.id})`)
}
