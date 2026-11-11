// Spreadsheet exports. One file per audience: the whole job for us, or one
// destination list for the charity, the consignment house, the storage
// facility, the hauler, the crew, or a family member.
import { EMPTY_DETAILS, SIZES, TAGS, type Item, type Job, type Room, type Tag } from './types'

export type Scope = { kind: 'all' } | { kind: 'tag'; tag: Tag } | { kind: 'family'; recipient: string }

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (...vals: unknown[]) => vals.map(cell).join(',')
const when = () => new Date().toLocaleString('en-CA')

export const recipientOf = (i: Item) => i.familyRecipient?.trim() || 'Family (unassigned)'

export function scopeLabel(s: Scope): string {
  if (s.kind === 'all') return 'Everything'
  if (s.kind === 'tag') return TAGS[s.tag].name
  return s.recipient
}

export function itemsFor(items: Item[], s: Scope): Item[] {
  if (s.kind === 'all') return items
  if (s.kind === 'tag') return items.filter((i) => i.tag === s.tag)
  return items.filter((i) => i.tag === 'family' && recipientOf(i) === s.recipient)
}

/** What the person receiving this list needs to know, before the rows. */
function header(job: Job, s: Scope): string[][] {
  const d = { ...EMPTY_DETAILS, ...job.details }
  const pickup = [['Pickup address', d.currentAddress], ['Access notes', d.accessNotes], ['Contact', job.clientName], ['Contact phone', d.phone], ['Move date', d.moveDate]]
  const ours = [['Prepared by', 'Dot'], ['Prepared', when()]]
  switch (s.kind === 'tag' ? s.tag : s.kind) {
    case 'all': return [['Client', job.clientName], ['Phone', d.phone], ['Email', d.email], ['Current address', d.currentAddress], ['New address', d.newAddress], ['Move date', d.moveDate], ['Service', { clear: 'Clear', 'clear-move': 'Clear and move', 'clear-move-settle': 'Clear, move and settle' }[job.tier]], ['Status', job.status], ['Family contact', [d.contactName, d.contactRelation, d.contactPhone].filter(Boolean).join(', ')], ['Preferred charity', d.charity], ['Charity address', d.charityAddress], ['Access notes', d.accessNotes], ...ours]
    case 'donate': return [['Donation list for', d.charity || 'Charity partner'], ['Drop-off or pickup location', d.charityAddress], ...pickup, ...ours]
    case 'sell': return [['Consignment list'], ...pickup, ['Proceeds to', job.clientName], ...ours]
    case 'store': return [['Storage inventory'], ['Owner', job.clientName], ['Owner phone', d.phone], ['From', d.currentAddress], ...ours]
    case 'junk': return [['Disposal and recycling list'], ...pickup, ...ours]
    case 'move': return [['Items moving to the new home'], ['From', d.currentAddress], ['To', d.newAddress], ...pickup.slice(1), ...ours]
    case 'keep': return [['Items staying in the home'], ['Address', d.currentAddress], ...ours]
    case 'undecided': return [['Items still to decide'], ['Client', job.clientName], ['Phone', d.phone], ...ours]
    case 'family': return [['Items for', s.kind === 'family' ? s.recipient : ''], ['From', job.clientName], ['Pickup address', d.currentAddress], ['Contact phone', d.phone], ...ours]
    default: return ours
  }
}

export function buildCsv(job: Job, rooms: Room[], items: Item[], s: Scope = { kind: 'all' }): string {
  const list = itemsFor(items, s)
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? ''
  const order = (i: Item) => rooms.findIndex((r) => r.id === i.roomId)
  const sorted = [...list].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name))
  const showDecision = s.kind === 'all'
  const showFor = s.kind === 'all' || (s.kind === 'tag' && s.tag === 'family')
  const cols = ['#', 'Sticker', 'Colour', 'Room', 'Item', 'Qty', ...(showDecision ? ['Decision'] : []), 'Size', ...(showFor ? ['For'] : []), 'Note', 'Photo', 'Status']
  const lines = [
    ...header(job, s).map((r) => row(...r)),
    '',
    row('Items', list.length),
    ...(s.kind === 'all' ? [row('By decision', ...Object.values(TAGS).map((t) => t.name)), row('', ...Object.keys(TAGS).map((t) => items.filter((i) => i.tag === t).length))] : []),
    '',
    row(...cols),
    ...sorted.map((i, n) => row(n + 1, i.sticker ?? '', TAGS[i.tag].sticker, roomName(i.roomId), i.name, i.qty ?? 1, ...(showDecision ? [TAGS[i.tag].name] : []), SIZES[i.size].split(' (')[0], ...(showFor ? [i.familyRecipient ?? ''] : []), i.note ?? '', i.photo ? 'yes' : 'no', i.status === 'tagged' ? '' : i.status + (i.statusNote ? `: ${i.statusNote}` : ''))),
  ]
  return '﻿' + lines.join('\r\n')
}

/** Share on phones (opens the iOS share sheet), download elsewhere. */
export async function exportCsv(job: Job, rooms: Room[], items: Item[], s: Scope = { kind: 'all' }): Promise<'shared' | 'downloaded'> {
  const csv = buildCsv(job, rooms, items, s)
  const slug = (t: string) => t.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  const name = `${slug(job.clientName) || 'client'}-${slug(scopeLabel(s))}-${new Date().toISOString().slice(0, 10)}.csv`
  const file = new File([csv], name, { type: 'text/csv' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `${scopeLabel(s)} list` }); return 'shared' } catch { /* cancelled; fall through */ }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}
