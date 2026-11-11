import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Page, Segmented, SetPicker, TagChips } from '../components/ui'
import { ai } from '../lib/ai'
import { itemCatalog } from '../lib/itemCatalog'
import { now, store, uid } from '../lib/store'
import { isSetLike, type Item, type SizeClass, type Tag } from '../lib/types'

const SIZE_OPTS: Array<[SizeClass, string]> = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['oversize', 'Huge']]

// Edit an item (/items/:itemId) or add one without a photo (/rooms/:roomId/new).
export default function ItemForm() {
  const { roomId, itemId } = useParams()
  const nav = useNavigate()
  const job = store.getJob()
  const existing = itemId ? store.getItem(itemId) : null
  const room = job ? store.listRooms(job.id).find((r) => r.id === (roomId ?? existing?.roomId)) : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [size, setSize] = useState<SizeClass>(existing?.size ?? 'medium')
  const [tag, setTag] = useState<Tag | null>(existing?.tag ?? null)
  const [qty, setQty] = useState(existing?.qty ?? 1)
  const [recipient, setRecipient] = useState(existing?.familyRecipient ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  if (!job || !room) return <Page><Link to="/rooms">Back to rooms</Link></Page>

  const save = () => {
    if (!name.trim() || !tag) return
    const item: Item = {
      ...existing,
      qty: qty > 1 ? qty : undefined,
      id: existing?.id ?? uid(), jobId: job.id, roomId: room.id, name: name.trim(), tag, size, photo: existing?.photo, photoPath: existing?.photoPath,
      note: note.trim() || undefined, familyRecipient: tag === 'family' ? recipient.trim() || undefined : undefined,
      sticker: existing?.sticker, status: existing?.status ?? 'tagged', statusNote: existing?.statusNote,
      createdAt: existing?.createdAt ?? now(), updatedAt: now(),
    }
    try { store.saveItem(item, true) } catch { alert('This phone is out of space. The item was not saved.'); return }
    nav(`/rooms/${room.id}`)
  }
  const remove = () => { if (existing) { store.deleteItem(existing.id); nav(`/rooms/${room.id}`) } }
  const s = ai.suggestTag(name)

  return (
    <Page>
      <Link to={`/rooms/${room.id}`} className="back"><ChevronLeft size={18} /> {room.name}</Link>
      <h1 className="mb-5">{existing ? 'Edit item' : 'Add an item'}</h1>
      {existing?.photo && <img src={existing.photo} alt="" className="w-full aspect-[4/3] object-cover rounded-xl mb-4" />}
      <div className="flex flex-col gap-4">
        <div>
          <label className="eyebrow block mb-1" htmlFor="name">Item</label>
          <input id="name" className="input" list="catalog" value={name} autoFocus={!existing} placeholder="e.g. Oak dining table" onChange={(e) => {
            setName(e.target.value)
            const cat = itemCatalog.find((i) => i.name.toLowerCase() === e.target.value.trim().toLowerCase()); if (cat) setSize(cat.size)
          }} />
          <datalist id="catalog">{itemCatalog.map((i) => <option key={i.name} value={i.name} />)}</datalist>
        </div>
        <Segmented options={SIZE_OPTS} value={size} onChange={setSize} />
        {(isSetLike(name) || qty > 1) && <SetPicker name={name} value={qty} onChange={setQty} />}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="eyebrow">What should happen to it?</span>
            {s && s.tag !== 'undecided' && tag !== s.tag && <button className="text-[13px] font-semibold text-accent" onClick={() => setTag(s.tag)}>Suggest: {s.tag}</button>}
          </div>
          <TagChips value={tag} onChange={setTag} />
        </div>
        {tag === 'family' && <input className="input" placeholder="Who is it for?" value={recipient} onChange={(e) => setRecipient(e.target.value)} />}
        <textarea className="input py-3 h-auto min-h-24" placeholder="Anything we should know? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn" disabled={!name.trim() || !tag} onClick={save}>Save</button>
        {existing && <button className="btn btn-danger" onClick={remove}>Delete this item</button>}
      </div>
    </Page>
  )
}
