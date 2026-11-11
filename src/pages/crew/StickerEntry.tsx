import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Plus, X } from 'lucide-react'
import { Dot, Segmented, Sheet, TagChips, Toast } from '../../components/ui'
import { snapshot, useCamera } from '../../lib/camera'
import { identifyItems } from '../../lib/scan'
import { now, store, uid } from '../../lib/store'
import { cropCentre, readColour, readSticker, tagFromNumber } from '../../lib/sticker'
import { TAGS, type SizeClass, type Tag } from '../../lib/types'
import { useCrewJob } from './useCrewJob'

type Draft = { photo: string; name: string; size: SizeClass; tag: Tag | null; sticker: string; how: string }
const SIZE_OPTS: Array<[SizeClass, string]> = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['oversize', 'Huge']]

// Crew walks a sticker-kit home: aim the ring at the sticker, press, confirm, next.
export default function StickerEntry() {
  const { jobId = '' } = useParams()
  const nav = useNavigate()
  const { job, rooms, items } = useCrewJob(jobId)
  const [roomId, setRoomId] = useState<string>('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const { video, state } = useCamera(!draft)
  const [seen, setSeen] = useState<Tag | null>(null)
  const [reading, setReading] = useState(false)
  const [saved, setSaved] = useState('')
  const [newRoom, setNewRoom] = useState<string | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => { if (!roomId && rooms[0]) setRoomId(rooms[0].id) }, [rooms, roomId])
  // Live colour reading of whatever is inside the ring.
  useEffect(() => {
    if (state !== 'live' || draft) return
    const t = setInterval(() => { const v = video.current; if (v) setSeen(readColour(v).tag) }, 250)
    return () => clearInterval(t)
  }, [state, draft, video])
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(''), 2500); return () => clearTimeout(t) }, [saved])
  if (!job) return null

  const capture = async () => {
    const v = video.current; if (!v) return
    const photo = snapshot(v); if (!photo) return
    const colour = readColour(v).tag
    const crop = cropCentre(v)
    if (navigator.vibrate) navigator.vibrate(10)
    const d: Draft = { photo, name: '', size: 'medium', tag: colour, sticker: '', how: colour ? `${TAGS[colour].sticker} sticker` : '' }
    setDraft(d); setReading(true); setErr('')
    // Read the printed word and number, and try to name the item, in the background.
    const [ocr, found] = await Promise.allSettled([crop ? readSticker(crop) : Promise.reject(), identifyItems(photo)])
    setReading(false)
    setDraft((cur) => {
      if (!cur || cur.photo !== photo) return cur
      const next = { ...cur }
      if (ocr.status === 'fulfilled') {
        if (ocr.value.number) next.sticker = ocr.value.number
        const t = ocr.value.word ?? tagFromNumber(ocr.value.number ?? undefined)
        if (t) { next.tag = t; next.how = ocr.value.word ? `Read "${TAGS[t].name}" on sticker` : `Sticker number ${ocr.value.number}` }
      }
      if (found.status === 'fulfilled' && found.value[0] && !next.name) { next.name = found.value[0].name; if (found.value[0].size) next.size = found.value[0].size }
      return next
    })
  }

  const save = () => {
    if (!draft || !draft.tag || !draft.name.trim() || !roomId) return
    const s = draft.sticker.trim()
    const dupe = s && items.find((i) => i.sticker === s)
    if (dupe) return setErr(`Sticker #${s} is already on "${dupe.name}". Check the number.`)
    store.saveItem({ id: uid(), jobId: job.id, roomId, name: draft.name.trim(), size: draft.size, tag: draft.tag, photo: draft.photo, sticker: s || undefined, status: 'tagged', createdAt: now(), updatedAt: now() })
    setSaved(`Saved ${s ? '#' + s : draft.name}`); setDraft(null)
  }
  const addRoom = () => {
    if (!newRoom?.trim()) return
    const id = uid(); store.saveRoom({ id, jobId: job.id, name: newRoom.trim(), order: rooms.length, done: false }); setRoomId(id); setNewRoom(null)
  }

  const count = items.filter((i) => i.roomId === roomId).length
  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <video ref={video} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
      {/* Aim ring: the sticker goes here. Its border takes the colour being read. */}
      <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[42vmin] h-[42vmin] rounded-full border-[5px] transition-colors" style={{ borderColor: seen ? TAGS[seen].hex : 'rgba(255,255,255,0.8)', boxShadow: '0 0 0 2000px rgba(0,0,0,0.25)' }} aria-hidden />

      <div className="absolute inset-x-0 top-0 pt-[calc(var(--spacing-safe-t)+10px)] px-4 pb-6 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center justify-between mb-3">
          <button aria-label="Close" onClick={() => nav(`/crew/jobs/${job.id}`)} className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center"><X size={22} /></button>
          <div className="text-center"><div className="font-semibold">{job.clientName}</div><div className="text-[14px] text-white/80">{count} in this room · {items.length} total</div></div>
          <span className="w-11" />
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
          {rooms.map((r) => <button key={r.id} onClick={() => setRoomId(r.id)} aria-pressed={roomId === r.id} className={`shrink-0 h-11 px-4 rounded-full text-[15px] font-medium ${roomId === r.id ? 'bg-white text-ink' : 'bg-white/15'}`}>{r.name}</button>)}
          <button aria-label="Add a room" onClick={() => setNewRoom('')} className="shrink-0 h-11 w-11 rounded-full bg-white/15 flex items-center justify-center"><Plus size={18} /></button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 pb-[calc(var(--spacing-safe-b)+22px)] pt-10 bg-gradient-to-t from-black/75 to-transparent">
        <p className="text-center text-[17px] font-semibold mb-5 flex items-center justify-center gap-2" role="status">
          {state !== 'live' ? 'Opening camera…' : seen ? <><Dot tag={seen} size={16} /> {TAGS[seen].sticker} · {TAGS[seen].name}</> : 'Put the sticker in the ring'}
        </p>
        <div className="flex justify-center">
          <button aria-label="Capture sticker" disabled={state !== 'live' || !roomId} onClick={capture} className="w-[78px] h-[78px] rounded-full border-[5px] border-white flex items-center justify-center active:scale-95 disabled:opacity-40"><span className="w-[60px] h-[60px] rounded-full bg-white" /></button>
        </div>
      </div>

      <Toast show={!!saved} text={saved} />

      <Sheet open={newRoom !== null} onOpenChange={(o) => { if (!o) setNewRoom(null) }} footer={<button className="btn" onClick={addRoom}>Add room</button>}>
        <div className="text-ink"><label htmlFor="nr" className="block font-medium mb-1">Room name</label><input id="nr" className="input" value={newRoom ?? ''} onChange={(e) => setNewRoom(e.target.value)} /></div>
      </Sheet>

      <Sheet open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null) }} footer={draft && (
        <div className="text-ink">
          {err && <p role="alert" className="text-danger font-medium text-[15px] mb-2">{err}</p>}
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <button className="btn btn-secondary w-auto px-5" onClick={() => setDraft(null)}>Retake</button>
            <button className="btn" disabled={!draft.tag || !draft.name.trim()} onClick={save}><Check size={20} /> {!draft.name.trim() ? 'Name it to save' : 'Save and next'}</button>
          </div>
        </div>
      )}>
        {draft && (
          <div className="text-ink">
            <div className="flex gap-4 items-start mb-4">
              <img src={draft.photo} alt="" className="w-20 h-20 rounded-xl object-cover bg-surface-2 shrink-0" />
              <div className="flex-1 min-w-0 grid grid-cols-[1fr_96px] gap-2">
                <div><label className="eyebrow block mb-1" htmlFor="se-name">Item</label><input id="se-name" className="input" placeholder="What is it?" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div><label className="eyebrow block mb-1" htmlFor="se-num">Sticker #</label><input id="se-num" className="input tabular-nums" inputMode="numeric" value={draft.sticker} onChange={(e) => { const sticker = e.target.value.replace(/\D/g, ''); const t = tagFromNumber(sticker); setDraft({ ...draft, sticker, tag: sticker.length === 4 && t ? t : draft.tag }); setErr('') }} /></div>
              </div>
            </div>
            <p className="text-[15px] text-ink-2 mb-3" role="status">{reading ? 'Reading the sticker…' : draft.how ? `Matched by ${draft.how.toLowerCase()}. Check it's right.` : 'Could not read the sticker. Pick the colour below.'}</p>
            <div className="mb-4"><Segmented options={SIZE_OPTS} value={draft.size} onChange={(size) => setDraft({ ...draft, size })} /></div>
            <TagChips value={draft.tag} onChange={(tag) => setDraft({ ...draft, tag })} />
          </div>
        )}
      </Sheet>
    </div>
  )
}
