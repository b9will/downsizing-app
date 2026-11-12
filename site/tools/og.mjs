// Draws the share images (Open Graph cards) and the icons into ./static. Run by hand when the wording changes:
//   FONTS=/path/to/node_modules node tools/og.mjs     (needs Playwright; not part of the Vercel build)
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { SERVICES, AREAS, QUESTIONS } from '../content.mjs'
const { chromium } = createRequire(import.meta.url)('playwright')
const F = process.env.FONTS
const font = (pkg, file, family, w) => `@font-face{font-family:'${family}';font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(join(F, '@fontsource', pkg, 'files', file)).toString('base64')}) format('woff2')}`
const fonts = [font('space-grotesk', 'space-grotesk-latin-600-normal.woff2', 'SG', 600), font('space-grotesk', 'space-grotesk-latin-700-normal.woff2', 'SG', 700), font('inter', 'inter-latin-500-normal.woff2', 'IN', 500), font('inter', 'inter-latin-600-normal.woff2', 'IN', 600)].join('')
const C = { move: '#1d4ed8', keep: '#15803d', family: '#7e22ce', sell: '#ea580c', donate: '#facc15', junk: '#dc2626', store: '#111' }
const I = { move: 'M2 6h12v10H2z M14 9h4l4 4v3h-8 M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M16 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0', family: 'M6 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M14.5 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M15.5 14.5c2.6.2 4.5 2.3 4.5 5', sell: 'M3 12V4h8l9 9-8 8z M6 8.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0', donate: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z', junk: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6', keep: 'M3 11l9-7 9 7v9H3z M9 20v-6h6v6', store: 'M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8' }
const dot = (t, s) => `<span style="width:${s}px;height:${s}px;border-radius:50%;background:${C[t]};color:${t === 'donate' ? '#111' : '#fff'};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="${s * .48}" height="${s * .48}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${I[t]}"/></svg></span>`
const rows = [['Dining table', 'move', '#d9c7ad'], ['Dining chair, set of 6', 'move', '#cdb89a'], ['Sideboard', 'sell', '#b89674'], ['China cabinet', 'family', '#c9b8a6'], ['Floor lamp', 'donate', '#d8cfa9'], ['Area rug', 'junk', '#b9a9a0']]
const TRUCK = `data:image/png;base64,${readFileSync(join(import.meta.dirname, 'truck.png')).toString('base64')}`
// The truck sits behind the phone with its cab showing, so the card says "movers" at a glance.
const phone = (dark) => `<img src="${TRUCK}" alt="" style="position:absolute;left:716px;bottom:34px;width:500px;${dark ? 'opacity:.92' : ''}"><div style="position:absolute;right:150px;top:70px;width:300px;border-radius:44px;background:${dark ? '#fff' : '#111'};padding:10px;box-shadow:0 30px 70px rgba(0,0,0,.28);transform:rotate(4deg)"><div style="border-radius:35px;background:${dark ? '#111' : '#fff'};color:${dark ? '#fff' : '#111'};padding:26px 16px 22px;display:flex;flex-direction:column;gap:9px"><div style="font:600 21px SG;margin-bottom:4px">Where does it go?</div>${rows.map(([n, d, c]) => `<div style="display:flex;align-items:center;gap:10px;background:${dark ? '#262626' : '#f4f4f2'};border-radius:15px;padding:9px 11px;font:600 14px IN"><span style="width:38px;height:38px;border-radius:9px;background:${c}"></span><span style="flex:1">${n}</span>${dot(d, 26)}</div>`).join('')}</div></div>`
const card = ({ eyebrow, title, sub, dark = false, size = 76 }) => `<!doctype html><meta charset="utf-8"><style>${fonts}*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;overflow:hidden;background:${dark ? '#111' : '#fff'};color:${dark ? '#fff' : '#111'};font-family:IN;position:relative}</style>
<div style="position:absolute;left:72px;top:64px;right:500px;bottom:64px;display:flex;flex-direction:column">
<div style="display:flex;gap:12px">${['move', 'donate', 'sell', 'family', 'junk'].map((t) => dot(t, 52)).join('')}</div>
${eyebrow ? `<div style="font:600 20px IN;letter-spacing:.09em;text-transform:uppercase;color:${dark ? '#b5b5b5' : '#666'};margin-top:38px">${eyebrow}</div>` : '<div style="height:30px"></div>'}
<div style="font:600 ${size}px/1.04 SG;letter-spacing:-.03em;margin-top:${eyebrow ? 14 : 22}px">${title}</div>
${sub ? `<div style="font:500 27px/1.35 IN;color:${dark ? '#c4c4c4' : '#555'};margin-top:22px">${sub}</div>` : ''}
<div style="margin-top:auto;display:flex;align-items:center;gap:14px"><span style="width:34px;height:34px;border-radius:50%;background:#1d4ed8"></span><span style="font:700 30px SG;letter-spacing:-.02em">DOT</span><span style="font:500 20px IN;color:${dark ? '#b5b5b5' : '#666'}">Downsizing Operations Toronto</span><span style="margin-left:auto;font:600 19px IN;padding:11px 20px;border-radius:24px;background:${dark ? '#fff' : '#111'};color:${dark ? '#111' : '#fff'}">First room free</span></div></div>${phone(dark)}`
const fit = (t) => (t.length > 46 ? 50 : t.length > 34 ? 58 : t.length > 24 ? 66 : 76)
const cards = [
  ['default', { title: 'Put a dot on it.<br>We do the rest.', sub: 'Downsizing help in Toronto and the GTA. Scan your home, sort it from your sofa, and one crew handles the rest.' }],
  ['value', { title: 'See everything you own. Decide where it goes.', sub: 'A photo inventory of your home and a real price for the move, from your phone.', size: 64 }],
  ['price', { dark: true, title: 'Downsizing a home? See your price in ten minutes.', sub: 'Scan one room free. No card, no call, no obligation.', size: 64 }],
  ['plan-ahead', { eyebrow: 'Planning ahead', title: 'Do the thinking now. Move whenever.', sub: 'A photo inventory and a price on file, ready when you are.', size: 68 }],
  ['moving-soon', { dark: true, eyebrow: 'Moving soon', title: 'A date is set. Let us take it from here.', sub: 'Scan this week. One crew for packing, moving, donation and clear-out.', size: 66 }],
  ['how-it-works', { eyebrow: 'How it works', title: 'Scan. Dot. Done.', sub: 'From the first room scan to an empty home, in eight clear steps.' }],
  ['app', { eyebrow: 'The app', title: 'Your home, as a list.', sub: 'Opens in your phone browser. Nothing to install. First room free.' }],
  ['guides', { eyebrow: 'Guides', title: 'Plain answers about downsizing.', sub: 'Costs, timelines, donating, selling and clearing an estate home.', size: 66 }],
  ...SERVICES.map((s) => [`svc-${s.slug}`, { eyebrow: 'Service', title: s.name, sub: s.lead.length > 110 ? s.lead.slice(0, s.lead.lastIndexOf(' ', 108)) + '…' : s.lead, size: fit(s.name) }]),
  ...AREAS.map((a) => [`area-${a.slug}`, { eyebrow: a.name, title: `Downsizing help in ${a.name}`, sub: 'Scan your home, sort every item, and one crew does the rest.', size: fit(`Downsizing help in ${a.name}`) }]),
  ...QUESTIONS.map((q) => [`guide-${q.slug}`, { eyebrow: 'Guide', title: q.q, sub: q.short.length > 120 ? q.short.slice(0, q.short.lastIndexOf(' ', 118)) + '…' : q.short, size: Math.min(58, fit(q.q)) }]),
]
const out = join(import.meta.dirname, '..', 'static')
mkdirSync(join(out, 'og'), { recursive: true })
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
for (const [name, o] of cards) { await p.setContent(card(o)); await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: join(out, 'og', `${name}.png`) }) }
// Icons: the blue dot with the truck.
const icon = (s, r = '50%') => `<!doctype html><style>*{margin:0}body{width:${s}px;height:${s}px;background:transparent;display:flex;align-items:center;justify-content:center}</style><div style="width:${s}px;height:${s}px;border-radius:${r};background:#1d4ed8;display:flex;align-items:center;justify-content:center;color:#fff"><svg width="${s * .52}" height="${s * .52}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="${I.move}"/></svg></div>`
for (const [name, s, r] of [['favicon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180, '0']]) { await p.setViewportSize({ width: s, height: s }); await p.setContent(icon(s, r)); await p.screenshot({ path: join(out, name), omitBackground: true }) }
await b.close()
writeFileSync(join(out, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1d4ed8"/><g transform="translate(7.7 7.7) scale(.69)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${I.move}"/></g></svg>`)
console.log(`Drew ${cards.length} share images and the icons`)
