import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Truck } from 'lucide-react'
import { Dot, Page } from '../components/ui'
import { ai } from '../lib/ai'
import { useStore } from '../lib/hooks'
import { startCheckout } from '../lib/pay'
import { store } from '../lib/store'
import { TAG_ORDER, type Job } from '../lib/types'
import { detailsComplete } from './Details'

const money = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const TIERS: Array<[Job['tier'], string, string]> = [
  ['clear', 'Clear', 'We empty the home'],
  ['clear-move', 'Clear + move', 'Plus pack and move'],
  ['clear-move-settle', '+ Settle in', 'Plus unpack and place'],
]
const niceDate = (d?: string | null) => { if (!d) return ''; const t = new Date(`${d.slice(0, 10)}T12:00:00`); return isNaN(+t) ? '' : t.toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' }) }

// The booking page. Their home, the price, what is included, and one button.
export default function Book() {
  const job = useStore(() => store.getJob())
  const rooms = useStore(() => (job ? store.listRooms(job.id) : []))
  const items = useStore(() => (job ? store.listItems(job.id) : []))
  const [busy, setBusy] = useState(false)
  const [payMsg, setPayMsg] = useState('')
  if (!job) return null
  // Booking takes the $100 deposit on Stripe's page. If payments are not switched on yet, it books without one.
  const book = async () => {
    setBusy(true); setPayMsg('')
    const r = await startCheckout('deposit', job)
    setBusy(false)
    if (r.off) store.saveJob({ ...job, status: 'review' }); else setPayMsg(r.message)
  }

  const user = store.getUser()
  const isOwner = job.ownerId === user?.id
  const first = job.clientName.split(' ')[0]
  const ready = detailsComplete(job.details)
  const booked = job.status !== 'tagging'
  const q = ai.estimateQuote(job, items)
  const pieces = items.reduce((n, i) => n + (i.qty ?? 1), 0)
  const undecided = items.filter((i) => i.tag === 'undecided').length
  const when = niceDate(job.details?.moveDate || job.moveDate)
  const photos = items.filter((i) => i.photo).slice(0, 4)
  const more = items.length - photos.length
  const tags = TAG_ORDER.map((t) => ({ t, n: items.filter((i) => i.tag === t).reduce((n, i) => n + (i.qty ?? 1), 0) })).filter((c) => c.n)
  const included = [
    `${q.crew} movers for about ${q.hours} hours`,
    `${q.truck}${job.tier === 'clear' ? '' : `, ${q.boxes} boxes and all packing`}`,
    ...(q.donationLoads ? ['Donation drop-off, with receipts'] : []),
    ...(q.junkLoads ? ['Disposal and recycling'] : []),
    ...(items.some((i) => i.tag === 'sell') ? ['Consignment pickup, proceeds to you'] : []),
    ...(q.storageUnit ? [`Storage: ${q.storageUnit}`] : []),
    ...(job.tier === 'clear-move-settle' ? ['Unpacking, furniture placed, boxes taken away'] : []),
  ]

  if (items.length === 0) {
    return (
      <Page className="min-h-full flex flex-col gap-4 pt-10">
        <span className="w-16 h-16 rounded-full bg-ink text-white flex items-center justify-center"><Truck size={30} /></span>
        <h1>Scan a room first</h1>
        <p className="lead">Once we can see what's in the home, your price and crew show up here.</p>
        <Link to="/rooms" className="btn mt-2">Go to rooms</Link>
      </Page>
    )
  }

  return (
    <Page className="flex flex-col gap-4 pb-56">
      {photos.length > 0 && (
        <div className={`grid gap-1 h-44 rounded-3xl overflow-hidden ${photos.length > 1 ? 'grid-cols-[2fr_1fr_1fr] grid-rows-2' : ''}`}>
          {photos.map((i, n) => <img key={i.id} src={i.photo} alt="" className={`w-full h-full object-cover bg-surface-2 ${n === 0 && photos.length > 1 ? 'row-span-2' : ''}`} />)}
          {photos.length > 1 && more > 0 && <div className="bg-ink text-white flex items-center justify-center font-semibold">+{more}</div>}
        </div>
      )}
      <div>
        <h1 className="text-[32px]">{booked ? 'Your move is with our team.' : 'Your move, handled.'}</h1>
        <p className="text-ink-2 text-[16px] mt-1">{[`${pieces} piece${pieces === 1 ? '' : 's'}`, `${rooms.length} rooms`, when].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">{tags.map((c) => <span key={c.t} className="inline-flex items-center gap-1.5 text-[15px] font-semibold"><Dot tag={c.t} size={26} /> {c.n}</span>)}</div>

      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Service">
        {TIERS.map(([v, label, sub]) => {
          const on = job.tier === v
          return <button key={v} type="button" role="radio" aria-checked={on} disabled={booked || !isOwner} onClick={() => store.saveJob({ ...job, tier: v })} className={`min-h-16 px-2 py-2.5 rounded-[18px] text-center leading-tight ${on ? 'bg-ink text-white' : 'bg-surface-2 text-ink'} ${booked && !on ? 'opacity-40' : ''}`}><span className="block font-semibold text-[14px]">{label}</span><span className={`block text-[12px] mt-0.5 ${on ? 'text-white/70' : 'text-ink-2'}`}>{sub}</span></button>
        })}
      </div>

      <div>
        <div className="text-[36px] font-semibold tracking-tight tabular-nums leading-none" style={{ fontFamily: 'var(--font-display)' }}>{money(q.priceLow)} <span className="text-ink-3 text-[20px] font-medium">to</span> {money(q.priceHigh)}</div>
        <p className="text-ink-2 text-[15px] mt-1.5">All-in estimate, before tax. Anything sold is credited back to you.</p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {included.map((t) => <li key={t} className="flex items-center gap-2.5 text-[16px]"><span className="w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center shrink-0"><Check size={14} strokeWidth={3} /></span>{t}</li>)}
      </ul>

      {undecided > 0 && <Link to="/sort" className="card flex items-center gap-3 py-3"><Dot tag="undecided" size={30} /><span className="flex-1"><b className="block font-semibold">{undecided} item{undecided === 1 ? '' : 's'} still to sort</b><span className="text-ink-2 text-[14px]">The price firms up as you decide</span></span><ChevronRight size={18} className="text-ink-3" /></Link>}
      <Link to="/plan" className="card flex items-center gap-3 py-3"><span className="flex-1 font-semibold">See the full plan, room by room</span><ChevronRight size={18} className="text-ink-3" /></Link>
      {q.notes.length > 0 && <ul className="text-[14px] text-ink-2 list-disc pl-5 space-y-1">{q.notes.map((n) => <li key={n}>{n}</li>)}</ul>}

      {/* Sticky action bar, above the tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(var(--spacing-safe-b)+64px)] z-20 bg-surface/95 backdrop-blur border-t border-line">
        <div className="max-w-xl mx-auto px-5 pt-3 pb-9">
          {booked ? <p className="text-center font-semibold" role="status">{job.depositPaidAt ? 'Booked, deposit received.' : 'Booked.'} We'll confirm the date and final price with you.</p>
            : !isOwner ? <p className="text-center text-ink-2">{first} books the move.</p>
            : !ready ? <Link to="/details" className="btn">Add your phone and address to book</Link>
            : <button className="btn" disabled={busy} onClick={book}><Truck size={20} /> {busy ? 'Opening secure payment…' : `${when ? `Book ${when.split(', ').slice(1).join(', ') || when}` : 'Book my move'} · $100 deposit`}</button>}
          {!booked && isOwner && ready && <p className={`text-[13px] text-center mt-1.5 ${payMsg ? 'text-danger font-semibold' : 'text-ink-2'}`} role={payMsg ? 'alert' : undefined}>{payMsg || 'The deposit comes off your final price. We confirm the date with you.'}</p>}
        </div>
      </div>
    </Page>
  )
}
