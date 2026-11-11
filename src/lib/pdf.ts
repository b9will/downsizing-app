// Inventory PDF: a clean, printable record of the home with photos, grouped by room.
// Built on the phone, so nothing extra is sent anywhere.
import { itemsFor, scopeLabel, type Scope } from './export'
import { EMPTY_DETAILS, SIZES, TAGS, TAG_ORDER, itemLabel, type Item, type Job, type Room } from './types'

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
// The built-in PDF fonts only cover Latin-1; swap the few common extras and drop the rest.
const txt = (s: unknown) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/×/g, 'x').replace(/[^\x20-\x7E\xA0-\xFF]/g, '')

/** Small square JPEG for the page; null if the photo can't be read (offline, expired link). */
async function thumb(src: string | undefined, px = 320): Promise<string | null> {
  if (!src) return null
  try {
    const blob = src.startsWith('data:') ? await (await fetch(src)).blob() : await (await fetch(src, { mode: 'cors' })).blob()
    const bmp = await createImageBitmap(blob)
    const side = Math.min(bmp.width, bmp.height)
    const c = document.createElement('canvas'); c.width = c.height = px
    const g = c.getContext('2d')!
    g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, px, px)
    g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, px, px)
    return c.toDataURL('image/jpeg', 0.72)
  } catch { return null }
}

