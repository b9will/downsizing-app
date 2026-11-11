import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileSpreadsheet, MapPin, Phone, ScanLine, Search } from 'lucide-react'
import { Page, TagPill } from '../../components/ui'
import { ExportSheet } from '../../components/ExportSheet'
import { store } from '../../lib/store'
import { TAG_ORDER, TAGS, type Job, type Tag } from '../../lib/types'
import { useCrewJob } from './useCrewJob'

const maps = (a: string) => `https://maps.apple.com/?q=${encodeURIComponent(a)}`
const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`

/** Where each destination goes on the day. */
export function stopAddress(job: Job, tag: Tag): string {
  const d = job.details
  if (tag === 'move') return d?.newAddress || 'New address not set'
  if (tag === 'donate') return [d?.charity, d?.charityAddress].filter(Boolean).join(', ') || 'Charity partner'
  if (tag === 'family') return 'Per family member'
  if (tag === 'keep') return 'Stays. Do not touch'
  if (tag === 'undecided') return 'Ask the client'
  return { sell: 'Consignment partner', store: 'Storage facility', junk: 'Disposal and recycling' }[tag] as string
}
export const DONE_WORD: Record<Tag, string> = { move: 'Delivered', family: 'Delivered', store: 'In storage', sell: 'Handed off', donate: 'Handed off', junk: 'Disposed', keep: 'Checked', undecided: 'Resolved' }

const STATUSES: Array<[Job['status'], string]> = [['review', 'To review'], ['scheduled', 'Scheduled'], ['in_progress', 'In progress'], ['done', 'Done']]

export default function CrewJob() {
  const { jobId = '' } = useParams()
  const { job, items, loading } = useCrewJob(jobId)
  const rooms = job ? store.listRooms(job.id) : []
  const [exporting, setExporting] = useState(false)
  const [q, setQ] = useState('')
  if (!job) return <Page><Link to="/crew" className="back"><ChevronLeft size={18} /> Jobs</Link><p className="text-ink-2">{loading ? 'Loading…' : 'Job not found.'}</p></Page>
  const d = job.details

  const hits = q.trim() ? items.filter((i) => i.sticker?.includes(q.trim()) || i.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : []
  const stops = TAG_ORDER.map((t) => {
    const list = items.filter((i) => i.tag === t)
    return { t, n: list.length, loaded: list.filter((i) => i.status !== 'tagged').length, done: list.filter((i) => ['delivered', 'collected'].includes(i.status)).length, problems: list.filter((i) => ['damaged', 'missing', 'rejected'].includes(i.status)).length }
  }).filter((s) => s.n)

  return (
    <Page>
      <Link to="/crew" className="back"><ChevronLeft size={18} /> Jobs</Link>
      <h1 className="mb-1">{job.clientName}</h1>
      <p className="lead mb-4">{items.length} items · {rooms.length} rooms{job.stickerKit ? ' · Sticker kit' : ''}</p>

      <div className="group mb-4">
        {d?.currentAddress && <a href={maps(d.currentAddress)} className="row py-3"><MapPin size={20} className="text-ink-2" /><span className="flex-1">{d.currentAddress}</span><ChevronRight size={18} className="text-ink-3" /></a>}
        {d?.phone && <a href={tel(d.phone)} className="row py-3"><Phone size={20} className="text-ink-2" /><span className="flex-1">{d.phone}{d.contactName ? <span className="text-ink-2"> · family: {d.contactName} {d.contactPhone}</span> : null}</span></a>}
        {d?.accessNotes && <div className="row py-3 items-start"><span className="eyebrow mt-1 w-16 shrink-0">Access</span><span className="flex-1">{d.accessNotes}</span></div>}
        <div className="px-4 py-3">
          <div className="eyebrow mb-2">Job status</div>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(([v, label]) => (
              <button key={v} onClick={() => store.saveJob({ ...job, status: v })} aria-pressed={job.status === v} className={`h-11 px-4 rounded-full border text-[15px] font-medium ${job.status === v ? 'bg-ink text-white border-ink' : 'border-line'}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mb-2">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className="input pl-10" inputMode="search" placeholder="Find sticker # or item" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find sticker number or item" />
      </div>
      {hits.length > 0 && (
        <div className="group mb-4">
          {hits.map((i) => (
            <Link key={i.id} to={`/crew/jobs/${job.id}/stop/${i.tag}?item=${i.id}`} className="row py-2">
              <div className="w-11 h-11 rounded-lg bg-surface-2 overflow-hidden shrink-0">{i.photo && <img src={i.photo} alt="" className="w-full h-full object-cover" />}</div>
              <span className="flex-1 min-w-0"><span className="block font-medium truncate">{i.sticker ? `#${i.sticker} · ` : ''}{i.name}{(i.qty ?? 1) > 1 ? ` ×${i.qty}` : ''}</span><span className="block text-ink-2 text-[14px]">{rooms.find((r) => r.id === i.roomId)?.name}</span></span>
              <TagPill tag={i.tag} small />
            </Link>
          ))}
        </div>
      )}

      <div className="eyebrow mb-2 mt-4 px-1">Stops</div>
      <div className="group mb-6">
        {stops.map((s) => (
          <Link key={s.t} to={`/crew/jobs/${job.id}/stop/${s.t}`} className="row py-3">
            <TagPill tag={s.t} />
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] truncate">{stopAddress(job, s.t)}</span>
              <span className="block text-ink-2 text-[14px]">{s.t === 'keep' ? `${s.n} items stay` : `${s.loaded}/${s.n} loaded · ${s.done} ${DONE_WORD[s.t].toLowerCase()}`}{s.problems ? <b className="text-danger"> · {s.problems} problem{s.problems > 1 ? 's' : ''}</b> : null}</span>
            </span>
            <ChevronRight size={18} className="text-ink-3" />
          </Link>
        ))}
        {!stops.length && <div className="px-4 py-6 text-ink-2 text-center">Nothing tagged yet.</div>}
      </div>

      <div className="flex flex-col gap-1">
        <Link to={`/crew/jobs/${job.id}/enter`} className="btn"><ScanLine size={18} /> {job.stickerKit ? 'Enter stickered items' : 'Add items on site'}</Link>
        <button className="btn btn-secondary" disabled={!items.length} onClick={() => setExporting(true)}><FileSpreadsheet size={18} /> Links and lists for partners</button>
      </div>
      <p className="text-ink-2 text-[14px] mt-3 text-center">Sticker colours: {TAG_ORDER.map((t) => `${TAGS[t].sticker} ${TAGS[t].name}`).join(' · ')}</p>
      <ExportSheet open={exporting} onOpenChange={setExporting} job={job} rooms={rooms} items={items} />
    </Page>
  )
}
