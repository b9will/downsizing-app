import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, ChevronLeft } from 'lucide-react'
import { Page, Dot } from '../components/ui'
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
        <Link to={`/rooms/${room.id}/scan`} className="btn w-auto shrink-0"><Camera size={18} /> Scan</Link>
      </div>

      <Link to={`/rooms/${room.id}/quick`} className="card flex items-center gap-3 py-3 mb-3"><span className="flex-1"><b className="block font-semibold">Try the room scan <span className="text-[12px] font-bold uppercase tracking-wide bg-ink text-white rounded-full px-2 py-0.5 ml-1">Beta</span></b><span className="text-ink-2 text-[14px]">Turn slowly and we list the whole room</span></span><ChevronLeft size={18} className="rotate-180 text-ink-3" /></Link>

      {items.length === 0 ? (
        <Link to={`/rooms/${room.id}/scan`} className="card flex flex-col items-center text-center py-10 text-ink-2 text-[15px]">
          <Camera size={28} className="mb-2 text-ink-3" />Point the camera at the first item
        </Link>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((i) => (
            <Link key={i.id} to={`/items/${i.id}`} className="bg-soft rounded-[18px] overflow-hidden relative">
              <div className="aspect-square bg-surface-2">{i.photo && <img src={i.photo} alt="" className="w-full h-full object-cover" />}</div>
              <div className="p-2">
                <div className="font-semibold text-[14px] truncate">{i.name}</div>
                <span className="absolute right-1.5 top-1.5"><Dot tag={i.tag} size={28} /></span>
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
