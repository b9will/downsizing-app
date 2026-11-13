import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Dot, Page } from '../components/ui'
import { useStore } from '../lib/hooks'
import { storageFor } from '../lib/ai'
import { store } from '../lib/store'
import { EMPTY_DETAILS, type Item, type JobDetails, type Tag } from '../lib/types'

// Everything about the move that is not an item: how to reach them, the home, and where each colour is headed.
type Field = { key: keyof JobDetails; label: string; type?: string; hint?: string; textarea?: boolean; placeholder?: string }
type Section = { id: string; title: string; tag?: Tag; blurb?: string; fields: Field[] }
const SECTIONS: Section[] = [
  { id: 'you', title: 'You', fields: [
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'email', label: 'Email', type: 'email' },
  ] },
  { id: 'home', title: 'The home', fields: [
    { key: 'currentAddress', label: 'Address of the home', textarea: true },
    { key: 'moveDate', label: 'Preferred move date', type: 'date' },
    { key: 'accessNotes', label: 'Access notes', textarea: true, hint: 'Stairs, elevator booking, parking, pets, anything our crew should know.' },
  ] },
  { id: 'move', title: 'Moving to', tag: 'move', blurb: 'Where the blue dots are going.', fields: [
    { key: 'newAddress', label: 'New address', textarea: true, hint: 'A residence name and suite number is fine. Leave blank if nothing is moving.' },
  ] },
  { id: 'donate', title: 'Donations', tag: 'donate', blurb: 'Where the yellow dots are going. Our crew delivers them for you.', fields: [
    { key: 'charity', label: 'Charity you would like to give to', hint: 'Any GTA charity that takes drop-offs. Leave blank and we will suggest one that takes what you have. Tax receipts come from the charity.' },
    { key: 'charityAddress', label: 'Drop-off location or pickup details', textarea: true },
  ] },
  { id: 'sell', title: 'Selling', tag: 'sell', blurb: 'Where the orange dots are going.', fields: [
    { key: 'consignment', label: 'Consignment house, auction or dealer', textarea: true, hint: 'Leave blank and we will arrange one. Anything sold is credited back to you.' },
  ] },
  { id: 'store', title: 'Storage', tag: 'store', blurb: 'Where the black dots are going. Our crew delivers into your unit.', fields: [
    { key: 'storage', label: 'Storage facility and unit', textarea: true, hint: 'You rent the unit in your own name. Not booked yet? Leave this blank and we will suggest a facility near you.' },
  ] },
  { id: 'family', title: 'Family items', tag: 'family', blurb: 'How the purple dots get to their people.', fields: [
    { key: 'familyNotes', label: 'Pickup or delivery plans', textarea: true, placeholder: 'Sarah is collecting on Saturday. The clock goes to David in Ottawa.' },
  ] },
  { id: 'contact', title: 'Someone else we can call', fields: [
    { key: 'contactName', label: 'Name' },
    { key: 'contactRelation', label: 'Relationship', hint: 'For example, daughter.' },
    { key: 'contactPhone', label: 'Phone', type: 'tel' },
  ] },
]

export const REQUIRED: Array<keyof JobDetails> = ['phone', 'currentAddress']
export const detailsComplete = (d?: JobDetails) => REQUIRED.every((k) => (d?.[k] ?? '').trim().length > 0)
/** What to show for each destination on other screens: the saved place, or nothing yet. */
export const destinationFor = (d: JobDetails | undefined, tag: Tag): string => {
  const v = { ...EMPTY_DETAILS, ...d }
  const one = (s?: string) => (s ?? '').trim().split('\n')[0]
  return ({ move: one(v.newAddress), donate: one(v.charity) || one(v.charityAddress), sell: one(v.consignment), store: one(v.storage), family: one(v.familyNotes) } as Partial<Record<Tag, string>>)[tag] ?? ''
}

