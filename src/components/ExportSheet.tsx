import { useState } from 'react'
import { FileSpreadsheet, FileText, Link2 } from 'lucide-react'
import { Sheet, TagPill } from './ui'
import { exportCsv, itemsFor, recipientOf, scopeLabel, type Scope } from '../lib/export'
import { makePdf, openPdf, sharePdf } from '../lib/pdf'
import { PdfReady } from './ui'
import { store } from '../lib/store'
import { type Item, type Job, type Room, type Tag } from '../lib/types'

const ORDER: Tag[] = ['donate', 'sell', 'store', 'junk', 'move', 'family', 'keep', 'undecided']
const WHO: Record<Tag, string> = {
  donate: 'For the charity', sell: 'For the consignment house', store: 'For the storage facility', junk: 'For the hauler',
  move: 'For the crew', family: 'All family items', keep: 'Stays in the home', undecided: 'Still to decide',
}

/** Export picker: everything, or one list for one audience. */
export function ExportSheet({ open, onOpenChange, job, rooms, items }: { open: boolean; onOpenChange: (o: boolean) => void; job: Job; rooms: Room[]; items: Item[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const recipients = [...new Set(items.filter((i) => i.tag === 'family').map(recipientOf))].sort()

  const [note, setNote] = useState('')

  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const go = async (s: Scope, key: string) => {
    setBusy(key)
    try { await exportCsv(job, rooms, items, s) } finally { setBusy(null) }
  }
  const pdf = async (s: Scope, key: string) => {
    setBusy(`pdf-${key}`); setNote('')
    try { setPdfFile(await makePdf(job, rooms, items, s)) } catch (e) { console.error('pdf', e); setNote('Could not make the PDF. Please try again.') } finally { setBusy(null) }
  }
  /** A no-login web page for the charity, consignment house or relative. Always up to date. */
  const link = async (s: Scope, key: string, label: string) => {
    setBusy(`link-${key}`); setNote('')
    try {
      const url = await store.guestLink(s, label)
      const text = `${label}: ${scopeLabel(s)} items from ${job.clientName}. ${url}`
      if (navigator.share) { try { await navigator.share({ title: `${scopeLabel(s)} list`, text, url }); return } catch { /* cancelled */ } }
      await navigator.clipboard?.writeText(url); setNote('Link copied. It works for 30 days.')
    } catch { setNote('Could not make a link. Check your connection.') } finally { setBusy(null) }
  }

  const Row = ({ s, k, label, sub, pill }: { s: Scope; k: string; label: string; sub?: string; pill?: Tag }) => {
    const n = itemsFor(items, s).length
    return (
      <div className={`flex items-center gap-2 w-full py-2 border-t border-line first:border-t-0 ${!n ? 'opacity-40' : ''}`}>
        {pill ? <TagPill tag={pill} small /> : <FileSpreadsheet size={18} className="text-ink-3" />}
        <span className="flex-1 min-w-0"><span className="block font-medium text-[16px]">{label}</span><span className="block text-ink-2 text-[14px]">{sub ? `${sub} · ` : ''}{n} item{n === 1 ? '' : 's'}</span></span>
        {k !== 'all' && <button type="button" disabled={!n || busy !== null} onClick={() => link(s, k, label)} className="btn btn-secondary btn-sm h-11 px-3" aria-label={`Send a link: ${label}`}><Link2 size={16} />{busy === `link-${k}` ? '…' : 'Link'}</button>}
        <button type="button" disabled={!n || busy !== null} onClick={() => pdf(s, k)} className="btn btn-secondary btn-sm h-11 px-3" aria-label={`Download PDF: ${label}`}><FileText size={16} />{busy === `pdf-${k}` ? '…' : 'PDF'}</button>
        <button type="button" disabled={!n || busy !== null} onClick={() => go(s, k)} className="btn btn-secondary btn-sm h-11 px-3" aria-label={`Download spreadsheet: ${label}`}><FileSpreadsheet size={16} />{busy === k ? '…' : 'CSV'}</button>
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <h2 className="mb-1">Export a list</h2>
      <p className="text-ink-2 text-[15px] mb-3"><b className="text-ink">Link</b> sends a web page with photos that stays up to date, no login needed. <b className="text-ink">PDF</b> is a printable record with photos. <b className="text-ink">CSV</b> is a spreadsheet.</p>
      <button type="button" className="btn mb-3" disabled={!items.length || busy !== null} onClick={() => pdf({ kind: 'all' }, 'top')}><FileText size={20} />{busy === 'pdf-top' ? 'Making your PDF…' : 'Inventory PDF with photos'}</button>
      {pdfFile && <div className="mb-3"><PdfReady file={pdfFile} onShare={async () => { if (!(await sharePdf(pdfFile))) openPdf(pdfFile) }} onOpen={() => openPdf(pdfFile)} onClose={() => setPdfFile(null)} /></div>}
      {note && <p role="status" className="text-accent font-medium text-[15px] mb-2">{note}</p>}
      <Row s={{ kind: 'all' }} k="all" label="Everything" sub="Full inventory with all details, for our team" />
      {ORDER.filter((t) => t !== 'family').map((t) => <Row key={t} s={{ kind: 'tag', tag: t }} k={t} label={WHO[t]} pill={t} />)}
      {recipients.length > 0 && <div className="eyebrow mt-4 mb-1">Family, one list each</div>}
      {recipients.map((r) => <Row key={r} s={{ kind: 'family', recipient: r }} k={`fam-${r}`} label={r} sub="Their items, with the pickup address" pill="family" />)}
    </Sheet>
  )
}
