// AI layer. Everything "smart" in the app goes through this interface so the
// local rules below can be replaced by a real model (Claude via a Supabase
// Edge Function) without touching the UI.
import type { Item, Job, Quote, Room, SizeClass, Tag } from './types'

export interface AIProvider {
  /** Suggest a tag and size from a short item name, before the user chooses. */
  suggestTag(name: string): { tag: Tag; size: SizeClass; reason: string } | null
  /** A short, warm message telling the client what to do next. */
  nextStep(job: Job, rooms: Room[], items: Item[]): { headline: string; body: string; roomId?: string }
  /** Turn the tagged inventory into a crew, truck and price estimate. */
  estimateQuote(job: Job, items: Item[]): Quote
  /** Questions a downsizing advisor would ask about an Undecided item. */
  undecidedPrompts(item: Item): string[]
}

const KEYWORDS: Array<{ re: RegExp; tag: Tag; size?: SizeClass; reason: string }> = [
  { re: /broken|cracked|stained|expired|torn|rusty|old magazines|newspapers/i, tag: 'junk', reason: 'Sounds worn out or not usable.' },
  { re: /photo|album|letters|wedding|heirloom|grandm|grandf|family bible|medals|baby/i, tag: 'family', size: 'small', reason: 'Items like this usually go to family.' },
  { re: /piano/i, tag: 'sell', size: 'oversize', reason: 'Pianos are heavy and have resale value. We handle specialty moves.' },
  { re: /antique|silver|crystal|china set|painting|artwork|persian|oriental rug|jewel|watch|coins|stamp/i, tag: 'sell', reason: 'This may have resale value. We can get it appraised.' },
  { re: /sofa|couch|loveseat|sectional/i, tag: 'undecided', size: 'large', reason: 'Large furniture: will it fit the new place?' },
  { re: /dresser|wardrobe|armoire|hutch|buffet|cabinet|bookcase|desk|dining table/i, tag: 'undecided', size: 'large', reason: 'Large furniture: will it fit the new place?' },
  { re: /mattress|box spring/i, tag: 'junk', size: 'large', reason: 'Charities rarely take mattresses; we recycle them.' },
  { re: /tv|television|microwave|toaster|kettle|blender|vacuum|printer|computer|laptop|phone|radio|stereo/i, tag: 'donate', size: 'medium', reason: 'Working electronics are usually donated or recycled.' },
  { re: /lamp|chair|stool|side table|nightstand|mirror|rug/i, tag: 'undecided', size: 'medium', reason: 'Medium furniture: keep if it fits, donate if not.' },
  { re: /books|clothes|clothing|coats|shoes|linens|towels|blankets|dishes|pots|pans|glasses|mugs|toys|games|puzzles/i, tag: 'donate', size: 'small', reason: 'Everyday items in good shape are great donations.' },
  { re: /christmas|holiday|decorations|seasonal|camping|skis|golf|luggage|suitcase/i, tag: 'store', size: 'medium', reason: 'Seasonal things often go to storage until there is room.' },
  { re: /paint|chemicals|propane|batteries|fluorescent/i, tag: 'junk', size: 'small', reason: 'Hazardous: we take these to proper disposal.' },
  { re: /bed|bedframe|headboard/i, tag: 'move', size: 'large', reason: 'Beds usually come along.' },
  { re: /tools|drill|saw|ladder|lawn ?mower|snow ?blower|bbq|barbecue/i, tag: 'undecided', size: 'medium', reason: 'Will you have a garage or yard at the new place?' },
]

const PRICE_PER_HOUR_PER_MOVER = 65
const CREW_LOAD_PER_HOUR = 12 // items an average mover handles per hour, incl. packing

const SIZE_UNITS: Record<SizeClass, number> = { small: 1, medium: 4, large: 12, oversize: 30 }

