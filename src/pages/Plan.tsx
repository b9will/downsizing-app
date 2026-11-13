import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, Pencil } from 'lucide-react'
import { Dot, Page, Segmented, Sheet, TagChips } from '../components/ui'
import { ExportSheet } from '../components/ExportSheet'
import { useStore } from '../lib/hooks'
import { now, store } from '../lib/store'
import { itemLabel, SIZES, TAGS, type Item, type SizeClass, type Tag } from '../lib/types'

// The plan: every item grouped by what happens to it. Homeowner edits with a tap; crew and family read it as a checklist.
const ORDER: Tag[] = ['move', 'family', 'sell', 'store', 'donate', 'junk', 'keep', 'undecided']
const BLURB: Record<Tag, string> = {
  move: 'Packed and moved to the new home.',
  family: 'Delivered or shipped to the person named.',
  sell: 'Appraised, then consigned or sold. Proceeds credited to you.',
  store: 'Inventoried and placed in storage.',
  donate: 'Picked up by the charity. You get the receipt.',
  junk: 'Disposed of or recycled.',
  keep: 'Stays exactly where it is.',
  undecided: 'We will help you decide before move day.',
}
const SIZE_OPTS: Array<[SizeClass, string]> = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['oversize', 'Huge']]

export default function Plan() {
  const job = useStore(() => store.getJob())
  const rooms = useStore(() => (job ? store.listRooms(job.id) : []))
  const items = useStore(() => (job ? store.listItems(job.id) : []))
  const [filter, setFilter] = useState<Tag | 'all'>('all')
  const [editing, setEditing] = useState<Item | null>(null)
  const [exporting, setExporting] = useState(false)
  if (!job) return null

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? 'Unknown room'
  const groups = ORDER.map((t) => ({ t, list: items.filter((i) => i.tag === t) })).filter((g) => g.list.length && (filter === 'all' || filter === g.t))
  const byRecipient = (list: Item[]) => {
    const m = new Map<string, Item[]>()
    list.forEach((i) => { const k = i.familyRecipient?.trim() || 'Family (unassigned)'; m.set(k, [...(m.get(k) ?? []), i]) })
    return [...m.entries()]
  }

  const update = (patch: Partial<Item>) => {
    if (!editing) return
    const next = { ...editing, ...patch, updatedAt: now() }
    store.saveItem(next); setEditing(next)
  }

  const Row = ({ i }: { i: Item }) => (
    <button type="button" onClick={() => setEditing(i)} className="flex items-center gap-3 w-full text-left py-2 border-t border-line first:border-t-0">
      <div className="w-11 h-11 rounded-xl bg-surface overflow-hidden shrink-0">{i.photo && <img src={i.photo} alt="" className="w-full h-full object-cover" />}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[15px] truncate">{i.special ? '★ ' : ''}{itemLabel(i)}</div>
        <div className="text-ink-2 text-[14px] truncate">{i.description ? `${i.description} · ` : ''}{roomName(i.roomId)} · {SIZES[i.size].split(' (')[0]}{i.note ? ` · ${i.note}` : ''}</div>
      </div>
      <Pencil size={16} className="text-ink-3 shrink-0" />
    </button>
  )

  return (
    <Page>
      <div className="flex items-end justify-between mb-1">
        <h1>The plan</h1>
        <button className="btn btn-secondary btn-sm" disabled={!items.length} onClick={() => setExporting(true)}><FileSpreadsheet size={18} /> Export</button>
      </div>
      <p className="lead mb-4">Everything you've tagged, grouped by what happens to it. Tap any item to change your mind.</p>

      <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-3 mb-2" style={{ scrollbarWidth: 'none' }}>
        {(['all', ...ORDER] as const).map((t) => {
          const n = t === 'all' ? items.length : items.filter((i) => i.tag === t).length
          if (t !== 'all' && !n) return null
          return (
            <button key={t} onClick={() => setFilter(t)} className={`shrink-0 rounded-full px-4 h-11 text-[15px] font-medium border ${filter === t ? 'bg-ink text-white border-ink' : 'bg-surface-2 border-transparent text-ink'}`}>
              {t === 'all' ? `All ${n}` : <span className="inline-flex items-center gap-1.5"><Dot tag={t} size={18} />{TAGS[t].name} {n}</span>}
            </button>
          )
        })}
      </div>

      {items.length === 0 && (
        <Link to="/rooms" className="card text-center py-10 text-ink-2">Nothing tagged yet. Start in a room.</Link>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <section key={g.t} className="card pt-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3"><Dot tag={g.t} size={38} /><span className="sec">{TAGS[g.t].name} · {g.list.length}</span></div>
            </div>
            <p className="text-ink-2 text-[13px] mb-1">{BLURB[g.t]}</p>
            {g.t === 'family'
              ? byRecipient(g.list).map(([who, list]) => (
                  <div key={who} className="mt-2">
                    <div className="eyebrow mb-1">{who}</div>
                    {list.map((i) => <Row key={i.id} i={i} />)}
                  </div>
                ))
              : g.list.map((i) => <Row key={i.id} i={i} />)}
          </section>
        ))}
      </div>

      <ExportSheet open={exporting} onOpenChange={setExporting} job={job} rooms={rooms} items={items} />

      <Sheet open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        {editing && (
          <div>
            <div className="flex gap-4 items-start mb-4">
              <div className="w-20 h-20 rounded-xl bg-surface-2 overflow-hidden shrink-0">{editing.photo && <img src={editing.photo} alt="" className="w-full h-full object-cover" />}</div>
              <div className="flex-1 min-w-0">
                <label className="eyebrow block mb-1" htmlFor="plan-name">Item</label>
                <input id="plan-name" className="input" value={editing.name} onChange={(e) => update({ name: e.target.value })} />
                <div className="text-ink-2 text-[13px] mt-1">{roomName(editing.roomId)}</div>
              </div>
            </div>
            <div className="mb-4"><Segmented options={SIZE_OPTS} value={editing.size} onChange={(size) => update({ size })} /></div>
            <div className="eyebrow mb-2">What should happen to it?</div>
            <TagChips value={editing.tag} onChange={(tag) => update({ tag })} />
            {editing.tag === 'family' && <input className="input mt-3" placeholder="Who is it for?" value={editing.familyRecipient ?? ''} onChange={(e) => update({ familyRecipient: e.target.value })} />}
            <textarea className="input mt-3 py-3 h-auto min-h-20" placeholder="Note for the crew (optional)" value={editing.note ?? ''} onChange={(e) => update({ note: e.target.value })} />
            <div className="grid grid-cols-[auto_1fr] gap-3 mt-5">
              <button className="btn btn-danger w-auto px-4" onClick={() => { store.deleteItem(editing.id); setEditing(null) }}>Delete</button>
              <button className="btn" onClick={() => setEditing(null)}>Done</button>
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  )
}
