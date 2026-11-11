import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, Heart } from 'lucide-react'
import { Dot, Page, TagChips } from '../components/ui'
import { useStore } from '../lib/hooks'
import { now, store } from '../lib/store'
import { sb } from '../lib/supabase'
import { TAGS, type Tag } from '../lib/types'

// Sorting queue: everything that has been scanned but not decided yet, one card at a time.
// The owner's tap decides. Everyone else's tap is a request the owner sees on the card.
type Wish = { item_id: string; user_id: string; by_name: string; wish: Tag | 'want' }
const wishText = (w: Wish) => (w.wish === 'want' ? `${w.by_name} would like this` : `${w.by_name} suggests ${TAGS[w.wish].name}`)

export default function Sort() {
  const user = useStore(() => store.getUser())
  const job = useStore(() => store.getJob())
  const rooms = useStore(() => (job ? store.listRooms(job.id) : []))
  const items = useStore(() => (job ? store.listItems(job.id) : []))
  const decides = store.relation === 'owner' || store.relation === 'executor' || store.relation === 'staff'
  const [wishes, setWishes] = useState<Wish[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [recipient, setRecipient] = useState('')

  useEffect(() => {
    if (!job) return
    void sb.from('item_wishes').select('item_id, user_id, by_name, wish').eq('job_id', job.id).then(({ data }) => setWishes((data ?? []) as Wish[]))
  }, [job?.id])

  // Owner: everything undecided. Others: undecided items they haven't weighed in on yet.
  const queue = useMemo(() => items
    .filter((i) => i.tag === 'undecided' && !skipped.includes(i.id) && (decides || !wishes.some((w) => w.item_id === i.id && w.user_id === user?.id)))
    .sort((a, b) => rooms.findIndex((r) => r.id === a.roomId) - rooms.findIndex((r) => r.id === b.roomId) || a.createdAt.localeCompare(b.createdAt)),
  [items, skipped, wishes, decides, rooms, user?.id])
  if (!job || !user) return null

  const total = items.filter((i) => i.tag === 'undecided').length
  const cur = queue[0]
  const first = job.clientName.split(' ')[0]

  const wish = async (w: Tag | 'want') => {
    if (!cur) return
    const row: Wish = { item_id: cur.id, user_id: user.id, by_name: user.name.split(' ')[0] || 'Family', wish: w }
    setWishes((all) => [...all.filter((x) => !(x.item_id === cur.id && x.user_id === user.id)), row])
    await sb.from('item_wishes').upsert({ ...row, job_id: job.id })
  }
  const decide = (t: Tag) => {
    if (!cur) return
    if (t === 'undecided') { setSkipped([...skipped, cur.id]); return }
    const wanted = wishes.find((w) => w.item_id === cur.id && w.wish === 'want')
    store.saveItem({ ...cur, tag: t, familyRecipient: t === 'family' ? recipient.trim() || wanted?.by_name || undefined : undefined, updatedAt: now() })
    setRecipient('')
  }

  if (!cur) {
    return (
      <Page className="min-h-full flex flex-col gap-4 pt-10">
        <span className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center"><Check size={32} strokeWidth={2.6} /></span>
        <h1>{total && decides ? `${total} left for later` : decides ? 'Everything is sorted' : "That's everything for now"}</h1>
        <p className="lead">{decides ? 'You can change any decision on the Plan page.' : `${first} makes the final call and can see what you asked for.`}</p>
        <Link to="/plan" className="btn mt-2">See the plan</Link>
        <Link to="/" className="btn btn-secondary">Home</Link>
      </Page>
    )
  }

  const mine = wishes.filter((w) => w.item_id === cur.id)
  return (
    <Page className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link to="/" aria-label="Home" className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center"><ChevronLeft size={22} /></Link>
        <span className="font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{queue.length} to {decides ? 'sort' : 'look at'}</span>
        <span className="w-11" />
      </div>
      {cur.photo ? <img src={cur.photo} alt="" className="w-full h-56 object-contain rounded-3xl bg-surface-2" /> : <div className="w-full h-40 rounded-3xl bg-surface-2" />}
      <div>
        <h1 className="text-[28px]">{cur.name}</h1>
        <p className="text-ink-2 text-[16px]">{[cur.description, rooms.find((r) => r.id === cur.roomId)?.name].filter(Boolean).join(' · ')}</p>
      </div>

      {mine.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {mine.map((w) => <div key={w.user_id} className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#f3e8ff] text-[15px] font-medium">{w.wish === 'want' ? <Heart size={18} /> : <Dot tag={w.wish} size={22} />}{wishText(w)}</div>)}
        </div>
      )}

      {decides ? (
        <>
          <div className="sec mt-1">Where does it go?</div>
          <TagChips value={null} onChange={decide} />
          <label htmlFor="who" className="sr-only">If family, who is it for?</label>
          <input id="who" className="input" placeholder="If Family: who is it for? (optional)" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          <p className="text-ink-2 text-[14px] text-center">"Not sure" skips it for now.</p>
        </>
      ) : (
        <>
          <button className="btn" onClick={() => wish('want')}><Heart size={20} /> I'd like this</button>
          <div className="sec mt-2">Or suggest where it goes</div>
          <TagChips value={null} compact onChange={(t) => (t === 'undecided' ? setSkipped([...skipped, cur.id]) : wish(t))} />
          <p className="text-ink-2 text-[14px] text-center">{first} decides. "Not sure" skips it.</p>
        </>
      )}
    </Page>
  )
}
