import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, ChevronLeft } from 'lucide-react'
import { Page, TagPill } from '../components/ui'
import { useStore } from '../lib/hooks'
import { store } from '../lib/store'

export default function Room() {
  const { roomId = '' } = useParams()
  const nav = useNavigate()
  const job = useStore(() => store.getJob())
  const room = useStore(() => (job ? store.listRooms(job.id).find((r) => r.id === roomId) : undefined))
  const items = useStore(() => (job ? store.listItems(job.id, roomId) : []))
  if (!job || !room) return <Page><Link to="/rooms">Back to rooms</Link></Page>

  const toggleDone = () => {
    store.saveRoom({ ...room, done: !room.done })
    if (!room.done) {
      const next = store.listRooms(job.id).find((r) => !r.done && r.id !== room.id)
      nav(next ? `/rooms/${next.id}/scan` : '/summary')
    }
  }

  return (
    <Page>
      <Link to="/rooms" className="back"><ChevronLeft size={18} /> Rooms</Link>
      <div className="flex items-end justify-between mb-5 gap-3">
        <div className="min-w-0"><h1 className="truncate">{room.name}</h1><p className="lead">{items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : 'Nothing tagged yet'}</p></div>
        <Link to={`/rooms/${room.id}/quick`} className="btn w-auto shrink-0"><Camera size={18} /> Scan</Link>
      </div>

      {items.length === 0 ? (
        <Link to={`/rooms/${room.id}/quick`} className="card flex flex-col items-center text-center py-10 text-ink-2 text-[15px]">
          <Camera size={28} className="mb-2 text-ink-3" />Point the camera at the first item
        </Link>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((i) => (
            <Link key={i.id} to={`/items/${i.id}`} className="bg-surface rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(20,20,20,0.05)]">
              <div className="aspect-square bg-surface-2">{i.photo && <img src={i.photo} alt="" className="w-full h-full object-cover" />}</div>
              <div className="p-2">
                <div className="font-medium text-[13px] truncate">{i.name}</div>
                <div className="mt-1"><TagPill tag={i.tag} small /></div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1 mt-8">
        <button className={`btn ${room.done ? 'btn-secondary' : ''}`} onClick={toggleDone}>{room.done ? 'Reopen this room' : 'This room is done'}</button>
        <Link to={`/rooms/${room.id}/new`} className="btn btn-ghost">Add an item without a photo</Link>
      </div>
    </Page>
  )
}
