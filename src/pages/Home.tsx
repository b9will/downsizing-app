import { Link } from 'react-router-dom'
import { ChevronRight, ScanLine, Settings as SettingsIcon } from 'lucide-react'
import { Dot, Page } from '../components/ui'
import { ai } from '../lib/ai'
import { useStore } from '../lib/hooks'
import { store } from '../lib/store'
import { TAGS, TAG_ORDER } from '../lib/types'
import { detailsComplete } from './Details'

export default function Home() {
  const user = useStore(() => store.getUser())
  const job = useStore(() => store.getJob())
  const rooms = useStore(() => (job ? store.listRooms(job.id) : []))
  const items = useStore(() => (job ? store.listItems(job.id) : []))
  if (!job) return null

  const step = ai.nextStep(job, rooms, items)
  const next = rooms.find((r) => r.id === step.roomId)
  const done = rooms.filter((r) => r.done).length
  const pct = rooms.length ? Math.round((done / rooms.length) * 100) : 0
  const counts = TAG_ORDER.map((t) => ({ t, n: items.filter((i) => i.tag === t).length }))
  const daysLeft = Math.max(0, Math.ceil((new Date(job.tagDeadline).getTime() - Date.now()) / 86400000))
  const undecided = items.filter((i) => i.tag === 'undecided').length
  const hasDetails = detailsComplete(job.details)
  const pending = useStore(() => store.pending())
  const online = useStore(() => store.online)
  const mode = job.details?.mode ?? 'self'
  const first = user?.name.split(' ')[0] ?? ''
  // Helpers and executors are not the homeowner; speak to them, about the home.
  const headline = mode === 'self' || items.length ? step.headline.replace(/, [^.]+\.$/, `, ${first}.`) : `Hello, ${first}.`
  const body = mode === 'estate' && !items.length ? `Let's start with the ${next?.name.toLowerCase() ?? 'first room'}. Photograph each item and choose where it goes. Nothing leaves until you approve the plan.`
    : mode === 'helper' && !items.length ? `You're helping ${job.clientName.split(' ')[0]}. Start in the ${next?.name.toLowerCase() ?? 'first room'}. You can invite other family members from Settings.` : step.body

  return (
    <Page>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[15px] font-semibold truncate">{mode === 'self' ? `${first}'s move` : job.clientName}</span>
        <span className="flex items-center gap-2 shrink-0">
          {job.status === 'tagging' && <span className="text-[14px] text-ink-2">{daysLeft} days left</span>}
          <Link to="/settings" aria-label="Settings" className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center"><SettingsIcon size={20} /></Link>
        </span>
      </div>

      <h1 className="mb-2">{items.length ? `${items.length} thing${items.length === 1 ? '' : 's'} sorted.${next ? ` ${next.name} next.` : ''}` : headline}</h1>
      {!items.length && <p className="lead mb-4">{body}</p>}
      {next && (
        <Link to={`/rooms/${next.id}/quick`} className="flex items-center gap-4 p-4 mt-4 mb-6 rounded-3xl bg-ink text-white active:opacity-90">
          <span className="w-14 h-14 rounded-2xl bg-white text-ink flex items-center justify-center shrink-0"><ScanLine size={28} /></span>
          <span><span className="block text-[21px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Scan the {next.name.toLowerCase()}</span><span className="block text-[15px] text-white/75">Turn slowly. About a minute.</span></span>
        </Link>
      )}

      <Link to="/plan" className="grid grid-cols-4 gap-x-1 gap-y-3 mb-6" aria-label="Open the plan">
        {counts.map((c) => (
          <span key={c.t} className={`flex flex-col items-center gap-1 text-[14px] font-semibold ${c.n ? '' : 'opacity-45'}`}>
            <Dot tag={c.t} size={56} />
            <span>{TAGS[c.t].name} <span className="font-medium text-ink-2 tabular-nums">{c.n}</span></span>
          </span>
        ))}
      </Link>

      <div className="flex items-baseline justify-between mb-2">
        <span className="sec">To do</span>
        <span className="text-[14px] text-ink-2" role="status">{pending ? (online ? `Syncing ${pending}…` : 'Saved on this phone') : 'All saved'}</span>
      </div>
      <div className="flex flex-col gap-2">
        <Link to="/rooms" className="card flex items-center gap-3 py-3"><span className="flex-1"><b className="block font-semibold">{done} of {rooms.length} rooms done</b><span className="block h-2 rounded-full bg-line overflow-hidden mt-2"><span className="block h-full bg-accent rounded-full" style={{ width: `${pct}%` }} /></span></span><ChevronRight size={18} className="text-ink-3" /></Link>
        {undecided > 0 && <Link to="/plan" className="card flex items-center gap-3 py-3"><Dot tag="undecided" size={30} /><span className="flex-1"><b className="block font-semibold">{undecided} still "Not sure"</b><span className="text-ink-2 text-[14px]">Decide, or we'll help</span></span><ChevronRight size={18} className="text-ink-3" /></Link>}
        {!hasDetails && <Link to="/details" className="card flex items-center gap-3 py-3"><span className="flex-1"><b className="block font-semibold">{mode === 'self' ? 'Add your phone and address' : 'Add contact and addresses'}</b><span className="text-ink-2 text-[14px]">So we can plan the day</span></span><ChevronRight size={18} className="text-ink-3" /></Link>}
        {items.length > 0 && <Link to="/summary" className="card flex items-center gap-3 py-3"><span className="flex-1"><b className="block font-semibold">See your estimate</b><span className="text-ink-2 text-[14px]">Pick a service, then send</span></span><ChevronRight size={18} className="text-ink-3" /></Link>}
      </div>
    </Page>
  )
}
