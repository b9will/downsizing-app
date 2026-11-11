import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, X } from 'lucide-react'
import { Dot, Segmented, TagChips } from '../components/ui'
import { snapshot, useCamera } from '../lib/camera'
import { useStore } from '../lib/hooks'
import { now, store, uid } from '../lib/store'
import { sb } from '../lib/supabase'
import { type Contents, type SizeClass, type Tag } from '../lib/types'

// Room quick scan: turn slowly, we photograph the whole room, the AI lists what is in it,
// then one card per item: where does it go, and what about what's inside.
type Found = { name: string; description: string; size: SizeClass; container: boolean; contents_visible: string; prep: string; frame: number; box: number[]; confidence: number; photo: string }
type Phase = 'intro' | 'scan' | 'working' | 'review' | 'done' | 'error'

const SECTORS = 12 // 30 degrees each
const MAX_FRAMES = 24
const SIZE_OPTS: Array<[SizeClass, string]> = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['oversize', 'Huge']]
const CONTENTS: Array<[Contents, string, string, Tag | null]> = [
  ['donate', 'Donate it all', '', 'donate'], ['junk', 'Dispose of it all', '', 'junk'],
  ['leave', 'Leave it in', 'Goes wherever this goes', null], ['family', 'Family looks first', '', 'family'],
  ['sort', 'Sort it later', 'We add it to your to-do list', 'undecided'],
]

