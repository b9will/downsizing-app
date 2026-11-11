import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { Dot, Page } from '../components/ui'
import { ai } from '../lib/ai'
import { useStore } from '../lib/hooks'
import { store } from '../lib/store'
import { TAGS, type Job, type Tag } from '../lib/types'
import { ExportSheet } from '../components/ExportSheet'
import { detailsComplete } from './Details'

const money = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const TIERS: Array<[Job['tier'], string, string]> = [
  ['clear', 'Clear', 'We empty the home. Everything tagged is stored, donated, sold or disposed of.'],
  ['clear-move', 'Clear and move', 'Everything in Clear, plus we pack and move your Move items to the new home.'],
  ['clear-move-settle', 'Clear, move and settle', 'Everything above, plus we unpack, place furniture and take away every box.'],
]

// Step 1: choose the service. Step 2: see the estimate for that choice. Then send.
export default function Summary() {
  const job = useStore(() => store.getJob())
  const rooms = useStore(() => (job ? store.listRooms(job.id) : []))
  const items = useStore(() => (job ? store.listItems(job.id) : []))
  const [revealed, setRevealed] = useState(() => job?.status !== 'tagging')
  const [exporting, setExporting] = useState(false)
  if (!job) return null

  const user = store.getUser()
  const isOwner = job.ownerId === user?.id
  const ready = detailsComplete(job.details)
  const sent = job.status !== 'tagging'
  const q = ai.estimateQuote(job, items)
  const undecided = items.filter((i) => i.tag === 'undecided')
  const unfinished = rooms.filter((r) => !r.done)
  const counts = (Object.keys(TAGS) as Tag[]).map((t) => ({ t, n: items.filter((i) => i.tag === t).length })).filter((c) => c.n > 0)

  return (
    <Page>
      <h1 className="mb-1">{revealed ? 'Your estimate' : 'How much should we do?'}</h1>
      <p className="lead mb-6">{revealed ? 'Based on what you tagged and the service you chose.' : 'Pick first. Then we show the price.'}</p>

      <div className="eyebrow mb-2 px-1">1. Service</div>
      <div className="flex flex-col gap-2 mb-6" role="radiogroup">
        {TIERS.map(([v, label, desc]) => {
          const on = job.tier === v
          return (
            <button key={v} type="button" role="radio" aria-checked={on} onClick={() => store.saveJob({ ...job, tier: v })} className={`flex gap-3 p-4 rounded-[22px] text-left items-start ${on ? 'bg-surface shadow-[0_0_0_3px_#111]' : 'bg-soft'}`}>
              <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'border-ink bg-ink' : 'border-line'}`}>{on && <Check size={12} className="text-white" strokeWidth={3} />}</span>
              <span className="min-w-0"><span className="block font-semibold">{label}</span><span className="block text-ink-2 text-[14px]">{desc}</span></span>
            </button>
          )
        })}
      </div>

      <div className="eyebrow mb-2 px-1">2. What you tagged</div>
      <div className="card mb-6">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {counts.length ? counts.map((c) => <span key={c.t} className="inline-flex items-center gap-1.5 text-[15px] font-semibold"><Dot tag={c.t} size={26} /> {c.n}</span>) : <span className="text-ink-3 text-[14px]">Nothing tagged yet.</span>}
        </div>
        {(unfinished.length > 0 || undecided.length > 0) && (
          <div className="mt-3 pt-3 border-t border-line text-[14px] text-ink-2 flex flex-col gap-1">
            {unfinished.length > 0 && <div>{unfinished.length} room{unfinished.length === 1 ? '' : 's'} not marked done.</div>}
            {undecided.length > 0 && <Link to="/plan" className="flex items-center justify-between text-ink font-medium"><span>{undecided.length} item{undecided.length === 1 ? '' : 's'} still "Not sure"</span><ChevronRight size={16} className="text-ink-3" /></Link>}
          </div>
        )}
      </div>

      <div className="eyebrow mb-2 px-1">3. Estimate</div>
      {!revealed ? (
        <div className="card mb-6">
          <p className="text-ink-2 text-[14px] mb-3">Based on {items.length} tagged item{items.length === 1 ? '' : 's'} and the service you chose. Not binding; we confirm before anything is booked.</p>
          <button className="btn" disabled={items.length === 0} onClick={() => setRevealed(true)}>Show my estimate</button>
        </div>
      ) : (
        <div className="mb-6">
          <div className="rounded-3xl bg-ink text-white p-5 mb-3">
            <div className="text-[14px] text-white/70 mb-1">{TIERS.find(([v]) => v === job.tier)?.[1]}</div>
            <div className="text-[34px] font-semibold tracking-tight tabular-nums leading-none mb-2" style={{ fontFamily: 'var(--font-display)' }}>{money(q.priceLow)} <span className="text-white/60 text-[20px] font-medium">to</span> {money(q.priceHigh)}</div>
            <div className="text-[14px] text-white/70">All-in, before tax. Anything sold is credited back to you.</div>
          </div>
          <dl className="divide-y divide-line text-[15px]">
            {[['Crew', `${q.crew} movers`], ['Time on site', `${q.hours} hours`], ['Truck', q.truck], ['Boxes and supplies', `${q.boxes} boxes`],
              ...(q.storageUnit ? [['Storage', q.storageUnit]] : []),
              ...(q.donationLoads ? [['Donation pickups', String(q.donationLoads)]] : []),
              ...(q.junkLoads ? [['Disposal loads', String(q.junkLoads)]] : [])].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5"><dt className="text-ink-2">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
            ))}
          </dl>
          {q.notes.length > 0 && <ul className="mt-3 pt-3 border-t border-line text-[13px] text-ink-2 list-disc pl-4 space-y-1">{q.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </div>
      )}

      {revealed && (
        <>
          {!ready && (
            <Link to="/details" className="group mb-3 block"><div className="row py-3"><div className="flex-1"><div className="font-semibold">Add your details to send</div><div className="text-ink-2 text-[14px]">Phone and address, so we can plan the day.</div></div><ChevronRight className="text-ink-3" size={18} /></div></Link>
          )}
          <button className="btn" disabled={items.length === 0 || sent || !ready || !isOwner} onClick={() => store.saveJob({ ...job, status: 'review' })}>{sent ? 'Sent. We are reviewing it.' : isOwner ? 'Send to our team' : `${job.clientName.split(' ')[0]} sends this to our team`}</button>
          <button className="btn btn-ghost mt-1" disabled={items.length === 0} onClick={() => setExporting(true)}><FileSpreadsheet size={18} /> Export lists</button>
          <p className="text-ink-3 text-[13px] text-center mt-2">You can keep tagging after sending. We see the updates.</p>
        </>
      )}
      <ExportSheet open={exporting} onOpenChange={setExporting} job={job} rooms={rooms} items={items} />
    </Page>
  )
}
