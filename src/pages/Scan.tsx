import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, Zap, ImagePlus, Check } from 'lucide-react'
import { Dot, Segmented, SetPicker, Sheet, TagChips, Toast, LensPill } from '../components/ui'
import { ai } from '../lib/ai'
import { snapshot, useCamera } from '../lib/camera'
import { Paywall } from '../components/Paywall'
import { roomLocked } from '../lib/pay'
import { fileToDataUrl, useStore } from '../lib/hooks'
import { itemCatalog } from '../lib/itemCatalog'
import { identifyItems } from '../lib/scan'
import { now, store, uid } from '../lib/store'
import { isSetLike, type SizeClass, type Tag } from '../lib/types'

type Match = Awaited<ReturnType<typeof identifyItems>>[number]
type Tracked = Match & { key: string; seen: number }

const HOLD_MS = 2500 // keep a box on screen this long after it drops out, so it can still be tapped
const iou = (a: number[], b: number[]) => {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]), x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return inter / (a[2] * a[3] + b[2] * b[3] - inter || 1)
}
const MAX_BOXES = 3
const centre = (b: number[]) => [b[0] + b[2] / 2, b[1] + b[3] / 2]
/** Match new detections to boxes already on screen; keep unmatched ones for HOLD_MS while the camera is still. */
function track(prev: Tracked[], found: Match[], t: number): Tracked[] {
  // Ignore specks, clamp to the frame, drop doubles of the same thing, and show only a few at once.
  const clean: Match[] = []
  for (const f of found) {
    const x = Math.max(0, f.bounds[0]), y = Math.max(0, f.bounds[1])
    const m = { ...f, bounds: [x, y, Math.min(1, f.bounds[0] + f.bounds[2]) - x, Math.min(1, f.bounds[1] + f.bounds[3]) - y] }
    if (m.bounds[2] * m.bounds[3] < 0.04) continue
    if (clean.some((c) => iou(c.bounds, m.bounds) > 0.45)) continue
    clean.push(m)
    if (clean.length === MAX_BOXES) break
  }
  const used = new Set<string>()
  let moved = 0, matched = 0
  const next: Tracked[] = clean.map((m) => {
    const hit = prev.filter((p) => p.name === m.name && !used.has(p.key)).sort((a, b) => iou(b.bounds, m.bounds) - iou(a.bounds, m.bounds))[0]
    const same = !!hit && iou(hit.bounds, m.bounds) > 0.15
    const key = same ? hit.key : `${m.name}-${t}-${Math.random().toString(36).slice(2, 6)}`
    used.add(key)
    if (!same) return { ...m, key, seen: t }
    const [ax, ay] = centre(hit.bounds), [bx, by] = centre(m.bounds)
    const d = Math.hypot(ax - bx, ay - by)
    moved += d; matched++
    // Small wobble: mostly hold still. Real movement: follow quickly.
    const k = d < 0.03 ? 0.25 : 0.8
    return { ...m, bounds: hit.bounds.map((v, i) => v + (m.bounds[i] - v) * k), key, seen: t }
  })
  // Lingering boxes only make sense while the phone is still. Once it pans, old boxes point at nothing.
  const panning = matched ? moved / matched > 0.05 : clean.length > 0 && prev.length > 0
  if (!panning) {
    for (const p of prev) {
      if (next.length >= MAX_BOXES) break
      if (used.has(p.key) || t - p.seen >= HOLD_MS) continue
      if (next.some((n) => iou(n.bounds, p.bounds) > 0.1)) continue
      next.push({ ...p, centered: false })
    }
  }
  return next
}
type Draft = { photo: string; name: string; size: SizeClass; tag: Tag | null; recipient: string; qty: number; label?: string }

const SIZE_OPTS: Array<[SizeClass, string]> = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['oversize', 'Huge']]

