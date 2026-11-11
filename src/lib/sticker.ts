// Reading physical stickers. Three independent signals, best first:
//   1. the printed word (MOVE, DONATE…), read by OCR
//   2. the printed number, whose first digit is the destination (5014 = Donate, sticker 14)
//   3. the sticker colour, sampled live from the middle of the frame
import { TAG_ORDER, TAGS, type Tag } from './types'

/** First digit of a sticker number = destination. */
export const PREFIX: Record<Tag, number> = { move: 1, keep: 2, family: 3, sell: 4, donate: 5, junk: 6, store: 7, undecided: 8 }
export const stickerNumber = (tag: Tag, n: number) => `${PREFIX[tag]}${String(n).padStart(3, '0')}`
export const tagFromNumber = (s?: string): Tag | null => {
  const d = Number(s?.trim()[0]); return TAG_ORDER.find((t) => PREFIX[t] === d) ?? null
}

function hsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}

/** Nearest sticker colour, or null when the reading is unclear. */
export function classify(r: number, g: number, b: number): Tag | null {
  const { h, s, v } = hsv(r, g, b)
  if (v < 0.2) return 'store' // black
  if (s < 0.16 && v > 0.62) return 'undecided' // white
  if (s < 0.3) return null
  if (h < 12 || h >= 340) return 'junk' // red
  if (h < 38) return 'sell' // orange
  if (h < 68) return 'donate' // yellow
  if (h < 165) return 'keep' // green
  if (h < 250) return 'move' // blue
  return 'family' // purple
}

const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null

/** Sample the centre of the frame (where the on-screen ring is). */
export function readColour(src: HTMLVideoElement): { tag: Tag | null; rgb: [number, number, number] } {
  const w = src.videoWidth, h = src.videoHeight
  if (!canvas || !w || !h) return { tag: null, rgb: [0, 0, 0] }
  const side = Math.min(w, h) * 0.16
  canvas.width = 24; canvas.height = 24
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 24, 24)
  const px = ctx.getImageData(0, 0, 24, 24).data
  // Median of each channel resists glare and the printed text.
  const ch: number[][] = [[], [], []]
  for (let i = 0; i < px.length; i += 4) { ch[0].push(px[i]); ch[1].push(px[i + 1]); ch[2].push(px[i + 2]) }
  const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1]
  const rgb: [number, number, number] = [med(ch[0]), med(ch[1]), med(ch[2])]
  return { tag: classify(...rgb), rgb }
}

/** Crop the centre of a video frame for OCR. */
export function cropCentre(src: HTMLVideoElement, frac = 0.45): HTMLCanvasElement | null {
  const w = src.videoWidth, h = src.videoHeight
  if (!w || !h) return null
  const side = Math.min(w, h) * frac
  const c = document.createElement('canvas'); c.width = 480; c.height = 480
  const ctx = c.getContext('2d')!
  ctx.filter = 'grayscale(1) contrast(1.6)'
  ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 480, 480)
  return c
}

const WORDS: Array<[RegExp, Tag]> = [
  [/\bMOVE\b/, 'move'], [/\bKEEP\b/, 'keep'], [/\bFAMILY\b/, 'family'], [/\bSELL\b/, 'sell'],
  [/\bDONATE\b|\bGIVE\b/, 'donate'], [/\bJUNK\b|\bTOSS\b/, 'junk'], [/\bSTORE\b|\bSTORAGE\b/, 'store'], [/NOT ?SURE|\?/, 'undecided'],
]

type Worker = { recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }> }
let worker: Promise<Worker> | undefined

/** OCR the sticker. Loads the reader on first use (needs signal once). */
export async function readSticker(img: HTMLCanvasElement): Promise<{ word: Tag | null; number: string | null; text: string }> {
  worker ??= import('tesseract.js').then(async (T) => {
    const w = await T.createWorker('eng')
    await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789? ' })
    return w as unknown as Worker
  }).catch((e) => { worker = undefined; throw e })
  const { data } = await (await worker).recognize(img)
  const text = data.text.toUpperCase()
  const word = WORDS.find(([re]) => re.test(text))?.[1] ?? null
  const number = text.match(/\b([1-8]\d{3})\b/)?.[1] ?? null
  return { word, number, text }
}

export const colourName = (t: Tag) => TAGS[t].sticker
