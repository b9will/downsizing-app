import { Link } from 'react-router-dom'
import { Camera, ChevronRight, Settings as SettingsIcon } from 'lucide-react'
import { Page, TagPill } from '../components/ui'
import { ai } from '../lib/ai'
import { useStore } from '../lib/hooks'
import { store } from '../lib/store'
import { TAGS, type Tag } from '../lib/types'
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
  const counts = (Object.keys(TAGS) as Tag[]).map((t) => ({ t, n: items.filter((i) => i.tag === t).length })).filter((c) => c.n > 0)
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
      <div className="flex items-center justify-between mb-5">
        <span className="eyebrow">{mode === 'self' ? user?.name : job.clientName}</span>
        <Link to="/settings" aria-label="Settings" className="w-11 h-11 -mr-2 rounded-lg flex items-center justify-center text-ink-2"><SettingsIcon size={20} /></Link>
      </div>

      <h1 className="mb-2">{headline}</h1>
      <p className="lead mb-5">{body}</p>
      {next && <Link to={`/rooms/${next.id}/scan`} className="btn mb-8"><Camera size={20} /> Scan the {next.name.toLowerCase()}</Link>}

      <div className="flex items-baseline justify-between mb-2 px-1">
        <span className="eyebrow">Progress</span>
        <span className="text-[14px] text-ink-2" role="status">{pending ? (online ? `Syncing ${pending}…` : `Saved on this phone. Will sync when online.`) : 'All saved'}</span>
      </div>
      <div className="group mb-6">
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between mb-2 text-[14px]"><span className="font-medium">{done} of {rooms.length} rooms done</span><span className="text-ink-2 tabular-nums">{items.length} items</span></div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden"><div className="h-full bg-accent rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
          {counts.length > 0 && <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">{counts.map((c) => <span key={c.t} className="inline-flex items-center gap-1.5 text-[13px] font-medium"><TagPill tag={c.t} small /> {c.n}</span>)}</div>}
        </div>
        <Link to="/rooms" className="row py-3"><span className="flex-1 font-medium">All rooms</span><ChevronRight size={18} className="text-ink-3" /></Link>
        <Link to="/plan" className="row py-3"><span className="flex-1 font-medium">The plan</span><span className="text-ink-2 text-[14px]">{items.length}</span><ChevronRight size={18} className="text-ink-3" /></Link>
        <Link to="/details" className="row py-3">
          <span className="flex-1 font-medium">{mode === 'self' ? 'Your details' : 'Contact and addresses'}</span>
          {hasDetails ? <span className="text-ink-2 text-[14px]">Saved</span> : <span className="rounded-full bg-accent-soft text-accent text-[12px] font-semibold px-2.5 py-0.5">To do</span>}
          <ChevronRight size={18} className="text-ink-3" />
        </Link>
      </div>
    </Page>
  )
}