export const localAI: AIProvider = {
  suggestTag(name) {
    const n = name.trim()
    if (n.length < 3) return null
    for (const k of KEYWORDS) {
      if (k.re.test(n)) return { tag: k.tag, size: k.size ?? 'small', reason: k.reason }
    }
    return null
  },

  nextStep(job, rooms, items) {
    const hour = new Date().getHours()
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    const first = job.clientName.split(' ')[0] || 'there'
    const daysLeft = Math.max(0, Math.ceil((new Date(job.tagDeadline).getTime() - Date.now()) / 86400000))
    const doneRooms = rooms.filter((r) => r.done).length
    const undecided = items.filter((i) => i.tag === 'undecided').length

    if (items.length === 0) {
      const start = rooms[0]
      return {
        headline: `${greet}, ${first}.`,
        body: `Let's begin in the ${start?.name.toLowerCase() ?? 'first room'}. Take one photo per item, choose a tag, and move on. There are no wrong answers; you can change anything later.`,
        roomId: start?.id,
      }
    }
    if (doneRooms === rooms.length && rooms.length > 0) {
      if (undecided > 0) {
        return {
          headline: 'Every room is done. Well done.',
          body: `There are ${undecided} items marked "Not sure". We can go through them together on a short call, or you can review them now from the Summary page.`,
        }
      }
      return {
        headline: 'All tagged and ready.',
        body: 'Open the Summary page to review your estimate and send it to us. We will confirm the quote and your move date within one business day.',
      }
    }
    const next = rooms.find((r) => !r.done)
    const pace = daysLeft > 0 ? `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left, which is plenty.` : 'Your tagging window has closed, but you can keep going; we will adjust.'
    return {
      headline: `${greet}, ${first}.`,
      body: `${items.length} item${items.length === 1 ? '' : 's'} tagged so far, ${doneRooms} of ${rooms.length} rooms finished. ${pace} Next up: the ${next?.name.toLowerCase()}.`,
      roomId: next?.id,
    }
  },

  estimateQuote(job, items) {
    const by = (t: Tag) => items.filter((i) => i.tag === t)
    const units = (list: Item[]) => list.reduce((s, i) => s + SIZE_UNITS[i.size] * (i.qty ?? 1), 0)

    const moveUnits = units(by('move')) + units(by('family'))
    const storeUnits = units(by('store'))
    const junkUnits = units(by('junk'))
    const donateUnits = units(by('donate'))
    const sellUnits = units(by('sell'))
    const handled = items.filter((i) => i.tag !== 'keep').length

    const smallMove = by('move').filter((i) => i.size === 'small').length + by('family').filter((i) => i.size === 'small').length
    const boxes = Math.ceil(smallMove / 4) + Math.ceil(by('store').filter((i) => i.size === 'small').length / 4)

    const totalUnits = moveUnits + storeUnits + junkUnits + donateUnits + sellUnits
    const truck = totalUnits < 60 ? 'Cargo van' : totalUnits < 160 ? '16 ft truck' : totalUnits < 320 ? '20 ft truck' : '26 ft truck'
    const crew = totalUnits < 60 ? 2 : totalUnits < 200 ? 3 : totalUnits < 400 ? 4 : 5
    const hours = Math.max(3, Math.ceil(handled / (CREW_LOAD_PER_HOUR * crew)) + 2)

    const storageUnit = storeUnits === 0 ? null : storeUnits < 40 ? '5 x 5 locker' : storeUnits < 100 ? '5 x 10 unit' : storeUnits < 200 ? '10 x 10 unit' : '10 x 15 unit'
    const donationLoads = donateUnits === 0 ? 0 : Math.ceil(donateUnits / 120)
    const junkLoads = junkUnits === 0 ? 0 : Math.ceil(junkUnits / 120)

    const labour = crew * hours * PRICE_PER_HOUR_PER_MOVER
    const truckCost = truck === 'Cargo van' ? 180 : truck === '16 ft truck' ? 260 : truck === '20 ft truck' ? 320 : 420
    const supplies = boxes * 6 + 120
    const disposal = junkLoads * 350
    const tierMultiplier = job.tier === 'clear' ? 1 : job.tier === 'clear-move' ? 1.25 : 1.6
    const base = (labour + truckCost + supplies + disposal) * tierMultiplier
    const margin = base / 0.55 // target ~45% gross margin

    const notes: string[] = []
    const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`
    if (by('undecided').length) notes.push(`${n(by('undecided').length, 'item')} still marked "Not sure"; the estimate assumes they go to storage.`)
    if (by('sell').length) notes.push(`${n(by('sell').length, 'item')} flagged for sale. We arrange appraisal and consignment; proceeds offset your bill.`)
    if (items.some((i) => i.size === 'oversize')) notes.push('Oversize items (piano, wardrobe) may need a specialty crew. We will confirm.')
    if (items.length < 10) notes.push('Estimate is rough until more items are tagged.')

    const round = (n: number) => Math.round(n / 50) * 50
    return {
      crew, hours, truck, boxes, storageUnit, donationLoads, junkLoads,
      priceLow: round(margin * 0.9),
      priceHigh: round(margin * 1.15),
      notes,
    }
  },

  undecidedPrompts(item) {
    const base = [
      `Will "${item.name}" fit in the new home? If you are not sure, we can measure on move day.`,
      'Have you used it in the last year?',
      'Would a family member want it? If so, tag it Family and add their name.',
    ]
    if (item.size === 'large' || item.size === 'oversize') base.push('Large pieces are the costliest to store. Selling or donating is often the better choice.')
    return base
  },
}

// Future: `export const ai: AIProvider = import.meta.env.VITE_AI_ENDPOINT ? remoteAI : localAI`
export const ai: AIProvider = localAI
