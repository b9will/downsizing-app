export type Tag =
  | 'keep'
  | 'move'
  | 'family'
  | 'sell'
  | 'store'
  | 'donate'
  | 'junk'
  | 'undecided'

export type SizeClass = 'small' | 'medium' | 'large' | 'oversize'

// One colour per destination, used everywhere: app, printed stickers, lists, guest pages.
// Stickers are standard dot colours so crew mode can read them by colour or by the printed word.
export const TAGS: Record<Tag, { name: string; desc: string; sticker: string; hex: string; fg: string }> = {
  move: { name: 'Move', desc: 'Goes to the new home', sticker: 'Blue', hex: '#1d4ed8', fg: '#fff' },
  keep: { name: 'Keep', desc: 'Stays where it is', sticker: 'Green', hex: '#15803d', fg: '#fff' },
  family: { name: 'Family', desc: 'Goes to a relative', sticker: 'Purple', hex: '#7e22ce', fg: '#fff' },
  sell: { name: 'Sell', desc: 'Has resale value', sticker: 'Orange', hex: '#ea580c', fg: '#fff' },
  donate: { name: 'Donate', desc: 'Usable, give away', sticker: 'Yellow', hex: '#facc15', fg: '#16181c' },
  junk: { name: 'Junk', desc: 'Dispose or recycle', sticker: 'Red', hex: '#dc2626', fg: '#fff' },
  store: { name: 'Store', desc: 'Keep, but not now', sticker: 'Black', hex: '#111111', fg: '#fff' },
  undecided: { name: 'Not sure', desc: 'We will help you decide', sticker: 'White', hex: '#ffffff', fg: '#16181c' },
}
export const TAG_ORDER: Tag[] = ['move', 'donate', 'sell', 'family', 'store', 'junk', 'keep', 'undecided']

export const SIZES: Record<SizeClass, string> = {
  small: 'Small (fits in a box)',
  medium: 'Medium (lamp, chair)',
  large: 'Large (dresser, sofa)',
  oversize: 'Oversize (piano, wardrobe)',
}

export interface User {
  id: string
  email: string
  name: string
  role: 'client' | 'crew' | 'admin'
}
export const isStaff = (u: User | null) => u?.role === 'crew' || u?.role === 'admin'

/** Who is driving this job: the owner, a family member helping, or an executor. */
export type JobMode = 'self' | 'helper' | 'estate'

export interface Job {
  id: string
  ownerId: string
  clientName: string
  tier: 'clear' | 'clear-move' | 'clear-move-settle'
  moveDate: string | null
  tagDeadline: string
  status: 'tagging' | 'review' | 'scheduled' | 'in_progress' | 'done' | 'cancelled'
  stickerKit: boolean
  createdAt: string
  details?: JobDetails
  /** Billing, set by the server only. */
  plan?: 'free' | 'pass'
  passUntil?: string | null
  depositPaidAt?: string | null
}
export interface JobDetails {
  phone: string
  email: string
  currentAddress: string
  newAddress: string
  moveDate: string
  contactName: string
  contactRelation: string
  contactPhone: string
  charity: string
  charityAddress: string
  accessNotes: string
  mode?: JobMode
}
export const EMPTY_DETAILS: JobDetails = {
  phone: '', email: '', currentAddress: '', newAddress: '', moveDate: '',
  contactName: '', contactRelation: '', contactPhone: '', charity: '', charityAddress: '', accessNotes: '',
}

export interface Room {
  id: string
  jobId: string
  name: string
  order: number
  done: boolean
}

export type ItemStatus = 'tagged' | 'loaded' | 'delivered' | 'collected' | 'damaged' | 'missing' | 'rejected'
export type Contents = 'none' | 'donate' | 'junk' | 'leave' | 'family' | 'sort'
export interface Item {
  id: string
  jobId: string
  roomId: string
  name: string
  tag: Tag
  size: SizeClass
  /** Displayable URL: a local data URL until uploaded, then a signed URL. */
  photo?: string
  photoPath?: string
  note?: string
  familyRecipient?: string
  sticker?: string
  status: ItemStatus
  statusNote?: string
  /** One-line look of the item, written by the room scan. */
  description?: string
  /** What the owner must do before movers arrive (e.g. unplug the fridge). */
  prep?: string
  /** What happens to what's inside a container. */
  contents?: Contents
  /** How many identical pieces this entry covers (a set of 4 dining chairs = 4). */
  qty?: number
  source?: 'manual' | 'quickscan' | 'sticker'
  createdAt: string
  updatedAt: string
}
/** Things that usually come in matching sets, so we ask how many. */
const SET_RE = /chair|stool|side table|end table|night ?stand|bedside|lamp|speaker|bench|ottoman|cushion|pillow|bookcase|bookshel|shelf|shelving|bin\b|bins|tote|planter|pot\b|suitcase|luggage|mirror|frame|sconce|curtain|blind|tire|tyre|monitor|filing cabinet|locker|crate|box/i
export const isSetLike = (name: string) => SET_RE.test(name)
/** "Dining chair" or "Dining chair, set of 4". */
export const itemLabel = (i: { name: string; qty?: number }) => ((i.qty ?? 1) > 1 ? `${i.name}, set of ${i.qty}` : i.name)

export interface ItemEvent { id: string; itemId: string; status: string; note?: string; photo?: string; byLabel?: string; at: string }

export interface Quote {
  crew: number
  hours: number
  truck: string
  boxes: number
  storageUnit: string | null
  donationLoads: number
  junkLoads: number
  priceLow: number
  priceHigh: number
  notes: string[]
}

/** Pictogram for each destination, drawn inside its dot. Same icon is printed on the sticker. */
export const TAG_ICON: Record<Tag, string> = {
  move: 'M2 6h12v10H2z M14 9h4l4 4v3h-8 M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M16 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  keep: 'M3 11l9-7 9 7v9H3z M9 20v-6h6v6',
  family: 'M6 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M14.5 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M15.5 14.5c2.6.2 4.5 2.3 4.5 5',
  sell: 'M3 12V4h8l9 9-8 8z M6 8.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
  donate: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  junk: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  store: 'M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8',
  undecided: 'M9 9a3 3 0 1 1 4.2 2.8c-.7.3-1.2 1-1.2 1.8V15 M12 18.5v.5',
}