export async function buildPdf(job: Job, rooms: Room[], items: Item[], s: Scope = { kind: 'all' }): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 16
  const d = { ...EMPTY_DETAILS, ...job.details }
  const list = itemsFor(items, s)
  const count = (l: Item[]) => l.reduce((n, i) => n + (i.qty ?? 1), 0)
  const ink = () => doc.setTextColor(17, 17, 17), grey = () => doc.setTextColor(110, 110, 110)
  const dot = (x: number, y: number, r: number, tag: Item['tag']) => {
    doc.setFillColor(...rgb(TAGS[tag].hex)); doc.setDrawColor(17, 17, 17); doc.setLineWidth(0.25)
    doc.circle(x, y, r, tag === 'undecided' ? 'FD' : 'F')
  }
  let page = 1
  const footer = () => { doc.setFont('helvetica', 'normal').setFontSize(8); grey(); doc.text(txt(`${job.clientName} · Inventory · ${new Date().toLocaleDateString('en-CA')}`), M, H - 9); doc.text(`Page ${page}`, W - M, H - 9, { align: 'right' }) }

  // Cover block
  ink(); doc.setFont('helvetica', 'bold').setFontSize(26); doc.text(s.kind === 'all' ? 'Home inventory' : txt(`${scopeLabel(s)} list`), M, 26)
  doc.setFont('helvetica', 'normal').setFontSize(11); grey()
  let y = 34
  for (const line of [job.clientName, d.currentAddress, d.moveDate ? `Move date: ${d.moveDate}` : '', `Prepared ${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })} by Dot`].filter(Boolean)) { doc.text(txt(line), M, y); y += 5.5 }
  y += 3
  // Totals by destination
  const tags = TAG_ORDER.filter((t) => list.some((i) => i.tag === t))
  let x = M
  doc.setFontSize(10)
  for (const t of tags) {
    const label = `${TAGS[t].name}  ${count(list.filter((i) => i.tag === t))}`
    const w = doc.getTextWidth(label) + 9
    if (x + w > W - M) { x = M; y += 8 }
    dot(x + 2.2, y - 1.3, 2.2, t); ink(); doc.setFont('helvetica', 'bold'); doc.text(label, x + 6, y); x += w + 5
  }
  y += 6
  grey(); doc.setFont('helvetica', 'normal'); doc.text(`${count(list)} pieces in ${list.length} entries`, M, y); y += 5
  doc.setDrawColor(225, 225, 222); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 8

  const ROW = 27, PH = 22
  const order = (i: Item) => TAG_ORDER.indexOf(i.tag)
  const groups = rooms.map((r) => ({ name: r.name, items: list.filter((i) => i.roomId === r.id).sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name)) })).filter((g) => g.items.length)
  const orphans = list.filter((i) => !rooms.some((r) => r.id === i.roomId))
  if (orphans.length) groups.push({ name: 'Other', items: orphans })
  const newPage = () => { footer(); doc.addPage(); page++; y = M + 4 }

  for (const g of groups) {
    if (y + 12 + ROW > H - 16) newPage()
    ink(); doc.setFont('helvetica', 'bold').setFontSize(14); doc.text(txt(g.name), M, y)
    grey(); doc.setFont('helvetica', 'normal').setFontSize(10); doc.text(`${count(g.items)} piece${count(g.items) === 1 ? '' : 's'}`, W - M, y, { align: 'right' })
    y += 5
    const thumbs = await Promise.all(g.items.map((i) => thumb(i.photo)))
    for (let n = 0; n < g.items.length; n++) {
      const i = g.items[n]
      if (y + ROW > H - 16) newPage()
      doc.setFillColor(244, 244, 242); doc.roundedRect(M, y, PH, PH, 2.5, 2.5, 'F')
      if (thumbs[n]) { try { doc.addImage(thumbs[n]!, 'JPEG', M, y, PH, PH) } catch { /* skip a bad photo */ } }
      const tx = M + PH + 5, tw = W - M - tx - 34
      ink(); doc.setFont('helvetica', 'bold').setFontSize(11.5)
      doc.text(doc.splitTextToSize(txt(itemLabel(i)), tw)[0], tx, y + 5)
      grey(); doc.setFont('helvetica', 'normal').setFontSize(9.5)
      const meta = [i.description, SIZES[i.size].split(' (')[0], i.sticker ? `Sticker #${i.sticker}` : ''].filter(Boolean).join('  ·  ')
      const extra = [i.tag === 'family' && i.familyRecipient ? `For ${i.familyRecipient}` : '', i.contents && i.contents !== 'none' ? `Contents: ${{ donate: 'donate', junk: 'dispose', leave: 'leave inside', family: 'to family', sort: 'to be sorted' }[i.contents]}` : '', i.prep ? `Before move day: ${i.prep}` : '', i.note ?? ''].filter(Boolean).join('  ·  ')
      const lines = [...doc.splitTextToSize(txt(meta), tw).slice(0, 1), ...doc.splitTextToSize(txt(extra), tw).slice(0, 2)]
      doc.text(lines, tx, y + 10.5, { lineHeightFactor: 1.3 })
      // Destination
      dot(W - M - 28, y + 4, 2.4, i.tag); ink(); doc.setFont('helvetica', 'bold').setFontSize(10); doc.text(TAGS[i.tag].name, W - M - 24, y + 5.2)
      if (i.status && i.status !== 'tagged') { grey(); doc.setFont('helvetica', 'normal').setFontSize(9); doc.text(txt(i.status[0].toUpperCase() + i.status.slice(1)), W - M - 24, y + 10.5) }
      y += ROW
    }
    y += 5
  }
  if (!list.length) { grey(); doc.setFontSize(11); doc.text('Nothing on this list yet.', M, y) }
  footer()
  return doc.output('blob')
}

/** Share on phones (opens the share sheet: save to Files, print, email), download elsewhere. */
export async function exportPdf(job: Job, rooms: Room[], items: Item[], s: Scope = { kind: 'all' }) {
  const blob = await buildPdf(job, rooms, items, s)
  const slug = (t: string) => t.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  const name = `${slug(job.clientName) || 'home'}-${s.kind === 'all' ? 'inventory' : slug(scopeLabel(s))}-${new Date().toISOString().slice(0, 10)}.pdf`
  const file = new File([blob], name, { type: 'application/pdf' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Home inventory' }); return } catch (e) { if ((e as Error).name === 'AbortError') return }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
