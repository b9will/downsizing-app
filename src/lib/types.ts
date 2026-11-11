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
  store: { name: 'Store', desc: 'Keep, but not now', sticker: 'Black', hex: '#16181c', fg: '#fff' },
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
  createdAt: string
  updatedAt: string
}
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