export default function Details() {
  const nav = useNavigate()
  const loc = useLocation()
  const job = store.getJob()
  const items = useStore(() => (job ? store.listItems(job.id) : [])) as Item[]
  const [d, setD] = useState<JobDetails>({ ...EMPTY_DETAILS, ...job?.details })
  // Arriving from "Add" beside a destination jumps straight to that section.
  useEffect(() => { const id = loc.hash.slice(1); if (id) document.getElementById(`sec-${id}`)?.scrollIntoView({ block: 'start' }) }, [loc.hash])
  if (!job) return null

  const save = () => { store.saveJob({ ...job, details: d }); nav(-1) }
  const set = (k: keyof JobDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value })
  const st = storageFor(items)
  const count = (t: Tag) => items.filter((i) => i.tag === t).reduce((n, i) => n + (i.qty ?? 1), 0)

  return (
    <Page className="pb-40">
      <button onClick={() => nav(-1)} aria-label="Back" className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center mb-3"><ChevronLeft size={22} /></button>
      <h1 className="mb-1">Details</h1>
      <p className="lead mb-6">How to reach you, and where everything is going. Only your phone and the home's address are needed to book. The rest can wait.</p>

      <div className="flex flex-col gap-4">
        {SECTIONS.map((s) => {
          const n = s.tag ? count(s.tag) : 0
          return (
            <section key={s.id} id={`sec-${s.id}`} className="card scroll-mt-4">
              <div className="flex items-center gap-3 mb-3">
                {s.tag && <Dot tag={s.tag} size={36} />}
                <div className="min-w-0"><h2 className="text-[20px] leading-tight">{s.title}</h2>{s.tag && <p className="text-ink-2 text-[14px]">{n ? `${n} piece${n === 1 ? '' : 's'} so far. ` : 'Nothing tagged yet. '}{s.blurb}</p>}</div>
              </div>
              {s.id === 'store' && st && (
                <div className="rounded-2xl bg-ink text-white p-4 mb-3">
                  <div className="text-white/70 text-[13px] font-semibold uppercase tracking-wide">Unit size you will need</div>
                  <div className="text-[30px] font-semibold leading-tight mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>{st.unit} unit{st.tooBig ? ' or larger' : ''}</div>
                  <div className="h-2 rounded-full bg-white/20 overflow-hidden my-2.5" role="img" aria-label={`About ${Math.round(st.fill * 100)}% of the unit filled`}><div className="h-full rounded-full bg-white" style={{ width: `${Math.max(6, st.fill * 100)}%` }} /></div>
                  <p className="text-white/80 text-[14px]">{st.pieces} piece{st.pieces === 1 ? '' : 's'}, roughly {st.cubicFeet} cubic feet once packed. That unit is about the size of {st.like}. An estimate from the sizes on your list; it updates as you change dots.</p>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {s.fields.map((f) => (
                  <div key={f.key}>
                    <label className="block font-medium text-[15px] mb-1" htmlFor={f.key}>
                      {f.label}{REQUIRED.includes(f.key) && <span className="text-ink-2 font-normal"> (needed to book)</span>}
                    </label>
                    {f.textarea
                      ? <textarea id={f.key} className="input py-3 h-auto min-h-20 bg-surface" placeholder={f.placeholder} value={d[f.key] ?? ''} onChange={set(f.key)} />
                      : <input id={f.key} className="input bg-surface" type={f.type ?? 'text'} value={d[f.key] ?? ''} onChange={set(f.key)} autoComplete={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'off'} />}
                    {f.hint && <p className="text-ink-2 text-[13px] mt-1">{f.hint}</p>}
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
      <div className="fixed inset-x-0 bottom-[calc(var(--spacing-safe-b)+64px)] z-20 bg-surface/95 backdrop-blur border-t border-line">
        <div className="max-w-xl mx-auto px-5 pt-3 pb-9"><button className="btn" onClick={save}>Save</button></div>
      </div>
    </Page>
  )
}
