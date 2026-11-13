import type { Item, JobDetails } from './types'

// Special care: items the owner flags as valuable or fragile, each with a value they declare.
// PLACEHOLDER NUMBERS: the rate, minimum and per-item limit must be replaced with the terms of
// the company's cargo policy before this is charged to anyone. This is a mover's valuation, not insurance.
export const PROTECTION_RATE = 0.02 // 2% of the declared value
export const PROTECTION_MIN = 25
export const ASK_FIRST = 5000 // per item; above this a person reviews it before any price is shown

export type Care = { items: Item[]; total: number; covered: number; fee: number; askFirst: Item[]; on: boolean }
export function careFor(items: Item[], details?: JobDetails): Care | null {
  const list = items.filter((i) => i.special && i.tag !== 'junk')
  if (!list.length) return null
  const askFirst = list.filter((i) => (i.declaredValue ?? 0) > ASK_FIRST)
  const total = list.reduce((n, i) => n + (i.declaredValue ?? 0), 0)
  const covered = list.filter((i) => (i.declaredValue ?? 0) <= ASK_FIRST).reduce((n, i) => n + (i.declaredValue ?? 0), 0)
  const fee = covered ? Math.max(PROTECTION_MIN, Math.round(covered * PROTECTION_RATE)) : 0
  return { items: list, total, covered, fee, askFirst, on: !!details?.protection }
}
