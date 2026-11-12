import { useState } from 'react'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { Dot, Page } from '../components/ui'
import { exportCsv, itemsFor, recipientOf, type Scope } from '../lib/export'
import { useStore } from '../lib/hooks'
import { exportPdf } from '../lib/pdf'
import { store } from '../lib/store'
import { EMPTY_DETAILS, itemLabel, type Tag } from '../lib/types'

// Sharing starts with a person, not a file type: who is it for? Then one list, two buttons.
type Who = { key: string; scope: Scope; tag: Tag; name: string; title: string; blurb: string }

export default function SharePage() {
  const job = useStore(() => store.getJob())
  const rooms = useStore(() => (job ? store.listRooms(job.id) : []))
  const items = useStore(() => (job ? store.listItems(job.id) : []))
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<'link' | 'pdf' | 'csv' | null>(null)
  const [note, setNote] = useState('')
  if (!job) return null

  const d = { ...EMPTY_DETAILS, ...job.details }
  const first = job.clientName.split(' ')[0]
  const guest = 'They get a simple page with photos and sizes. No login, and it updates if you change your mind.'
  const people: Who[] = [
    ...[...new Set(items.filter((i) => i.tag === 'family').map(recipientOf))].sort().map((r): Who => ({ key: `fam-${r}`, scope: { kind: 'family', recipient: r }, tag: 'family', name: r, title: `For ${r}`, blurb: 'Their items, with photos and the pickup address. No login needed.' })),
    { key: 'donate', scope: { kind: 'tag', tag: 'donate' }, tag: 'donate', name: 'Charity', title: `For ${d.charity || 'the charity'}`, blurb: guest },
    { key: 'sell', scope: { kind: 'tag', tag: 'sell' }, tag: 'sell', name: 'Consignment', title: 'For the consignment house', blurb: guest },
    { key: 'store', scope: { kind: 'tag', tag: 'store' }, tag: 'store', name: 'Storage', title: 'For the storage facility', blurb: guest },
    { key: 'junk', scope: { kind: 'tag', tag: 'junk' }, tag: 'junk', name: 'Hauler', title: 'For the hauler', blurb: guest },
    { key: 'move', scope: { kind: 'tag', tag: 'move' }, tag: 'move', name: 'New home', title: 'Moving to the new home', blurb: 'Everything going with you, for whoever is helping at the other end.' },
  ]
  const count = (s: Scope) => itemsFor(items, s).reduce((n, i) => n + (i.qty ?? 1), 0)

  const run = async (kind: 'link' | 'pdf' | 'csv', w: { scope: Scope; title: string }) => {
    setBusy(kind); setNote('')
    try {
      if (kind === 'pdf') await exportPdf(job, rooms, items, w.scope)
      else if (kind === 'csv') await exportCsv(job, rooms, items, w.scope)
      else {
        const url = await store.guestLink(w.scope, w.title)
        const text = `${w.title}: items from ${first}'s move. ${url}`
        if (navigator.share) { try { await navigator.share({ title: w.title, text, url }); return } catch { /* cancelled */ } }
        await navigator.clipboard?.writeText(url); setNote('Link copied. It works for 30 days.')
      }
    } catch { setNote(kind === 'link' ? 'Could not make a link. Check your connection.' : 'That did not work. Please try again.') } finally { setBusy(null) }
  }

  const cur = open === 'all' ? { key: 'all', scope: { kind: 'all' } as Scope, tag: null, title: 'Your full inventory', blurb: 'A record of the whole home: every photo, room by room, with where each thing is going.' } : people.find((p) => p.key === open)
  if (cur) {
    const list = itemsFor(items, cur.scope)
    const shots = list.filter((i) => i.photo).slice(0, 6)
    return (
      <Page className="flex flex-col gap-4">
        <button onClick={() => { setOpen(null); setNote('') }} className="flex items-center gap-2 text-ink-2 font-medium self-start min-h-11"><span className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center text-ink"><ChevronLeft size={22} /></span> Share</button>
        <div className="flex items-center gap-3">
          {cur.tag ? <Dot tag={cur.tag} size={56} /> : <span className="w-14 h-14 rounded-full bg-ink text-white flex items-center justify-center shrink-0"><FileText size={24} /></span>}
          <div className="min-w-0"><h1 className="text-[28px] leading-tight">{cur.title}</h1><p className="text-ink-2 text-[15px]">{count(cur.scope)} piece{count(cur.scope) === 1 ? '' : 's'}{d.currentAddress && cur.key !== 'all' ? ` · pickup at ${d.currentAddress}` : ''}</p></div>
        </div>
        {shots.length > 0 && <div className="grid grid-cols-3 gap-2">{shots.map((i) => <img key={i.id} src={i.photo} alt={itemLabel(i)} className="w-full aspect-square object-cover rounded-2xl bg-surface-2" />)}</div>}
        <ul className="card py-2 divide-y divide-line">
          {list.slice(0, 5).map((i) => <li key={i.id} className="py-2 text-[15px] font-medium truncate">{itemLabel(i)}</li>)}
          {list.length > 5 && <li className="py-2 text-[15px] text-ink-2">and {list.length - 5} more</li>}
        </ul>
        <p className="text-ink-2 text-[15px]">{cur.blurb}</p>
        {note && <p role="status" className="text-accent font-semibold text-center">{note}</p>}
        <div className="flex flex-col gap-2 mt-auto">
          {cur.key === 'all'
            ? <button className="btn" disabled={busy !== null} onClick={() => run('pdf', cur)}>{busy === 'pdf' ? 'Making your PDF…' : 'Save as PDF'}</button>
            : <><button className="btn" disabled={busy !== null} onClick={() => run('link', cur)}>{busy === 'link' ? 'Making the link…' : 'Send the link'}</button>
              <button className="btn btn-secondary" disabled={busy !== null} onClick={() => run('pdf', cur)}>{busy === 'pdf' ? 'Making the PDF…' : 'Save as PDF'}</button></>}
          <button className="btn btn-ghost" disabled={busy !== null} onClick={() => run('csv', cur)}>{busy === 'csv' ? '…' : 'More: spreadsheet'}</button>
        </div>
      </Page>
    )
  }

  return (
    <Page className="flex flex-col gap-3">
      <h1>Who is it for?</h1>
      <button disabled={!items.length} onClick={() => setOpen('all')} className="flex items-center gap-3 p-4 rounded-[22px] bg-ink text-white text-left disabled:opacity-40">
        <span className="w-11 h-14 rounded-md bg-white text-ink flex items-center justify-center shrink-0"><FileText size={20} /></span>
        <span className="flex-1"><b className="block text-[17px] font-semibold">Me: full inventory</b><span className="text-white/75 text-[14px]">PDF with every photo, {count({ kind: 'all' })} pieces</span></span>
        <ChevronRight size={20} />
      </button>
      <div className="grid grid-cols-2 gap-2.5">
        {people.map((p) => {
          const n = count(p.scope)
          return (
            <button key={p.key} disabled={!n} onClick={() => setOpen(p.key)} className="card flex flex-col items-start gap-2 text-left min-h-[132px] disabled:opacity-40">
              <Dot tag={p.tag} size={40} />
              <b className="font-semibold text-[16px] leading-tight">{p.name}</b>
              <span className="text-ink-2 text-[13px] leading-snug">{n ? `${n} piece${n === 1 ? '' : 's'}` : 'Nothing yet'}</span>
            </button>
          )
        })}
      </div>
      <p className="text-ink-2 text-[14px] text-center mt-2">Each person only sees their own list.</p>
    </Page>
  )
}
