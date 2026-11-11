import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Page } from '../components/ui'
import { store } from '../lib/store'
import { EMPTY_DETAILS, type JobDetails } from '../lib/types'

type Field = { key: keyof JobDetails; label: string; type?: string; hint?: string; textarea?: boolean }
const SECTIONS: Array<{ title: string; fields: Field[] }> = [
  { title: 'You', fields: [
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'email', label: 'Email', type: 'email' },
  ] },
  { title: 'The move', fields: [
    { key: 'currentAddress', label: 'Current address', textarea: true },
    { key: 'newAddress', label: 'New address', textarea: true, hint: 'Leave blank if you are not moving anything.' },
    { key: 'moveDate', label: 'Preferred move date', type: 'date' },
    { key: 'accessNotes', label: 'Access notes', textarea: true, hint: 'Stairs, elevator booking, parking, pets, anything our crew should know.' },
  ] },
  { title: 'Family contact', fields: [
    { key: 'contactName', label: 'Name' },
    { key: 'contactRelation', label: 'Relationship', hint: 'e.g. daughter' },
    { key: 'contactPhone', label: 'Phone', type: 'tel' },
  ] },
  { title: 'Donations', fields: [
    { key: 'charity', label: 'Preferred charity', hint: 'We can suggest one if you leave this blank.' },
    { key: 'charityAddress', label: 'Drop-off location', textarea: true },
  ] },
]

export const REQUIRED: Array<keyof JobDetails> = ['phone', 'currentAddress']
export const detailsComplete = (d?: JobDetails) => REQUIRED.every((k) => (d?.[k] ?? '').trim().length > 0)

export default function Details() {
  const nav = useNavigate()
  const job = store.getJob()
  const [d, setD] = useState<JobDetails>({ ...EMPTY_DETAILS, ...job?.details })
  if (!job) return null

  const save = () => { store.saveJob({ ...job, details: d }); nav(-1) }
  const set = (k: keyof JobDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value })

  return (
    <Page>
      <Link to="/" className="back"><ChevronLeft size={18} /> Home</Link>
      <h1 className="mb-1">Your details</h1>
      <p className="lead mb-6">So we can plan the day and reach you. Phone and current address are the only must-haves.</p>

      <div className="flex flex-col gap-5">
        {SECTIONS.map((s) => (
          <section key={s.title} className="card">
            <div className="eyebrow mb-3">{s.title}</div>
            <div className="flex flex-col gap-3">
              {s.fields.map((f) => (
                <div key={f.key}>
                  <label className="block font-medium text-[14px] mb-1" htmlFor={f.key}>
                    {f.label}{REQUIRED.includes(f.key) && <span className="text-danger"> *</span>}
                  </label>
                  {f.textarea
                    ? <textarea id={f.key} className="input py-3 h-auto min-h-20" value={d[f.key]} onChange={set(f.key)} />
                    : <input id={f.key} className="input" type={f.type ?? 'text'} value={d[f.key]} onChange={set(f.key)} autoComplete={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'off'} />}
                  {f.hint && <p className="text-ink-3 text-[13px] mt-1">{f.hint}</p>}
                </div>
              ))}
            </div>
          </section>
        ))}
        <button className="btn" disabled={!detailsComplete(d)} onClick={save}>Save</button>
      </div>
    </Page>
  )
}
