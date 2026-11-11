import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { Dot } from '../../components/ui'
import { stickerNumber } from '../../lib/sticker'
import { TAG_ORDER, TAGS, type Tag } from '../../lib/types'

// Printable sticker sheets for mailed kits. Use round colour-coded labels (e.g. 1.5" dots, 24 per sheet)
// or print on plain label stock: the colour, the word and the number are all printed.
export default function StickerPrint() {
  const [tags, setTags] = useState<Tag[]>(TAG_ORDER.filter((t) => t !== 'keep'))
  const [count, setCount] = useState(24)
  const toggle = (t: Tag) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])

  return (
    <div className="bg-white min-h-full">
      <div className="no-print page pb-6">
        <Link to="/crew" className="back"><ChevronLeft size={18} /> Jobs</Link>
        <h1 className="mb-1">Sticker sheets</h1>
        <p className="lead mb-4">One colour per destination. Each sticker shows the word and a number. The first digit of the number is the destination, so crew mode can read it three ways.</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {TAG_ORDER.map((t) => (
            <label key={t} className="flex items-center gap-2 h-12 px-3 rounded-xl border border-line">
              <input type="checkbox" className="w-5 h-5" checked={tags.includes(t)} onChange={() => toggle(t)} />
              <Dot tag={t} /> <span className="font-medium">{TAGS[t].sticker}: {TAGS[t].name}</span>
            </label>
          ))}
        </div>
        <label className="block font-medium mb-1" htmlFor="per">Stickers per colour</label>
        <input id="per" className="input mb-4" type="number" min={6} max={200} value={count} onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
        <button className="btn" onClick={() => window.print()}><Printer size={18} /> Print</button>
      </div>

      {tags.map((t) => (
        <section key={t} className="px-4 pb-6" style={{ breakAfter: 'page' }}>
          <h2 className="no-print text-[17px] mb-2">{TAGS[t].sticker}: {TAGS[t].name}</h2>
          <div className="grid gap-[0.2in]" style={{ gridTemplateColumns: 'repeat(auto-fill, 1.5in)' }}>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="rounded-full flex flex-col items-center justify-center text-center" style={{ width: '1.5in', height: '1.5in', background: TAGS[t].hex, color: TAGS[t].fg, border: t === 'undecided' ? '2px solid #16181c' : undefined, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                <span className="font-bold tracking-wide" style={{ fontSize: t === 'undecided' ? '0.2in' : '0.24in' }}>{t === 'undecided' ? 'NOT SURE' : TAGS[t].name.toUpperCase()}</span>
                <span className="font-semibold tabular-nums" style={{ fontSize: '0.3in', lineHeight: 1 }}>{stickerNumber(t, i + 1)}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
