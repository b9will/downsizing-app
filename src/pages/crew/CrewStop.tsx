import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Camera, Check, ChevronLeft, TriangleAlert, Truck } from 'lucide-react'
import { Page, Sheet, TagPill } from '../../components/ui'
import { fileToDataUrl } from '../../lib/hooks'
import { store } from '../../lib/store'
import { TAGS, type Item, type ItemEvent, type ItemStatus, type Tag } from '../../lib/types'
import { DONE_WORD, stopAddress } from './CrewJob'
import { useCrewJob } from './useCrewJob'

const LABEL: Record<ItemStatus, string> = { tagged: 'To load', loaded: 'Loaded', delivered: 'Delivered', collected: 'Handed off', damaged: 'Damaged', missing: 'Missing', rejected: 'Refused' }
const doneStatus = (t: Tag): ItemStatus => (t === 'move' || t === 'family' || t === 'store' ? 'delivered' : 'collected')

// One destination's checklist: load it, deliver or hand it off, flag problems with a photo.
export default function CrewStop() {
  const { jobId = '', tag = 'move' } = useParams() as { jobId: string; tag: Tag }
  const [params] = useSearchParams()
  const { job, rooms, items: all } = useCrewJob(jobId)
  const [filter, setFilter] = useState<'todo' | 'all'>('todo')
  const [problem, setProblem] = useState<Item | null>(null)
  const [kind, setKind] = useState<ItemStatus>('damaged')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | undefined>()
  const [events, setEvents] = useState<ItemEvent[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const proofFor = useRef<Item | null>(null)
  const focus = params.get('item')

  useEffect(() => { if (problem) void store.listEvents(problem.id).then(setEvents); else setEvents([]) }, [problem])
  useEffect(() => { if (focus) { setFilter('all'); setTimeout(() => document.getElementById(`it-${focus}`)?.scrollIntoView({ block: 'center' }), 300) } }, [focus])
  if (!job) return <Page><Link to="/crew" className="back"><ChevronLeft size={18} /> Jobs</Link></Page>

  const items = all.filter((i) => i.tag === tag).sort((a, b) => (a.sticker ?? '').localeCompare(b.sticker ?? '') || a.name.localeCompare(b.name))
  const done = doneStatus(tag)
  const shown = filter === 'todo' ? items.filter((i) => i.status !== done) : items
  const room = (id: string) => rooms.find((r) => r.id === id)?.name ?? ''

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const url = await fileToDataUrl(f, 1280, 0.72)
    if (proofFor.current) { store.setStatus(proofFor.current, proofFor.current.status, 'Proof photo', url); proofFor.current = null } else setPhoto(url)
  }
  const saveProblem = () => {
    if (!problem) return
    store.setStatus(problem, kind, note.trim() || undefined, photo)
    setProblem(null); setNote(''); setPhoto(undefined)
  }

  return (
    <Page>
      <Link to={`/crew/jobs/${job.id}`} className="back"><ChevronLeft size={18} /> {job.clientName}</Link>
      <div className="flex items-center gap-2 mb-1"><TagPill tag={tag} /><span className="text-ink-2 text-[15px]">{TAGS[tag].sticker} stickers</span></div>
      <h1 className="mb-1">{stopAddress(job, tag)}</h1>
      <p className="lead mb-4">{items.filter((i) => i.status !== 'tagged').length}/{items.length} loaded · {items.filter((i) => i.status === done).length} {DONE_WORD[tag].toLowerCase()}</p>

      <div className="flex gap-2 mb-3">
        {(['todo', 'all'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`h-11 px-4 rounded-full border text-[15px] font-medium ${filter === f ? 'bg-ink text-white border-ink' : 'border-line bg-surface'}`}>{f === 'todo' ? 'Still to do' : `All ${items.length}`}</button>)}
      </div>

      <div className="flex flex-col gap-2">
        {shown.map((i) => {
          const bad = ['damaged', 'missing', 'rejected'].includes(i.status)
          return (
            <div key={i.id} id={`it-${i.id}`} className={`card p-3 ${focus === i.id ? 'ring-2 ring-ink' : ''}`}>
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-lg bg-surface-2 overflow-hidden shrink-0">{i.photo && <img src={i.photo} alt="" className="w-full h-full object-cover" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[17px] leading-tight">{i.sticker && <span className="tabular-nums">#{i.sticker} </span>}{i.name}{(i.qty ?? 1) > 1 && <span className="ml-2 px-2 py-0.5 rounded-full bg-ink text-white text-[13px] align-middle">×{i.qty}</span>}</div>
                  <div className="text-ink-2 text-[15px]">{room(i.roomId)} · {i.size}{i.familyRecipient ? ` · for ${i.familyRecipient}` : ''}</div>
                  {i.note && <div className="text-[15px] mt-0.5">{i.note}</div>}
                  <div className={`text-[14px] font-semibold mt-1 ${bad ? 'text-danger' : i.status === done ? 'text-accent' : 'text-ink-2'}`}>{LABEL[i.status]}{i.statusNote ? `: ${i.statusNote}` : ''}</div>
                </div>
              </div>
              {tag !== 'keep' && (
                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 mt-3">
                  <button className={`btn btn-sm h-12 w-full ${i.status === 'loaded' ? '' : 'btn-secondary'}`} onClick={() => store.setStatus(i, i.status === 'loaded' ? 'tagged' : 'loaded')}><Truck size={18} /> Loaded</button>
                  <button className={`btn btn-sm h-12 w-full ${i.status === done ? 'bg-accent' : 'btn-secondary'}`} onClick={() => store.setStatus(i, i.status === done ? 'loaded' : done)}><Check size={18} /> {DONE_WORD[tag]}</button>
                  <button aria-label={`Proof photo for ${i.name}`} className="btn btn-secondary btn-sm h-12 w-12 px-0" onClick={() => { proofFor.current = i; fileRef.current?.click() }}><Camera size={18} /></button>
                  <button aria-label={`Report a problem with ${i.name}`} className="btn btn-secondary btn-sm h-12 w-12 px-0 text-danger" onClick={() => { setProblem(i); setKind(tag === 'donate' || tag === 'sell' ? 'rejected' : 'damaged') }}><TriangleAlert size={18} /></button>
                </div>
              )}
            </div>
          )
        })}
        {!shown.length && <div className="card text-center py-10 text-ink-2">{items.length ? `All ${DONE_WORD[tag].toLowerCase()}.` : 'Nothing here.'}</div>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

      <Sheet open={!!problem} onOpenChange={(o) => { if (!o) { setProblem(null); setPhoto(undefined); setNote('') } }} footer={<button className="btn bg-danger" onClick={saveProblem}>Report {LABEL[kind].toLowerCase()}</button>}>
        {problem && (
          <div>
            <h2 className="mb-3">{problem.sticker ? `#${problem.sticker} ` : ''}{problem.name}</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['damaged', 'missing', 'rejected'] as const).map((k) => <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`h-12 rounded-xl border font-medium ${kind === k ? 'bg-ink text-white border-ink' : 'border-line'}`}>{LABEL[k]}</button>)}
            </div>
            <label htmlFor="pnote" className="block font-medium text-[15px] mb-1">What happened?</label>
            <textarea id="pnote" className="input py-3 h-auto min-h-20 mb-3" placeholder={kind === 'rejected' ? 'e.g. Charity does not take mattresses' : 'e.g. Scratch on left side, was there before'} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-secondary mb-2" onClick={() => { proofFor.current = null; fileRef.current?.click() }}><Camera size={18} /> {photo ? 'Retake photo' : 'Add a photo'}</button>
            {photo && <img src={photo} alt="Problem photo" className="w-full rounded-xl mb-2" />}
            {events.length > 0 && (
              <div className="mt-3">
                <div className="eyebrow mb-1">History</div>
                {events.map((e) => (
                  <div key={e.id} className="flex gap-2 items-center py-1.5 text-[15px] border-t border-line">
                    {e.photo && <img src={e.photo} alt="" className="w-10 h-10 rounded object-cover" />}
                    <span className="flex-1">{e.status === 'photo' ? 'Photo' : LABEL[e.status as ItemStatus] ?? e.status}{e.note ? `: ${e.note}` : ''}</span>
                    <span className="text-ink-2 text-[13px]">{new Date(e.at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </Page>
  )
}