export default function Scan() {
  const { roomId = '' } = useParams()
  const nav = useNavigate()
  const job = useStore(() => store.getJob())
  const room = useStore(() => (job ? store.listRooms(job.id).find((r) => r.id === roomId) : undefined))
  const roomItems = useStore(() => (job && room ? store.listItems(job.id, room.id) : []))
  const count = roomItems.length
  // Scanner memory: what the camera called each thing we already tagged in this room, so it can wear its dot.
  const memKey = `dot.scanmem.${roomId}`
  const [mem, setMem] = useState<Array<{ id: string; label: string }>>(() => { try { return JSON.parse(localStorage.getItem(memKey) ?? '[]') } catch { return [] } })
  const remember = (id: string, label: string) => setMem((all) => { const next = [...all, { id, label }].slice(-200); try { localStorage.setItem(memKey, JSON.stringify(next)) } catch { /* best effort */ } return next })

  const [draft, setDraft] = useState<Draft | null>(null)
  const [opened, setOpened] = useState(false)
  const allRooms = useStore(() => (job ? store.listRooms(job.id) : []))
  const allItems = useStore(() => (job ? store.listItems(job.id) : []))
  const marks = useRef(new Map<string, Tag>()).current
  const { video, state, canWide, wideOn, toggleWide } = useCamera(!draft)
  const [live, setLive] = useState<Tracked[]>([])
  const [flash, setFlash] = useState(false)
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [offline, setOffline] = useState(false)
  const [err, setErr] = useState('')
  const [slow, setSlow] = useState(false)
  useEffect(() => { if (modelReady || offline) return; const t = setTimeout(() => setSlow(true), 6000); return () => clearTimeout(t) }, [modelReady, offline])
  const fileRef = useRef<HTMLInputElement>(null)

  // Live detection loop on the stream.
  useEffect(() => {
    if (state !== 'live' || draft) return
    const v = video.current
    if (!v) return
    let on = true
    let fails = 0
    let t: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const found = await identifyItems(v)
        if (!on) return
        fails = 0
        setModelReady(true); setOffline(false)
        const t = Date.now()
        setLive((prev) => track(prev, found, t))
      } catch {
        if (!on) return
        // Give up quietly after a few tries (no signal in a basement); the shutter still works.
        if (++fails >= 3) { setOffline(true); return }
      }
      if (on) t = setTimeout(tick, 300)
    }
    void tick()
    return () => { on = false; clearTimeout(t) }
  }, [state, draft, video])

  // Drop held boxes once they expire, even if detection has stalled.
  useEffect(() => {
    if (!live.length) return
    const t = setInterval(() => setLive((prev) => prev.filter((p) => Date.now() - p.seen < HOLD_MS)), 250)
    return () => clearInterval(t)
  }, [live.length])

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(null), 3500)
    return () => clearTimeout(t)
  }, [saved])

  if (!job || !room) return null
  if (roomLocked(job, allRooms, allItems, room.id) && !opened) return <Paywall job={job} back={`/rooms/${room.id}`} onOpen={() => setOpened(true)} />

  const startDraft = (photo: string, m?: Match) => {
    const name = m?.name ?? ''
    const size = m?.size ?? itemCatalog.find((i) => i.name === name)?.size ?? ai.suggestTag(name)?.size ?? 'medium'
    const s = ai.suggestTag(name)
    setDraft({ photo, name, size, tag: s && s.tag !== 'undecided' ? s.tag : null, recipient: '', qty: 1, label: m?.name })
  }

  const shutter = (m?: Match) => {
    const v = video.current
    if (!v) return
    const photo = snapshot(v)
    if (!photo) return
    setFlash(true); setTimeout(() => setFlash(false), 120)
    if (navigator.vibrate) navigator.vibrate(10)
    // Pick the centred detection if the user tapped the shutter rather than a box.
    const fresh = live.filter((x) => !marks.has(x.key))
    const pick = m ?? fresh.find((x) => x.centered) ?? fresh[0] ?? live.find((x) => x.centered) ?? live[0]
    startDraft(photo, pick)
  }

  const fromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const photo = await fileToDataUrl(f, 1024, 0.72)
    let m: Match | undefined
    try { const found = await identifyItems(photo); m = found.find((x) => x.centered) ?? found[0] } catch { /* no detection */ }
    startDraft(photo, m)
  }

  const save = () => {
    const helper = store.relation === 'scanner'
    if (!draft || !draft.name.trim() || (!draft.tag && !helper)) return
    const id = uid()
    try { store.saveItem({
      id, jobId: job.id, roomId: room.id, name: draft.name.trim(), size: draft.size, tag: draft.tag ?? 'undecided', photo: draft.photo, qty: draft.qty > 1 ? draft.qty : undefined,
      familyRecipient: draft.tag === 'family' ? draft.recipient.trim() || undefined : undefined,
      status: 'tagged', createdAt: now(), updatedAt: now(),
    }, true) } catch {
      setErr('This phone is out of space for photos. Your item was not saved. Export your lists from Settings and call us.')
      return
    }
    setErr('')
    if (navigator.vibrate) navigator.vibrate([10, 30, 10])
    setSaved({ id, name: draft.name.trim() })
    remember(id, draft.label ?? draft.name.trim())
    setDraft(null)
  }

  const hint = state === 'denied' ? 'Camera is off. Allow it in Settings, or add a photo.'
    : state === 'unsupported' ? 'Live camera needs a secure connection. Add a photo instead.'
    : state !== 'live' ? 'Opening camera…'
    : offline ? 'Recognition is offline here. Press the button and type the name.'
    : !modelReady ? (slow ? 'Still loading recognition. You can press the button and type the name.' : 'Warming up…')
    : live.length ? 'Tap an item, or press the button' : 'Point at an item'

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      {/* Viewfinder */}
      <video ref={video} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
      <AnimatePresence>{flash && <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />}</AnimatePresence>

      {/* Live boxes */}
      {(() => { marks.clear(); const left = mem.map((x) => ({ label: x.label.toLowerCase(), item: roomItems.find((i) => i.id === x.id) })).filter((x) => x.item); [...live].sort((a, b) => a.key.localeCompare(b.key)).forEach((m) => { const k = left.findIndex((x) => x.label === m.name.toLowerCase()); if (k >= 0) { marks.set(m.key, left[k].item!.tag); left.splice(k, 1) } }); return null })()}
      <AnimatePresence>
        {!draft && live.map((m) => {
          const done = marks.get(m.key)
          return (
          <motion.button
            key={m.key}
            type="button" aria-label={`Select ${m.name}`} onClick={() => shutter(m)}
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1, left: `${m.bounds[0] * 100}%`, top: `${m.bounds[1] * 100}%`, width: `${m.bounds[2] * 100}%`, height: `${m.bounds[3] * 100}%` }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 0.3, ease: 'linear', opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}
            className={`absolute rounded-[22px] ${m.centered ? 'bg-white/20 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.95),0_0_32px_rgba(255,255,255,0.35)]' : 'bg-white/10 shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.75)]'}`}
          >
            {(['left-0 top-0 border-l-4 border-t-4 rounded-tl-[22px]', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-[22px]', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-[22px]', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-[22px]'] as const).map((c) => <span key={c} aria-hidden className={`absolute w-7 h-7 border-white ${c}`} />)}
            {done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 18 }} className="absolute left-1/2 top-1/2 -ml-[26px] -mt-[26px] rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.95),0_8px_24px_rgba(0,0,0,0.35)]"><Dot tag={done} size={52} /></motion.span>}
            <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 px-3.5 py-1 rounded-full bg-white text-ink text-[15px] font-semibold shadow-lg whitespace-nowrap">{m.name}{done ? ' · tagged' : ''}</span>
          </motion.button>
        )})}
      </AnimatePresence>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(var(--spacing-safe-t)+10px)] bg-gradient-to-b from-black/60 to-transparent pb-8">
        <button aria-label="Close camera" onClick={() => nav(`/rooms/${room.id}`)} className="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center active:scale-95"><X size={22} /></button>
        <div className="text-center">
          <div className="text-[15px] font-semibold">{room.name}</div>
          <div className="text-[13px] text-white/70">{count} tagged</div>
        </div>
        {canWide ? <LensPill wide={wideOn} onToggle={toggleWide} /> : <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center" aria-hidden><Zap size={18} className={state === 'live' && modelReady ? 'text-green-300' : 'text-white/50'} /></div>}
      </div>

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 pb-[calc(var(--spacing-safe-b)+22px)] pt-10 bg-gradient-to-t from-black/70 to-transparent">
        <p className="text-center text-[15px] font-medium text-white/90 mb-5" role="status">{hint}</p>
        <div className="grid grid-cols-3 items-center px-8">
          <button aria-label="Add a photo from your library" onClick={() => fileRef.current?.click()} className="w-12 h-12 rounded-full bg-white/15 backdrop-blur flex items-center justify-center justify-self-start active:scale-95"><ImagePlus size={22} /></button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={fromFile} />
          <button aria-label="Capture item" disabled={state !== 'live'} onClick={() => shutter()} className="justify-self-center w-[76px] h-[76px] rounded-full border-[5px] border-white flex items-center justify-center active:scale-95 disabled:opacity-40">
            <span className="w-[60px] h-[60px] rounded-full bg-white" />
          </button>
          <button onClick={() => nav(`/rooms/${room.id}`)} className="justify-self-end min-h-12 px-4 rounded-full bg-white/15 backdrop-blur text-[15px] font-semibold active:scale-95">Done</button>
        </div>
      </div>

      <Toast show={!!saved} text={`Saved ${saved?.name ?? ''}`} onUndo={() => { if (saved) { store.deleteItem(saved.id); setSaved(null) } }} />

      {/* Tagging sheet */}
      <Sheet open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null) }} footer={draft && (
        <div className="text-ink">
          {err && <p role="alert" className="text-danger text-[15px] font-medium mb-2">{err}</p>}
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <button className="btn btn-secondary w-auto px-5" onClick={() => setDraft(null)}>Retake</button>
            <button className="btn" disabled={!draft.name.trim() || (!draft.tag && store.relation !== 'scanner')} onClick={save}><Check size={20} /> {!draft.name.trim() ? 'Name it to save' : !draft.tag && store.relation !== 'scanner' ? 'Pick where it goes' : 'Save and keep going'}</button>
          </div>
        </div>
      )}>
        {draft && (
          <div className="text-ink">
            <div className="flex gap-4 items-start mb-4">
              <img src={draft.photo} alt="" className="w-20 h-20 rounded-xl object-cover bg-surface-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <label className="eyebrow block mb-1" htmlFor="item-name">Item</label>
                <input id="item-name" className="input" list="catalog" placeholder="What is it?" value={draft.name}
                  onChange={(e) => {
                    const name = e.target.value
                    const cat = itemCatalog.find((i) => i.name.toLowerCase() === name.trim().toLowerCase())
                    const s = ai.suggestTag(name)
                    setDraft({ ...draft, name, size: cat?.size ?? draft.size, tag: draft.tag ?? (s && s.tag !== 'undecided' ? s.tag : null) })
                  }} />
                <datalist id="catalog">{itemCatalog.map((i) => <option key={i.name} value={i.name} />)}</datalist>
              </div>
            </div>

            <div className="mb-4">
              <Segmented options={SIZE_OPTS} value={draft.size} onChange={(size) => setDraft({ ...draft, size })} />
            </div>
            {(isSetLike(draft.name) || draft.qty > 1) && <div className="mb-4"><SetPicker name={draft.name} value={draft.qty} onChange={(qty) => setDraft({ ...draft, qty })} /></div>}

            {store.relation !== 'scanner' && <><div className="mb-2 flex items-baseline justify-between">
              <span className="eyebrow">What should happen to it?</span>
              {(() => { const s = ai.suggestTag(draft.name); return s && s.tag !== 'undecided' && draft.tag !== s.tag ? <button className="text-[13px] font-semibold text-accent" onClick={() => setDraft({ ...draft, tag: s.tag })}>Suggest: {s.tag}</button> : null })()}
            </div>
            <TagChips value={draft.tag} onChange={(tag) => setDraft({ ...draft, tag })} />

            {draft.tag === 'family' && (
              <input className="input mt-3" placeholder="Who is it for? e.g. Sarah" value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })} />
            )}</>}

          </div>
        )}
      </Sheet>
    </div>
  )
}