/** Cut the item out of its frame, with a little margin, for its photo. */
async function crop(frame: string, box: number[]): Promise<string> {
  const img = new Image(); img.src = frame; await img.decode()
  const pad = 0.06
  const x = Math.max(0, box[0] - pad), y = Math.max(0, box[1] - pad)
  const w = Math.min(1 - x, box[2] + pad * 2), h = Math.min(1 - y, box[3] + pad * 2)
  if (w < 0.08 || h < 0.08) return frame
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * w); c.height = Math.round(img.naturalHeight * h)
  c.getContext('2d')!.drawImage(img, img.naturalWidth * x, img.naturalHeight * y, c.width, c.height, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

export default function QuickScan() {
  const { roomId = '' } = useParams()
  const nav = useNavigate()
  const job = useStore(() => store.getJob())
  const room = useStore(() => (job ? store.listRooms(job.id).find((r) => r.id === roomId) : undefined))
  const [phase, setPhase] = useState<Phase>('intro')
  const { video, state, canWide, wideOn, toggleWide } = useCamera(phase === 'intro' || phase === 'scan', { preferWide: true })
  const frames = useRef<string[]>([])
  const sectors = useRef<Set<number>>(new Set())
  const heading = useRef<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [hasCompass, setHasCompass] = useState(false)
  const [found, setFound] = useState<Found[]>([])
  const [idx, setIdx] = useState(0)
  const [tag, setTag] = useState<Tag | null>(null)
  const [askInside, setAskInside] = useState<null | 'ask' | 'what'>(null)
  const [saved, setSaved] = useState<Record<Tag, number>>({} as Record<Tag, number>)
  const [msg, setMsg] = useState('')

  // Compass heading tells us which parts of the room have been covered.
  useEffect(() => {
    if (phase !== 'scan') return
    const on = (e: DeviceOrientationEvent) => {
      const h = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null)
      if (h != null) { heading.current = h; setHasCompass(true) }
    }
    window.addEventListener('deviceorientation', on)
    return () => window.removeEventListener('deviceorientation', on)
  }, [phase])

  // Capture loop: one frame per new 30-degree sector (or on a timer when there is no compass).
  useEffect(() => {
    if (phase !== 'scan' || state !== 'live') return
    const t = setInterval(() => {
      const v = video.current; if (!v || frames.current.length >= MAX_FRAMES) return
      if (heading.current != null) {
        const s = Math.floor((((heading.current % 360) + 360) % 360) / (360 / SECTORS))
        if (sectors.current.has(s)) return
        sectors.current.add(s)
      }
      const f = snapshot(v, 768, 0.6); if (!f) return
      frames.current.push(f)
      if (navigator.vibrate) navigator.vibrate(8)
      setProgress(heading.current != null ? sectors.current.size / SECTORS : Math.min(1, frames.current.length / 16))
    }, heading.current != null ? 250 : 900)
    return () => clearInterval(t)
  }, [phase, state, video, hasCompass])

  if (!job || !room) return null

  const start = async () => {
    // iPhones ask permission for motion sensors, and only from a tap.
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    try { if (typeof D?.requestPermission === 'function') await D.requestPermission() } catch { /* fall back to timed capture */ }
    frames.current = []; sectors.current = new Set(); setProgress(0); setPhase('scan')
  }

  const finish = async () => {
    if (frames.current.length < 3) { setMsg('Keep turning a little more first.'); return }
    setPhase('working'); setMsg('')
    try {
      const { data, error } = await sb.functions.invoke('scan-room', { body: { room: room.name, frames: frames.current } })
      if (error || !data?.items) {
        let m = data?.message as string | undefined
        try { m ??= (await (error as { context?: Response })?.context?.json())?.message } catch { /* ignore */ }
        throw new Error(m ?? 'We could not read that scan. Check your signal and try again.')
      }
      const list: Found[] = []
      for (const i of data.items as Omit<Found, 'photo'>[]) list.push({ ...i, photo: await crop(frames.current[i.frame] ?? frames.current[0], i.box) })
      if (!list.length) throw new Error('We did not spot anything. Try again with more light, turning slowly.')
      frames.current = [] // the room photos are no longer needed
      setFound(list); setIdx(0); setTag(null); setAskInside(null); setPhase('review')
    } catch (e) { setMsg((e as Error).message); setPhase('error') }
  }

  const cur = found[idx]
  const edit = (patch: Partial<Found>) => setFound(found.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  const next = () => { setTag(null); setAskInside(null); if (idx + 1 >= found.length) setPhase('done'); else setIdx(idx + 1) }
  const save = (t: Tag, contents?: Contents) => {
    store.saveItem({
      id: uid(), jobId: job.id, roomId: room.id, name: cur.name.trim() || 'Item', size: cur.size, tag: t, photo: cur.photo,
      description: cur.description || undefined, prep: cur.prep || undefined, contents, source: 'quickscan',
      note: contents === 'sort' ? 'Contents to sort' : undefined, status: 'tagged', createdAt: now(), updatedAt: now(),
    })
    setSaved((s) => ({ ...s, [t]: (s[t] ?? 0) + 1 }))
    next()
  }
  const pick = (t: Tag) => { setTag(t); if (cur.container && t !== 'keep') setAskInside('ask'); else save(t) }

  // ---------- camera phases ----------
  if (phase === 'intro' || phase === 'scan') {
    const pct = Math.round(progress * 100)
    return (
      <div className="fixed inset-0 bg-black text-white overflow-hidden">
        <video ref={video} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(var(--spacing-safe-t)+10px)] pb-8 bg-gradient-to-b from-black/60 to-transparent">
          <button aria-label="Close" onClick={() => nav(`/rooms/${room.id}`)} className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center"><X size={22} /></button>
          <span className="text-[18px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{room.name}</span>
          {canWide ? <button onClick={toggleWide} aria-label={wideOn ? 'Switch to normal lens' : 'Switch to wide lens'} className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-[14px] font-bold">{wideOn ? '0.5×' : '1×'}</button> : <span className="w-11" />}
        </div>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-[calc(var(--spacing-safe-b)+24px)] pt-16 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-4 text-center">
          {phase === 'intro' ? (
            <>
              <p className="text-[22px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Stand in the middle and turn slowly</p>
              <p className="text-[16px] text-white/85 max-w-xs">Hold the phone upright. One full turn takes about a minute. We list everything we see.</p>
              <button className="btn bg-white text-ink" disabled={state !== 'live'} onClick={start}>{state === 'live' ? 'Start scanning' : state === 'denied' ? 'Camera is blocked' : 'Opening camera…'}</button>
              <Link to={`/rooms/${room.id}/scan`} className="min-h-11 flex items-center font-semibold text-white/90">Or tag one item at a time</Link>
            </>
          ) : (
            <>
              <svg width="120" height="120" viewBox="0 0 132 132" role="img" aria-label={`${pct} percent of the room scanned`}>
                <circle cx="66" cy="66" r="56" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="12" />
                <circle cx="66" cy="66" r="56" fill="none" stroke="#facc15" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${progress * 352} 352`} transform="rotate(-90 66 66)" style={{ transition: 'stroke-dasharray 0.3s' }} />
                <text x="66" y="74" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="600">{pct}%</text>
              </svg>
              <p className="text-[20px] font-semibold" role="status" style={{ fontFamily: 'var(--font-display)' }}>{progress >= 1 ? 'Got the whole room' : progress > 0.5 ? 'Keep turning, nearly there' : 'Keep turning slowly'}</p>
              {msg && <p className="text-[15px] text-yellow-300" role="alert">{msg}</p>}
              <button className={`btn ${progress >= 1 ? 'bg-white text-ink' : 'bg-white/20 text-white'}`} onClick={finish}>{progress >= 1 ? 'List what you saw' : 'Finish early'}</button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'working' || phase === 'error') {
    return (
      <div className="page min-h-full flex flex-col justify-center gap-5">
        <div className="flex gap-2" aria-hidden><Dot tag="move" size={40} /><Dot tag="donate" size={40} /><Dot tag="sell" size={40} /></div>
        {phase === 'working' ? (
          <>
            <h1>Listing what's in the {room.name.toLowerCase()}</h1>
            <p className="lead" role="status">This takes about a minute. Keep the app open.</p>
          </>
        ) : (
          <>
            <h1>That scan didn't work</h1>
            <p className="lead" role="alert">{msg}</p>
            <button className="btn" onClick={() => setPhase('intro')}>Scan again</button>
            <Link to={`/rooms/${room.id}/scan`} className="btn btn-secondary">Tag one item at a time</Link>
          </>
        )}
      </div>
    )
  }

  if (phase === 'done') {
    const total = Object.values(saved).reduce((a, b) => a + b, 0)
    return (
      <div className="page min-h-full flex flex-col gap-4 pt-16">
        <span className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center"><Check size={32} strokeWidth={2.6} /></span>
        <h1>{room.name} done</h1>
        <p className="lead">{total} item{total === 1 ? '' : 's'} added.</p>
        <div className="grid grid-cols-4 gap-2">{(Object.entries(saved) as [Tag, number][]).map(([t, n]) => <span key={t} className="flex flex-col items-center gap-1 font-semibold"><Dot tag={t} size={50} />{n}</span>)}</div>
        <div className="sec mt-2">Missed anything?</div>
        <Link to={`/rooms/${room.id}/scan`} className="card font-semibold">Add an item, e.g. behind a door</Link>
        <Link to={`/rooms/${room.id}`} className="card font-semibold">See everything in this room</Link>
        <button className="btn mt-auto" onClick={() => { store.saveRoom({ ...room, done: true }); nav('/', { replace: true }) }}>Mark room done</button>
      </div>
    )
  }

  // ---------- review: one card per item ----------
  return (
    <div className="page min-h-full flex flex-col gap-3 pb-6">
      <div className="flex items-center justify-between">
        <button aria-label="Back to room" onClick={() => nav(`/rooms/${room.id}`)} className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center"><ChevronLeft size={22} /></button>
        <span className="font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{room.name} · {idx + 1} of {found.length}</span>
        <span className="w-11" />
      </div>
      <div className="h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${((idx + 1) / found.length) * 100}%` }} /></div>
      <img src={cur.photo} alt="" className="w-full h-56 object-contain rounded-3xl bg-surface-2" />
      <div>
        <label htmlFor="qs-name" className="sr-only">Item name</label>
        <input id="qs-name" className="w-full bg-transparent text-[28px] font-semibold tracking-tight focus:outline-none" style={{ fontFamily: 'var(--font-display)' }} value={cur.name} onChange={(e) => edit({ name: e.target.value })} />
        {cur.description && <p className="text-ink-2 text-[16px]">{cur.description}</p>}
        {cur.prep && <p className="mt-2 px-3 py-2 rounded-xl bg-[#fef3c7] text-[15px]"><b>Before we arrive:</b> {cur.prep}</p>}
      </div>
      <Segmented options={SIZE_OPTS} value={cur.size} onChange={(size) => edit({ size })} />

      {askInside === null && (<>
        <div className="sec mt-1">Where does it go?</div>
        <TagChips value={tag} onChange={pick} />
        <button className="btn btn-ghost mt-auto" onClick={next}>Not here, or a duplicate</button>
      </>)}

      {askInside === 'ask' && tag && (<>
        <div className="sec mt-1">Anything inside it?</div>
        {cur.contents_visible && <p className="text-ink-2 text-[15px]">We can see: {cur.contents_visible}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => setAskInside('what')}>Yes</button>
          <button className="btn btn-secondary" onClick={() => save(tag, 'none')}>No, it's empty</button>
        </div>
      </>)}

      {askInside === 'what' && tag && (<>
        <div className="sec mt-1">What happens to what's inside?</div>
        <div className="flex flex-col gap-2">
          {CONTENTS.map(([v, label, sub, dot]) => (
            <button key={v} onClick={() => save(tag, v)} className="card flex items-center gap-3 py-3 text-left min-h-14">
              <Dot tag={dot ?? tag} size={34} />
              <span><b className="block font-semibold">{label}</b>{sub && <span className="text-ink-2 text-[14px]">{sub}</span>}</span>
            </button>
          ))}
        </div>
      </>)}
    </div>
  )
}
