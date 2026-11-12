import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, LogOut, Plus, Printer, RefreshCw } from 'lucide-react'
import { Page, Sheet } from '../../components/ui'
import { useStore } from '../../lib/hooks'
import { createJob, store } from '../../lib/store'

const STATUS: Record<string, string> = { tagging: 'Client tagging', review: 'To review', scheduled: 'Scheduled', in_progress: 'In progress', done: 'Done', cancelled: 'Cancelled' }
const fmt = (d?: string | null) => (d ? new Date(d + 'T12:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date')

// Crew mode: today's and upcoming jobs.
export default function CrewHome() {
  const nav = useNavigate()
  const user = useStore(() => store.getUser())
  const jobs = useStore(() => store.listJobs())
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', address: '', phone: '', date: '' })
  const [loading, setLoading] = useState(false)
  useEffect(() => { void store.loadJobs() }, [])
  if (!user) return null

  const reload = async () => { setLoading(true); await store.loadJobs(); setLoading(false) }
  // A client who mailed back stickers and has no app: the crew enters the home for them.
  const newKitJob = () => {
    if (!f.name.trim() || !f.address.trim()) return
    const job = createJob(user, 'self', f.name, true)
    store.saveJob({ ...job, moveDate: f.date || null, details: { phone: f.phone, email: '', currentAddress: f.address, newAddress: '', moveDate: f.date, contactName: '', contactRelation: '', contactPhone: '', charity: '', charityAddress: '', accessNotes: '', mode: 'self' } })
    setAdding(false); nav(`/crew/jobs/${job.id}`)
  }

  const today = new Date().toISOString().slice(0, 10)
  const groups = [
    { title: 'Today', list: jobs.filter((j) => (j.moveDate ?? j.details?.moveDate) === today) },
    { title: 'Coming up', list: jobs.filter((j) => (j.moveDate ?? j.details?.moveDate ?? '') > today && j.status !== 'done') },
    { title: 'Being tagged or reviewed', list: jobs.filter((j) => !(j.moveDate ?? j.details?.moveDate) && j.status !== 'done') },
    { title: 'Past and done', list: jobs.filter((j) => j.status === 'done' || ((j.moveDate ?? j.details?.moveDate ?? '9') < today)) },
  ]

  return (
    <Page>
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">Crew · {user.name}{user.role === 'admin' && <> · <Link to="/office" className="underline">Office</Link></>}</span>
        <button aria-label="Refresh" onClick={reload} className="w-11 h-11 -mr-2 flex items-center justify-center text-ink-2"><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      <h1 className="mb-5">Jobs</h1>

      {groups.map((g) => g.list.length > 0 && (
        <section key={g.title} className="mb-6">
          <div className="eyebrow mb-2 px-1">{g.title}</div>
          <div className="group">
            {g.list.map((j) => (
              <Link key={j.id} to={`/crew/jobs/${j.id}`} className="row py-3">
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{j.clientName}{j.stickerKit && <span className="ml-2 text-[13px] font-medium text-ink-2">Sticker kit</span>}</span>
                  <span className="block text-ink-2 text-[15px] truncate">{j.details?.currentAddress || 'No address yet'}</span>
                  <span className="block text-ink-2 text-[14px]">{fmt(j.moveDate ?? j.details?.moveDate)} · {STATUS[j.status]}</span>
                </span>
                <ChevronRight size={18} className="text-ink-3 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      ))}
      {!jobs.length && <div className="card text-center text-ink-2 py-10 mb-6">No jobs yet.</div>}

      <div className="flex flex-col gap-1">
        <button className="btn" onClick={() => setAdding(true)}><Plus size={18} /> New sticker-kit job</button>
        <Link to="/crew/stickers" className="btn btn-secondary"><Printer size={18} /> Print sticker sheets</Link>
        <button className="btn btn-ghost" onClick={() => { store.setUser(null); nav('/login', { replace: true }) }}><LogOut size={18} /> Sign out</button>
      </div>

      <Sheet open={adding} onOpenChange={setAdding} footer={<button className="btn" disabled={!f.name.trim() || !f.address.trim()} onClick={newKitJob}>Create job</button>}>
        <h2 className="mb-1">New sticker-kit job</h2>
        <p className="text-ink-2 text-[15px] mb-4">For clients who used the mailed stickers instead of the app. You'll photograph each stickered item on site.</p>
        {([['name', 'Client name'], ['address', 'Address'], ['phone', 'Phone'], ['date', 'Move date']] as const).map(([k, label]) => (
          <div key={k} className="mb-3">
            <label htmlFor={`nj-${k}`} className="block font-medium text-[15px] mb-1">{label}</label>
            <input id={`nj-${k}`} className="input" type={k === 'date' ? 'date' : k === 'phone' ? 'tel' : 'text'} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </div>
        ))}
      </Sheet>
    </Page>
  )
}
