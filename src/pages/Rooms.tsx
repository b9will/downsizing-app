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
      <p className="lead mb-5">Tap the camera to scan a room, or the name to review it.</p>
      <div className="group">
        {rooms.map((r) => {
          const n = items.filter((i) => i.roomId === r.id).length
          const last = items.find((i) => i.roomId === r.id && i.photo)
          return (
            <div key={r.id} className="row py-2 pr-2">
              <Link to={`/rooms/${r.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-lg bg-surface-2 overflow-hidden flex items-center justify-center shrink-0">
                  {last?.photo ? <img src={last.photo} alt="" className="w-full h-full object-cover" /> : r.done ? <Check size={18} className="text-accent" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-ink-2 text-[13px]">{r.done ? 'Done' : n ? `${n} item${n === 1 ? '' : 's'}` : 'Not started'}</div>
                </div>
                <ChevronRight size={18} className="text-ink-3 ml-auto shrink-0" />
              </Link>
              <Link to={`/rooms/${r.id}/quick`} aria-label={`Scan ${r.name}`} className="w-11 h-11 rounded-lg bg-ink text-white flex items-center justify-center active:opacity-80 shrink-0"><Camera size={18} /></Link>
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
