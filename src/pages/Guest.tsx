import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Phone, Printer } from 'lucide-react'
import { TagPill } from '../components/ui'
import { SUPABASE_URL } from '../lib/supabase'
import { SIZES, TAGS, type Tag } from '../lib/types'

type GuestData = {
  label: string; scope: { kind: string; tag?: Tag; recipient?: string }; expires_at: string
  job: { client: string; moveDate: string | null; pickupAddress: string; accessNotes: string; phone: string; charity: string; charityAddress: string }
  rooms: { id: string; name: string }[]
  items: { id: string; room_id: string; name: string; size: keyof typeof SIZES; tag: Tag; family_recipient: string | null; note: string | null; photo: string | null; sticker: string | null; status: string; status_note: string | null }[]
}
const STATUS: Record<string, string> = { loaded: 'On the truck', delivered: 'Delivered', collected: 'Handed off', damaged: 'Damaged', missing: 'Missing', rejected: 'Refused' }
const maps = (a: string) => `https://maps.apple.com/?q=${encodeURIComponent(a)}`

// Public page for a charity, consignment house, storage facility or relative. No login.
export default function Guest() {
  const { token = '' } = useParams()
  const [data, setData] = useState<GuestData | null>(null)
  const [error, setError] = useState('')
  const [big, setBig] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${SUPABASE_URL}/functions/v1/guest?t=${encodeURIComponent(token)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'This link is not valid.'); setData(j) })
      .catch((e) => setError(e.message === 'Failed to fetch' ? 'Could not load. Check your connection and refresh.' : e.message))
  }, [token])

  if (error) return <div className="page min-h-full flex flex-col justify-center"><h1 className="mb-2">Link unavailable</h1><p className="lead">{error}</p></div>
  if (!data) return <div className="min-h-full flex items-center justify-center text-ink-2" role="status">Loading…</div>

  const { job, items, scope } = data
  const tag = scope.kind === 'tag' ? scope.tag : scope.kind === 'family' ? 'family' : undefined
  const title = scope.kind === 'family' ? `Items for ${scope.recipient}` : tag === 'donate' ? `Donation list` : tag === 'sell' ? 'Consignment list' : tag === 'store' ? 'Storage inventory' : tag === 'junk' ? 'Disposal list' : tag === 'move' ? 'Moving list' : 'Item list'
  const room = (id: string) => data.rooms.find((r) => r.id === id)?.name ?? ''
  const date = job.moveDate ? new Date(job.moveDate + 'T12:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) : null

  return (
    <div className="page max-w-3xl pb-16">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">Dot</span>
        <button className="no-print btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={16} /> Print</button>
      </div>
      <div className="flex items-center gap-2 mb-2">{tag && <TagPill tag={tag} />}{tag && <span className="text-ink-2 text-[15px]">Look for {TAGS[tag].sticker.toLowerCase()} stickers</span>}</div>
      <h1 className="mb-1">{title}</h1>
      <p className="lead mb-5">{items.length} item{items.length === 1 ? '' : 's'} from {job.client}{date ? `, ready ${date}` : ''}{data.label ? ` · for ${data.label.replace(/^For the /i, 'the ')}` : ''}</p>

      <div className="group mb-6">
        {job.pickupAddress && <a href={maps(job.pickupAddress)} className="row py-3"><MapPin size={20} className="text-ink-2" /><span className="flex-1"><span className="block text-ink-2 text-[14px]">Pickup</span>{job.pickupAddress}</span></a>}
        {job.phone && <a href={`tel:${job.phone.replace(/[^\d+]/g, '')}`} className="row py-3"><Phone size={20} className="text-ink-2" /><span className="flex-1"><span className="block text-ink-2 text-[14px]">Contact</span>{job.phone}</span></a>}
        {job.accessNotes && <div className="row py-3 items-start"><span className="flex-1"><span className="block text-ink-2 text-[14px]">Access</span>{job.accessNotes}</span></div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((i, n) => (
          <div key={i.id} className="card p-3 flex gap-3" style={{ breakInside: 'avoid' }}>
            <button type="button" onClick={() => i.photo && setBig(i.photo)} className="w-24 h-24 rounded-lg bg-surface-2 overflow-hidden shrink-0" aria-label={i.photo ? `Enlarge photo of ${i.name}` : undefined}>{i.photo && <img src={i.photo} alt={i.name} className="w-full h-full object-cover" />}</button>
            <div className="min-w-0">
              <div className="font-semibold text-[17px] leading-tight">{i.sticker ? `#${i.sticker} ` : `${n + 1}. `}{i.name}</div>
              <div className="text-ink-2 text-[15px]">{room(i.room_id)} · {SIZES[i.size].split(' (')[0]}</div>
              {i.note && <div className="text-[15px] mt-0.5">{i.note}</div>}
              {STATUS[i.status] && <div className="text-[14px] font-semibold mt-1">{STATUS[i.status]}{i.status_note ? `: ${i.status_note}` : ''}</div>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-ink-2 text-[14px] mt-6">This list updates as the family makes changes. Link valid until {new Date(data.expires_at).toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}.</p>

      {big && <button type="button" className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setBig(null)} aria-label="Close photo"><img src={big} alt="" className="max-w-full max-h-full rounded-lg" /></button>}
    </div>
  )
}
