import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Check, ChevronRight, Plus } from 'lucide-react'
import { Page } from '../components/ui'
import { useStore } from '../lib/hooks'
import { store, uid } from '../lib/store'

export default function Rooms() {
  const job = useStore(() => store.getJob())
  const rooms = useStore(() => (job ? store.listRooms(job.id) : []))
  const items = useStore(() => (job ? store.listItems(job.id) : []))
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  if (!job) return null

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    store.saveRoom({ id: uid(), jobId: job.id, name: name.trim(), order: rooms.length, done: false })
    setName(''); setAdding(false)
  }

  return (
    <Page>
      <h1 className="mb-1">Rooms</h1>
      <p className="lead mb-5">{rooms.filter((r) => r.done).length} of {rooms.length} done. Tap the camera to scan a room.</p>
      <div className="flex flex-col gap-2">
        {rooms.map((r) => {
          const n = items.filter((i) => i.roomId === r.id).length
          const last = items.find((i) => i.roomId === r.id && i.photo)
          return (
            <div key={r.id} className="card flex items-center gap-2 py-2.5 pl-3 pr-2.5">
              <Link to={`/rooms/${r.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-surface overflow-hidden flex items-center justify-center shrink-0">
                  {last?.photo ? <img src={last.photo} alt="" className="w-full h-full object-cover" /> : r.done ? <Check size={22} strokeWidth={2.6} className="text-accent" /> : <Plus size={20} className="text-ink-3" />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-ink-2 text-[14px]">{r.done ? 'Done' : n ? `${n} item${n === 1 ? '' : 's'}` : 'Not started'}</div>
                </div>
                <ChevronRight size={18} className="text-ink-3 ml-auto shrink-0" />
              </Link>
              <Link to={`/rooms/${r.id}/scan`} aria-label={`Scan ${r.name}`} className="w-12 h-12 rounded-full bg-ink text-white flex items-center justify-center active:opacity-80 shrink-0"><Camera size={18} /></Link>
            </div>
          )
        })}
      </div>

      {adding ? (
        <form onSubmit={add} className="flex gap-2 mt-3">
          <input className="input" autoFocus placeholder="Room name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn w-auto" type="submit">Add</button>
        </form>
      ) : (
        <button className="btn btn-ghost mt-2" onClick={() => setAdding(true)}><Plus size={18} /> Add a room</button>
      )}
    </Page>
  )
}
