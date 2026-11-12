// Static site generator for the DOT marketing site. No dependencies: `node build.mjs` writes ./dist.
import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { BRAND, APP, SERVICES, AREAS, QUESTIONS, FAQ, PHOTOS } from './content.mjs'

const host = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
const SUPA = 'https://mcsnkmfyqvzpdfeffvzi.supabase.co', SUPA_KEY = 'sb_publishable_O3PwqAH5DKN86WcHIuTnNw_4apN1vU9'
const out = join(import.meta.dirname, 'dist')
rmSync(out, { recursive: true, force: true })
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const pages = []
// The same pictograms the app uses, so a colour always comes with a picture of what it means.
const ICON = {
  move: 'M2 6h12v10H2z M14 9h4l4 4v3h-8 M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M16 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  keep: 'M3 11l9-7 9 7v9H3z M9 20v-6h6v6',
  family: 'M6 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M14.5 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M15.5 14.5c2.6.2 4.5 2.3 4.5 5',
  sell: 'M3 12V4h8l9 9-8 8z M6 8.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
  donate: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  junk: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  store: 'M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8',
  undecided: 'M9 9a3 3 0 1 1 4.2 2.8c-.7.3-1.2 1-1.2 1.8V15 M12 18.5v.5',
}
const withIcons = (html) => html.replace(/<span class="dot (\w+)"><\/span>/g, (m, t) => ICON[t] ? `<span class="dot ${t}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[t]}"/></svg></span>` : m)
// Every button to the app carries the page it came from, so we can see which pages bring people in.
const scan = (src, label = 'Scan a room free', cls = '') => `<a class="btn go ${cls}" href="${APP}/login?src=${encodeURIComponent(src)}">${label}</a>`
const dots = (list = ['move', 'donate', 'sell', 'family']) => `<div class="dots" aria-hidden="true">${list.map((d) => `<span class="dot ${d}"></span>`).join('')}</div>`
const U = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`
/** A stock photo by key. `eager` for the one at the top of a page. */
const pic = (key, cls = '', eager = false) => { const [id, alt] = PHOTOS[key]; return `<div class="photo ${cls}"><img src="${U(id, 1000)}" srcset="${U(id, 600)} 600w, ${U(id, 1000)} 1000w, ${U(id, 1600)} 1600w" sizes="(min-width:900px) 560px, 100vw" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>` }
const photo = (list) => `<div class="photo" aria-hidden="true"><div class="ph-dots">${list.map((d) => `<span class="dot ${d}"></span>`).join('')}</div></div>`
const phone = `<div class="phone" role="img" aria-label="The DOT app showing a dining room list with a coloured dot on each item"><div class="screen">
<p class="eyebrow">Dining room · 9 items</p><p class="d" style="font-size:24px;margin-bottom:4px">Where does it go?</p>
${[['Dining table', 'Oak, seats six', 'move', '#d9c7ad'], ['Dining chair, set of 6', 'Spindle back', 'move', '#cdb89a'], ['Sideboard', 'Walnut, brass pulls', 'sell', '#b89674'], ['China cabinet', 'Glass doors', 'family', '#c9b8a6'], ['Tea set', 'For Sarah', 'family', '#e3dccf'], ['Floor lamp', 'Brass', 'donate', '#d8cfa9'], ['Area rug', 'Worn', 'junk', '#b9a9a0']].map(([n, s, d, c]) => `<div class="row"><span class="ph" style="background:${c}"></span><span class="t">${n}<small>${s}</small></span><span class="dot ${d}"></span></div>`).join('')}
<div class="bar">Book my move</div></div></div>`
const band = (src, h = 'See your own price in ten minutes.', p = 'Scan one room free. No card, no call, no obligation.') => `<section class="tight"><div class="wrap"><div class="band"><div><h2>${h}</h2><p class="lead" style="margin-top:10px">${p}</p></div>${scan(src)}</div></div></section>`
const faqBlock = (items) => items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')
const faqLd = (items) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })
const org = { '@context': 'https://schema.org', '@type': 'ProfessionalService', '@id': `${host}/#org`, name: `${BRAND.short}: ${BRAND.long}`, alternateName: [BRAND.short, BRAND.long], slogan: BRAND.tagline, url: host, logo: `${host}/icon-512.png`, image: `${host}/og/default.png`, priceRange: '$$', knowsAbout: ['Downsizing', 'Senior move management', 'Estate clear-outs', 'Home inventory', 'Furniture donation', 'Consignment'], hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Downsizing services', itemListElement: SERVICES.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, url: `${host}/services/${s.slug}` } })) }, description: 'Downsizing, senior move management and estate clear-outs in Toronto and the GTA, planned from a photo inventory of the home.', areaServed: AREAS.map((a) => ({ '@type': 'City', name: `${a.name}, Ontario` })) }
const how = [['Scan', 'Turn slowly in each room with your phone. The app lists what it sees, with a photo of each thing.', 'undecided'], ['Dot', 'Put a coloured dot on everything: move, family, sell, donate, store or dispose. Family can join in.', 'family'], ['Done', 'One crew carries out the whole list, and you get photos as each part is finished.', 'move']]
const howCards = `<div class="grid3">${how.map(([t, p], i) => `<div class="card"><span class="step">${i + 1}</span><h3>${t}</h3><p>${p}</p></div>`).join('')}</div>`
const serviceCards = (src) => `<div class="grid3">${SERVICES.map((s) => `<a class="card img" href="/services/${s.slug}">${pic(s.photo)}<div class="in"><h3><span class="dot ${s.dot}"></span> ${s.name}</h3><p>${esc(s.lead)}</p></div></a>`).join('')}</div>`
const areaChips = `<div class="chips">${AREAS.map((a) => `<a href="/areas/${a.slug}">${a.name}</a>`).join('')}</div>`

const site = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${host}/#site`, url: host, name: `${BRAND.short}: ${BRAND.long}`, inLanguage: 'en-CA', publisher: { '@id': `${host}/#org` } }
const today = new Date().toISOString().slice(0, 10)
const audit = []
function page(path, { title, desc, body, ld = [], src, og = 'default', crumbs = [], type = 'website', noindex = false }) {
  const url = host + (path === '/' ? '/' : path)
  // Keep titles readable in search results: use the longest brand suffix that fits.
  const base = title.split(' | ')[0]
  title = [` | ${BRAND.short}, ${BRAND.long}`, ` | ${BRAND.short} Toronto`, ` | ${BRAND.short}`].map((s) => base + s).find((t) => t.length <= 65) ?? base
  const image = `${host}/og/${existsSync(join(import.meta.dirname, 'static', 'og', `${og}.png`)) ? og : 'default'}.png`
  if (title.length > 65 || desc.length > 160 || desc.length < 70) audit.push(`${path}: title ${title.length}, description ${desc.length}`)
  // Breadcrumbs tell search engines where a page sits: Home > Services > Estate clear-outs.
  if (crumbs.length) ld = [...ld, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Home', '/'], ...crumbs].map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: host + p })) }]
  ld = [...ld, { '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${url}#page`, url, name: title, description: desc, inLanguage: 'en-CA', isPartOf: { '@id': `${host}/#site` }, about: { '@id': `${host}/#org` }, primaryImageOfPage: image, dateModified: today }]
  const html = `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
<meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title.split(' | ')[0])}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="${BRAND.short}: ${BRAND.long}"><meta property="og:locale" content="en_CA">
<meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(title.split(' | ')[0])}. ${BRAND.short}, ${BRAND.long}.">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title.split(' | ')[0])}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}">
<meta name="geo.region" content="CA-ON"><meta name="geo.placename" content="Toronto">
<meta name="theme-color" content="#111111">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/styles.css">
${[org, site, ...ld].map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<header class="top"><div class="wrap">
<a class="logo" href="/" aria-label="${BRAND.short}, ${BRAND.long}: home"><span class="dot move"></span>${BRAND.short}<small>Downsizing<br>Operations Toronto</small></a>
<nav class="main" aria-label="Main"><a href="/how-it-works">How it works</a><a href="/services">Services</a><a href="/pricing">Pricing</a><a href="/guides">Guides</a><a href="/contact">Contact</a></nav>
${scan(src, 'Scan a room free', 'sm')}
<details class="menu"><summary aria-label="Menu"><span></span></summary><nav aria-label="Menu"><a href="/how-it-works">How it works</a><a href="/plan-ahead">Planning ahead</a><a href="/moving-soon">Moving soon</a><a href="/services">Services</a><a href="/pricing">Pricing</a><a href="/guides">Guides</a><a href="/faq">Questions</a><a href="/contact">Talk to a person</a></nav></details>
</div></header>
<main>${body}</main>
<footer><div class="wrap"><div class="cols">
<div><a class="logo" href="/"><span class="dot move"></span>${BRAND.short}</a><p class="muted" style="margin-top:10px;max-width:300px">${BRAND.long}. ${BRAND.tagline}</p><p class="muted small" style="margin-top:14px">Serving Toronto and the GTA.</p></div>
<div><h4>Services</h4><ul>${SERVICES.map((s) => `<li><a href="/services/${s.slug}">${s.name}</a></li>`).join('')}</ul></div>
<div><h4>Areas</h4><ul>${AREAS.map((a) => `<li><a href="/areas/${a.slug}">${a.name}</a></li>`).join('')}</ul></div>
<div><h4>Company</h4><ul><li><a href="/how-it-works">How it works</a></li><li><a href="/plan-ahead">Planning ahead</a></li><li><a href="/moving-soon">Moving soon</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/app">The app</a></li><li><a href="/guides">Guides</a></li><li><a href="/faq">Questions</a></li><li><a href="/contact">Contact</a></li></ul></div>
</div><p class="muted small" style="margin-top:36px">© ${new Date().getFullYear()} ${BRAND.long}. Prices shown are guides; your scan gives you your own. Photos are stock images from Unsplash, not our clients.</p></div></footer>
<div class="sticky-cta">${scan(src)}</div>
<script>(()=>{const s=document.querySelector('.sticky-cta'),end=document.querySelector('.band')||document.querySelector('footer');let near=false;if(end&&'IntersectionObserver'in window)new IntersectionObserver(e=>{near=e[0].isIntersecting;f()}).observe(end);const f=()=>document.body.classList.toggle('show-cta',scrollY>620&&!near);addEventListener('scroll',f,{passive:true});f()})()</script>
<script src="/chat.js" defer></script>
<script defer src="/_vercel/insights/script.js"></script>
</body></html>`
  const file = join(out, path === '/' ? 'index.html' : `${path.slice(1)}.html`)
  mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, withIcons(html)); pages.push(path)
}

// ---------- Home
const paths = `<div class="grid2">
<a class="path" href="/plan-ahead">${pic('ahead')}<div class="in"><p class="eyebrow">Planning ahead</p><h3>Not moving yet? Get it in order while it is easy.</h3><p>Scan at your own pace. Keep a photo record of the home, note who each thing is for, and have a price on file. When the day comes, the thinking is already done.</p><span class="link">Start my inventory</span></div></a>
<a class="path" href="/moving-soon">${pic('soon')}<div class="in"><p class="eyebrow">Moving soon</p><h3>Date set? House sold? We are ready when you are.</h3><p>Scan this week, see a price in minutes, and book one crew for the packing, the move, the donations and the clear-out.</p><span class="link">Get my price</span></div></a></div>`
page('/', { src: 'home', og: 'default', title: `Downsizing help in Toronto | ${BRAND.short}, ${BRAND.long}`,
  desc: 'Downsizing, senior moves and estate clear-outs in Toronto and the GTA. Scan your home, put a dot on everything, and one crew does the rest. First room free.',
  ld: [faqLd(FAQ.slice(0, 5))],
  body: `<section class="hero"><div class="wrap"><div class="grid"><div>${dots(['move', 'donate', 'sell', 'family', 'junk'])}
<h1>Put a dot on it.<br>We do the rest.</h1>
<p class="lead" style="margin-top:20px">A lifetime of things, sorted from your sofa. See everything you own in one list, decide where each piece belongs, and hand the heavy part to one Toronto crew.</p>
<div class="cta">${scan('home-hero')}<a class="btn alt" href="/how-it-works">How it works</a></div>
<p class="muted small" style="margin-top:14px">First room free. No card. Nothing to install.</p></div>
<div class="hero-art">${pic('hero', 'tall', true)}<div class="float">${phone}</div></div></div></div></section>
<section class="tight"><div class="wrap"><p class="quote">The hard part of downsizing is not the truck. It is the hundreds of small decisions that come before it.</p></div></section>
<section class="soft"><div class="wrap"><div class="head"><p class="eyebrow">Two ways in</p><h2>Whether it is next month or some day.</h2></div>${paths}</div></section>
<section><div class="wrap"><div class="head"><p class="eyebrow">What you get</p><h2>Clarity first. Muscle second.</h2></div>
<div class="grid3">${[['Know what you have', 'Turn slowly in each room and the app builds the list: every piece, with a photo. Most people have never seen their home written down.', 'undecided'], ['Decide once, together', 'One shared list replaces the sticky notes and the group chat. Family sees it from anywhere and says what they would love to have. You have the last word.', 'family'], ['Hand over the rest', 'One crew packs, moves, donates, sells and clears, working from your list. You get one flat price before anything is booked.', 'move']].map(([t, p, d]) => `<div class="card"><span class="dot ${d}"></span><h3>${t}</h3><p>${p}</p></div>`).join('')}</div></div></section>
<section class="soft"><div class="wrap"><div class="grid2" style="align-items:center;gap:44px">${pic('plants')}<div><div class="head" style="margin-bottom:24px"><p class="eyebrow">How it works</p><h2>Three steps. The first takes ten minutes.</h2></div>
<ol class="steps">${how.map(([t, p]) => `<li><h3>${t}</h3><p>${p}</p></li>`).join('')}</ol><p style="margin-top:22px"><a href="/how-it-works">See every step</a></p></div></div></div></section>
<section><div class="wrap"><div class="head"><p class="eyebrow">Every thing gets a dot</p><h2>Eight colours. No arguments.</h2><p class="lead">Each colour is a destination. The crew works from the same list you made, so nothing meaningful ends up in the wrong pile.</p></div>
<div class="grid4">${[['move', 'Move', 'Coming to the new home'], ['family', 'Family', 'Going to someone you name'], ['sell', 'Sell', 'Consignment or auction'], ['donate', 'Donate', 'To a charity that wants it'], ['store', 'Store', 'Into a storage unit'], ['junk', 'Dispose', 'Recycled or taken away'], ['keep', 'Keep', 'Staying in the home'], ['undecided', 'Not sure', 'Decide later']].map(([d, t, p]) => `<div class="card"><span class="dot ${d}"></span><h3>${t}</h3><p>${p}</p></div>`).join('')}</div></div></section>
<section class="soft"><div class="wrap"><div class="head"><p class="eyebrow">Services</p><h2>Whatever is behind the move.</h2></div>${serviceCards('home')}</div></section>
<section><div class="wrap"><div class="grid2" style="align-items:center;gap:44px"><div class="head" style="margin:0"><p class="eyebrow">Yours to keep</p><h2>Useful even if you never book us.</h2><p class="lead">The inventory and the price are yours. Keep them on file, share them with family, take them to another mover. If you do book with us, what you paid for the app comes off the job.</p><div class="cta" style="margin-top:8px">${scan('home-value')}<a class="btn alt" href="/pricing">See pricing</a></div></div>
<ul class="check">${['A photo inventory of every room, as a PDF', 'A price range built from your own list', 'Lists to send to family, charities and dealers', 'A helper can do the scanning for you', 'An assistant for quick answers, a person for everything else'].map((t) => `<li>${t}</li>`).join('')}</ul></div></div></section>
<section class="soft"><div class="wrap"><div class="head"><p class="eyebrow">Where we work</p><h2>Toronto and the GTA.</h2></div>${areaChips}</div></section>
<section><div class="wrap narrow"><div class="head"><p class="eyebrow">Questions</p><h2>Good things to ask.</h2></div>${faqBlock(FAQ.slice(0, 5))}<p style="margin-top:20px"><a href="/faq">All questions</a></p></div></section>
${band('home-band')}` })

// ---------- Audience pages: planning ahead, moving soon
const audience = (path, o) => page(path, { src: o.src, og: o.src, crumbs: [[o.eyebrow, path]], title: `${o.title} | ${BRAND.short}, ${BRAND.long}`, desc: o.desc,
  body: `<section class="hero"><div class="wrap"><div class="grid"><div><p class="eyebrow" style="margin-bottom:14px">${o.eyebrow}</p><h1 style="font-size:clamp(38px,5.6vw,64px)">${o.h1}</h1><p class="lead" style="margin-top:18px">${o.lead}</p><div class="cta">${scan(`${o.src}-hero`, o.cta)}<a class="btn alt" href="/pricing">See pricing</a></div><p class="muted small" style="margin-top:14px">First room free. No card.</p></div>${pic(o.photo, 'tall', true)}</div></div></section>
<section class="soft"><div class="wrap"><div class="head"><h2>${o.whyH}</h2></div><div class="grid3">${o.why.map(([t, p, d]) => `<div class="card"><span class="dot ${d}"></span><h3>${t}</h3><p>${p}</p></div>`).join('')}</div></div></section>
<section><div class="wrap"><div class="grid2" style="align-items:center;gap:44px">${pic(o.photo2)}<div><div class="head" style="margin-bottom:22px"><h2>${o.stepsH}</h2></div><ol class="steps">${o.steps.map(([t, p]) => `<li><h3>${t}</h3><p>${p}</p></li>`).join('')}</ol></div></div></div></section>
<section class="soft"><div class="wrap narrow"><div class="head"><h2>Questions</h2></div>${faqBlock(o.faq)}</div></section>
${band(`${o.src}-band`, o.bandH, o.bandP)}` })
audience('/plan-ahead', { src: 'plan-ahead', photo: 'ahead', photo2: 'shelves', eyebrow: 'Planning ahead', cta: 'Start my inventory',
  title: 'Plan your downsizing before you need to', desc: 'Not moving yet? Make a photo inventory of your home, note who each thing is for, and keep a price on file. Ready whenever you are. First room free.',
  h1: 'Do the thinking now.<br>Move whenever.', lead: 'You are not going anywhere yet. That is exactly why this is the easy time to do it: no deadline, no boxes, just a clear record of your home and what you want to happen to it.',
  whyH: 'Why people do this years early',
  why: [['It is your decision, on your terms', 'Choose what matters and who it is for while it is entirely your call, not something family has to guess at later.', 'family'], ['A record you will be glad to have', 'A photo inventory of the whole home is useful for insurance, for an estate plan, and for your own peace of mind.', 'store'], ['No scramble when the time comes', 'When the house sells or a suite comes up, the list and the price are already on file. Booking takes minutes.', 'move']],
  stepsH: 'An afternoon now, and it keeps', steps: [['Scan a room or two', 'Start with the easy rooms. Turn slowly, and the list builds itself.'], ['Mark what matters', 'Note the pieces that are staying with you and the ones meant for someone in particular.'], ['Keep it on file', 'Your inventory and price stay in your account. Update them whenever something changes.'], ['Book when you are ready', 'Next season or in five years. Everything you decided is waiting.']],
  faq: [['Do I have to book a move?', 'No. Many people only want the inventory. If you book later, what you paid for the app comes off the job.'], ['How long is my inventory kept?', 'For as long as you keep your Home pass, or the lower-cost plan for keeping an inventory on file. You can save it as a PDF at any time.'], ['Can my children see it?', 'Only if you invite them. You choose who sees the list and you make every decision.'], ['What if things change?', 'Open the app and change any dot. Your price updates with it.']],
  bandH: 'Start with one room this afternoon.', bandP: 'Free, and there is nothing to install.' })
audience('/moving-soon', { src: 'moving-soon', photo: 'soon', photo2: 'boxes', eyebrow: 'Moving soon', cta: 'Get my price',
  title: 'Downsizing on a deadline in Toronto', desc: 'House sold or move-in date set? Scan your home this week, see a flat price range in minutes, and book one crew for packing, moving, donation and clear-out.',
  h1: 'A date is set.<br>Let us take it from here.', lead: 'The house has sold, the suite is ready, or the estate needs settling. You do not have months. Scan the home this week and one crew handles the packing, the move, the donations and the empty house.',
  whyH: 'Built for a tight timeline',
  why: [['A price today, not next week', 'No waiting for someone to visit and quote. Your price range comes from your own scan, usually the same day.', 'sell'], ['Someone else can scan', 'Send a neighbour, a relative or a helper an invite. They scan, you decide, from wherever you are.', 'family'], ['One crew for all of it', 'Packing, moving, donation, consignment and disposal on one plan, so you are not coordinating five companies.', 'move']],
  stepsH: 'From today to an empty house', steps: [['Today: scan', 'Each room takes a few minutes. The first one is free.'], ['This week: decide', 'Put a dot on everything. Family can weigh in from anywhere.'], ['Book your date', 'Approve a flat price. A person calls you to go over the plan.'], ['Move day', 'The crew works from your list and sends photos as each part is done.']],
  faq: [['How fast can you start?', 'Tell us your date on the contact form or in the app and a person will confirm what is possible.'], ['I live out of town. Can this work?', 'Yes. A helper can scan the home, and you can sort the list and approve the plan from anywhere.'], ['What if I cannot decide on everything in time?', 'Anything undecided can go to storage, so the house is still empty on time.'], FAQ[2]],
  bandH: 'See your price before the day is out.', bandP: 'Scan one room free. No card, no call, no obligation.' })

// ---------- How it works
page('/how-it-works', { src: 'how', og: 'how-it-works', crumbs: [['How it works', '/how-it-works']], title: `How it works | ${BRAND.short}, ${BRAND.long}`, desc: 'How a DOT downsizing move works, from the first room scan to an empty home: scan, sort, price, book, move day and after.',
  ld: [{ '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to downsize a home with DOT', step: how.map(([t, p], i) => ({ '@type': 'HowToStep', position: i + 1, name: t, text: p })) }],
  body: `<section class="hero"><div class="wrap"><div class="grid"><div>${dots()}<h1>How it works</h1><p class="lead" style="margin-top:18px">From the first scan to an empty home. You do the deciding. We do everything else.</p><div class="cta">${scan('how-hero')}</div></div>${pic('living', 'tall', true)}</div></div></section>
<section class="soft"><div class="wrap"><div class="grid2">${[['Scan the rooms', 'Stand in the middle of a room and turn slowly with your phone. The app lists the furniture, appliances, art and boxes it sees. You check the list. A helper can do this part for you.'], ['Put a dot on everything', 'Move, family, sell, donate, store or dispose. Matching sets, like six dining chairs, get one decision. Anything you are unsure about waits in a "not sure" pile.'], ['Bring in family', 'Share the list. Relatives see photos of everything and mark what they would like. You make the final call on each item.'], ['See your price', 'The app builds a price range from your list: crew, truck, hours, donation and disposal runs. No visit needed to get a number.'], ['Book a date', 'Pick your move date and pay a small deposit to hold it. A person calls you within one business day to go over the plan.'], ['Approve the plan', 'We confirm the crew, the truck, the charity and consignment pickups, and a flat price. Nothing happens until you approve it.'], ['Move day', 'The crew lead works from your list on a tablet. Each stop is checked off with photos: loaded, donated, delivered.'], ['After', 'A walkthrough, a final invoice with any sale proceeds credited, and a call a couple of days later to make sure you are settled.']].map(([t, p], i) => `<div class="card"><span class="step">${i + 1}</span><h3>${t}</h3><p>${p}</p></div>`).join('')}</div></div></section>
${band('how-band')}` })

// ---------- Pricing
const plans = [
  { n: 'Free scan', p: '$0', s: '', d: 'Try it on one room.', f: ['One room of your choice', 'Item list with photos', 'A rough price range for the move'], cta: scan('pricing-free', 'Scan a room free') },
  { n: 'Home pass', p: '$29', s: ' a month', d: 'The whole home, on your own schedule.', f: ['Every room, as many scans as you need', 'Invite family and a helper', 'Lists for charities, dealers and storage', 'Photo inventory PDF', 'Credited to your move if you book with us'], cta: scan('pricing-pass', 'Start with a free room'), hi: true },
  { n: 'Booked move', p: 'Flat price', s: '', d: 'One crew does all of it.', f: ['Packing, moving and placement', 'Donation, consignment and disposal runs', 'Confirmed before you approve', '$100 deposit holds your date', 'Sale proceeds credited back to you'], cta: `<a class="btn" href="/contact">Talk to a person</a>` },
]
page('/pricing', { src: 'pricing', og: 'price', crumbs: [['Pricing', '/pricing']], title: `Pricing | ${BRAND.short}, ${BRAND.long}`, desc: 'DOT pricing: scan one room free, unlock the whole home for $29 a month, and get one flat price for your downsizing move in Toronto and the GTA.',
  ld: [{ '@context': 'https://schema.org', '@type': 'OfferCatalog', name: 'DOT pricing', itemListElement: [{ '@type': 'Offer', name: 'Free room scan', price: '0', priceCurrency: 'CAD' }, { '@type': 'Offer', name: 'Home pass', price: '29', priceCurrency: 'CAD', description: 'Per month. Credited to your move if you book.' }, { '@type': 'Offer', name: 'Clear + move', priceCurrency: 'CAD', priceSpecification: { '@type': 'PriceSpecification', minPrice: 2400, maxPrice: 4500, priceCurrency: 'CAD' }, description: 'Guide range, not a quote.' }] }],
  body: `<section class="hero"><div class="wrap narrow">${dots()}<h1>Simple pricing</h1><p class="lead" style="margin-top:18px">Start free. Pay for the app only if it is useful. Pay for the move only once you have approved a flat price.</p></div></section>
<section class="tight"><div class="wrap"><div class="grid3">${plans.map((p) => `<div class="plan${p.hi ? ' hi' : ''}"><h3>${p.n}</h3><div class="price">${p.p}<small>${p.s}</small></div><p class="muted">${p.d}</p><ul class="check">${p.f.map((f) => `<li>${f}</li>`).join('')}</ul>${p.cta}</div>`).join('')}</div></div></section>
<section class="soft"><div class="wrap"><div class="head"><p class="eyebrow">Move price guides</p><h2>What a booked move tends to cost.</h2><p class="lead">These are guides, not quotes. Your own price comes from your own list.</p></div>
<div class="grid3">${[['Clear', 'From about $1,500', 'Estate or sale prep with nobody moving: sort, donate, consign, dispose, broom-clean.'], ['Clear + move', '$2,400 to $4,500', 'Downsizing to a condo or residence: everything in Clear, plus packing, truck and delivery.'], ['Clear, move + settle', '$3,500 to $6,000', 'Hands-off: all of it, plus unpacking, furniture placed and boxes taken away.']].map(([t, p, d]) => `<div class="card"><h3>${t}</h3><div class="price" style="font-size:30px">${p}</div><p>${d}</p></div>`).join('')}</div>
<p class="muted small" style="margin-top:18px">What changes the price: how much is in the home, stairs and elevators, how much needs packing, and how many places things are going. See <a href="/guides/how-much-does-downsizing-cost-toronto">how much downsizing costs in Toronto</a>.</p></div></section>
${band('pricing-band')}` })

// ---------- The app
page('/app', { src: 'app', og: 'app', crumbs: [['The app', '/app']], title: `The DOT app: scan your home with your phone | ${BRAND.long}`, desc: 'Turn slowly in each room and the DOT app builds a photo inventory. Sort every item, share lists with family and see a price. Nothing to install.',
  ld: [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'DOT', url: APP, applicationCategory: 'LifestyleApplication', operatingSystem: 'Any (web browser)', description: 'Scan a home room by room with a phone to build a photo inventory, sort every item by destination, share lists and get a move price.', offers: [{ '@type': 'Offer', name: 'Free room scan', price: '0', priceCurrency: 'CAD' }, { '@type': 'Offer', name: 'Home pass', price: '29', priceCurrency: 'CAD', description: 'Per month' }], provider: { '@id': `${host}/#org` } }],
  body: `<section class="hero"><div class="wrap"><div class="grid"><div>${dots()}<h1>Your home, as a list.</h1><p class="lead" style="margin-top:18px">Opens in your phone's browser. Nothing to install, and your first room is free.</p><div class="cta">${scan('app-hero', 'Open the app')}</div></div>${phone}</div></div></section>
<section class="soft"><div class="wrap"><div class="grid3">${[['Room scan', 'Turn slowly and the app lists what it sees. The view turns green as each part of the room is captured.'], ['One at a time', 'Prefer to go slowly? Point at a single item and tap.'], ['Sets', 'Six matching dining chairs are one line and one decision.'], ['Family', 'Relatives see photos and say what they would like. You decide.'], ['Helpers', 'Someone nearby can scan for you with just their first name and a code.'], ['Sharing', 'Send a charity or dealer a link showing only their items, or save a PDF of the whole home.']].map(([t, p]) => `<div class="card"><h3>${t}</h3><p>${p}</p></div>`).join('')}</div></div></section>
<section><div class="wrap narrow"><div class="head"><p class="eyebrow">Privacy</p><h2>Your home stays yours.</h2></div><ul class="check">${['Only you, the people you invite and our team can see your photos', 'Charities and dealers see only the items you send them', 'We never sell or share your photos, and delete them whenever you ask', 'Card payments are handled by Stripe; we never see your card'].map((t) => `<li>${t}</li>`).join('')}</ul></div></section>
${band('app-band')}` })

// ---------- Services
page('/services', { src: 'services', og: 'value', crumbs: [['Services', '/services']], title: `Downsizing services in Toronto | ${BRAND.short}`, desc: 'Downsizing help, senior move management, estate clear-outs, packing and moving, donation and consignment, and home inventories across Toronto and the GTA.',
  body: `<section class="hero"><div class="wrap narrow">${dots()}<h1>Services</h1><p class="lead" style="margin-top:18px">Different reasons for a move, one way of working: a clear list first, then one crew for everything on it.</p></div></section><section class="tight"><div class="wrap">${serviceCards('services')}</div></section>${band('services-band')}` })
for (const s of SERVICES) page(`/services/${s.slug}`, { src: `svc-${s.slug}`, og: `svc-${s.slug}`, crumbs: [['Services', '/services'], [s.name, `/services/${s.slug}`]], title: `${s.h1} | ${BRAND.short}`, desc: s.lead.slice(0, 155),
  ld: [{ '@context': 'https://schema.org', '@type': 'Service', name: s.name, serviceType: s.name, provider: { '@type': 'ProfessionalService', name: `${BRAND.short}: ${BRAND.long}`, url: host }, areaServed: AREAS.map((a) => ({ '@type': 'City', name: `${a.name}, Ontario` })), description: s.lead, url: `${host}/services/${s.slug}`, image: `${host}/og/svc-${s.slug}.png`, offers: { '@type': 'Offer', priceCurrency: 'CAD', description: 'Flat price confirmed from your own inventory. First room scan is free.' } }],
  body: `<section class="hero"><div class="wrap"><div class="grid"><div><p class="crumbs"><a href="/">Home</a> / <a href="/services">Services</a> / ${s.name}</p><h1 style="font-size:clamp(36px,5.4vw,60px)">${s.h1}</h1><p class="lead" style="margin-top:18px">${esc(s.lead)}</p><div class="cta">${scan(`svc-${s.slug}-hero`)}<a class="btn alt" href="/contact">Talk to a person</a></div></div>${pic(s.photo, 'tall', true)}</div></div></section>
<section class="tight"><div class="wrap"><div class="grid2" style="gap:40px"><div class="prose">${s.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div><div class="card"><h3>What is included</h3><ul class="check">${s.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div></div></div></section>
<section class="soft"><div class="wrap"><div class="head"><h2>How it works</h2></div>${howCards}<p style="margin-top:20px"><a href="/how-it-works">The full step by step</a> · <a href="/pricing">Pricing</a></p></div></section>
<section class="tight"><div class="wrap"><div class="head"><h2>${s.name} near you</h2></div><div class="chips">${AREAS.map((a) => `<a href="/areas/${a.slug}">${a.name}</a>`).join('')}</div><div class="head" style="margin-top:36px"><h2>Other services</h2></div><div class="chips">${SERVICES.filter((o) => o !== s).map((o) => `<a href="/services/${o.slug}">${o.name}</a>`).join('')}</div></div></section>
${band(`svc-${s.slug}-band`)}` })

// ---------- Areas
page('/areas', { src: 'areas', og: 'value', crumbs: [['Areas', '/areas']], title: `Areas we serve in the GTA | ${BRAND.short}`, desc: 'DOT helps families downsize across Toronto and the GTA: Etobicoke, Mississauga, Oakville, Burlington, North York, Scarborough, Vaughan, Markham and Brampton.',
  body: `<section class="hero"><div class="wrap narrow">${dots()}<h1>Where we work</h1><p class="lead" style="margin-top:18px">Toronto and the surrounding GTA. If you are just outside it, ask.</p></div></section><section class="tight"><div class="wrap"><div class="grid3">${AREAS.map((a) => `<a class="card" href="/areas/${a.slug}"><h3>${a.name}</h3><p>${a.near.join(', ')}</p></a>`).join('')}</div></div></section>${band('areas-band')}` })
for (const a of AREAS) {
  const faqs = [[`Do you cover all of ${a.name}?`, `Yes, including ${a.near.join(', ')} and the neighbourhoods around them.`], FAQ[1], FAQ[2], FAQ[6]]
  page(`/areas/${a.slug}`, { src: `area-${a.slug}`, og: `area-${a.slug}`, crumbs: [['Areas', '/areas'], [a.name, `/areas/${a.slug}`]], title: `Downsizing help in ${a.name} | ${BRAND.short}, ${BRAND.long}`, desc: `Downsizing, senior moves and estate clear-outs in ${a.name}. Scan your home with your phone, sort every item, and one crew does the rest. First room free.`,
    ld: [faqLd(faqs)],
    body: `<section class="hero"><div class="wrap"><div class="grid"><div><p class="crumbs"><a href="/">Home</a> / <a href="/areas">Areas</a> / ${a.name}</p><h1 style="font-size:clamp(36px,5.4vw,60px)">Downsizing help in ${a.name}</h1><p class="lead" style="margin-top:18px">Scan the home with your phone, decide where everything goes, and one crew handles the moving, giving, selling and clearing.</p><div class="cta">${scan(`area-${a.slug}-hero`)}<a class="btn alt" href="/contact">Talk to a person</a></div></div>${phone}</div></div></section>
<section class="tight"><div class="wrap"><div class="grid2" style="gap:40px"><div class="prose"><h2 style="margin-top:0">Moving in ${a.name}</h2><p>${esc(a.note)}</p><p>We work across ${a.name}, including ${a.near.join(', ')}.</p></div><div>${pic(['loft', 'parlour', 'living', 'shelves', 'armchair'][AREAS.indexOf(a) % 5])}<div class="card" style="margin-top:16px"><h3>What we do in ${a.name}</h3><ul class="check">${SERVICES.map((s) => `<li><a href="/services/${s.slug}">${s.name}</a></li>`).join('')}</ul></div></div></div></div></section>
<section class="soft"><div class="wrap"><div class="head"><h2>How it works</h2></div>${howCards}</div></section>
<section class="tight"><div class="wrap narrow"><div class="head"><h2>Questions from ${a.name}</h2></div>${faqBlock(faqs)}</div></section>
<section class="tight"><div class="wrap"><div class="head"><h2>Nearby</h2></div><div class="chips">${AREAS.filter((o) => o !== a).map((o) => `<a href="/areas/${o.slug}">${o.name}</a>`).join('')}</div><div class="head" style="margin-top:36px"><h2>Helpful guides</h2></div><div class="chips">${QUESTIONS.slice(0, 4).map((q) => `<a href="/guides/${q.slug}">${esc(q.q)}</a>`).join('')}</div></div></section>
${band(`area-${a.slug}-band`, `See your price for a move in ${a.name}.`)}` })
}

// ---------- Guides (question pages)
page('/guides', { src: 'guides', og: 'guides', crumbs: [['Guides', '/guides']], title: `Downsizing guides | ${BRAND.short}, ${BRAND.long}`, desc: 'Plain answers to common downsizing questions: what it costs in Toronto, how long it takes, where to donate furniture, and how to clear an estate home.',
  body: `<section class="hero"><div class="wrap narrow">${dots()}<h1>Guides</h1><p class="lead" style="margin-top:18px">Plain answers to the questions families ask us most.</p></div></section><section class="tight"><div class="wrap"><div class="grid2">${QUESTIONS.map((q) => `<a class="card" href="/guides/${q.slug}"><h3>${esc(q.q)}</h3><p>${esc(q.short)}</p></a>`).join('')}</div></div></section>${band('guides-band')}` })
for (const q of QUESTIONS) page(`/guides/${q.slug}`, { src: `guide-${q.slug}`, og: `guide-${q.slug}`, type: 'article', crumbs: [['Guides', '/guides'], [q.q, `/guides/${q.slug}`]], title: `${q.title ?? q.q} | ${BRAND.short}`, desc: q.short.slice(0, 158),
  ld: [faqLd([[q.q, q.short + ' ' + q.parts.map((p) => p[1]).join(' ')]]), { '@context': 'https://schema.org', '@type': 'Article', headline: q.q, description: q.short, author: { '@id': `${host}/#org` }, publisher: { '@id': `${host}/#org` }, image: `${host}/og/guide-${q.slug}.png`, datePublished: '2026-11-12', dateModified: today, inLanguage: 'en-CA', mainEntityOfPage: `${host}/guides/${q.slug}` }],
  body: `<section class="hero" style="padding-bottom:24px"><div class="wrap narrow"><p class="crumbs"><a href="/">Home</a> / <a href="/guides">Guides</a></p><h1 style="font-size:clamp(34px,5vw,54px)">${esc(q.q)}</h1><p class="lead" style="margin-top:18px">${esc(q.short)}</p></div></section>
<section class="tight" style="padding-top:8px"><div class="wrap narrow"><div class="prose">${q.parts.map(([h, p]) => `<h2>${esc(h)}</h2><p>${esc(p)}</p>`).join('')}
${q.sources ? `<h2>Sources</h2><ul>${q.sources.map(([t, u]) => `<li><a href="${u}" rel="noopener nofollow">${esc(t)}</a></li>`).join('')}</ul>` : ''}</div>
<div class="card" style="margin-top:36px"><h3>Want a number for your own home?</h3><p>Scan one room free and see a price range built from what is actually there.</p><div>${scan(`guide-${q.slug}-card`)}</div></div>
<div class="head" style="margin-top:44px"><h2 style="font-size:28px">More guides</h2></div><div class="chips">${QUESTIONS.filter((o) => o !== q).map((o) => `<a href="/guides/${o.slug}">${esc(o.q)}</a>`).join('')}</div>
<div class="head" style="margin-top:36px"><h2 style="font-size:28px">Services</h2></div><div class="chips">${SERVICES.map((s) => `<a href="/services/${s.slug}">${s.name}</a>`).join('')}</div></div></section>
${band(`guide-${q.slug}-band`)}` })

// ---------- FAQ
page('/faq', { src: 'faq', og: 'value', crumbs: [['Questions', '/faq']], title: `Questions | ${BRAND.short}, ${BRAND.long}`, desc: 'Answers about the free room scan, the Home pass, pricing, privacy, helpers and the areas DOT covers in the GTA.', ld: [faqLd(FAQ)],
  body: `<section class="hero"><div class="wrap narrow">${dots()}<h1>Questions</h1><p class="lead" style="margin-top:18px">If yours is not here, <a href="/contact">ask a person</a>.</p></div></section><section class="tight"><div class="wrap narrow">${faqBlock(FAQ)}</div></section>${band('faq-band')}` })

// ---------- Contact (stores the enquiry; a person replies)
page('/contact', { src: 'contact', og: 'default', crumbs: [['Contact', '/contact']], title: `Talk to a person | ${BRAND.short}, ${BRAND.long}`, desc: 'Ask a question or request a call about downsizing, a senior move or an estate clear-out in Toronto and the GTA. A person replies.',
  body: `<section class="hero"><div class="wrap"><div class="grid" style="align-items:start"><div>${dots()}<h1>Talk to a person</h1><p class="lead" style="margin-top:18px">Tell us a little about the home and how to reach you. A person replies, usually within one business day.</p><p class="muted" style="margin-top:18px">Prefer to just look? ${`<a href="${APP}/login?src=contact-inline">Scan a room free</a>`} and see a price first.</p></div>
<div class="card"><form class="lead-form" id="lead" novalidate>
<div><label for="f-name">Your name</label><input id="f-name" name="name" autocomplete="name" required maxlength="80"></div>
<div><label for="f-phone">Phone</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" maxlength="40"></div>
<div><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" maxlength="160"></div>
<div><label for="f-area">Where is the home?</label><input id="f-area" name="area" placeholder="Etobicoke, Oakville…" maxlength="80"></div>
<div><label for="f-msg">What can we help with?</label><textarea id="f-msg" name="message" maxlength="2000"></textarea></div>
<div class="hp" aria-hidden="true"><label for="f-web">Website</label><input id="f-web" name="website" tabindex="-1" autocomplete="off"></div>
<p class="err" id="lead-err" role="alert" hidden></p>
<button class="btn" type="submit">Send</button><p class="muted small">We only use this to reply to you.</p></form>
<div class="ok" id="lead-ok" role="status" hidden>Thank you. A person will be in touch, usually within one business day.</div></div></div></div></section>
<script>
const f=document.getElementById('lead'),err=document.getElementById('lead-err');
f.addEventListener('submit',async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));err.hidden=true;
if(d.website)return;if(!d.name.trim()){err.textContent='Please add your name.';err.hidden=false;return}
if(!d.phone.trim()&&!d.email.trim()){err.textContent='Please add a phone number or an email so we can reply.';err.hidden=false;return}
const b=f.querySelector('button');b.disabled=true;b.textContent='Sending…';
try{const r=await fetch('${SUPA}/rest/v1/leads',{method:'POST',headers:{apikey:'${SUPA_KEY}',Authorization:'Bearer ${SUPA_KEY}','Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({name:d.name.trim(),phone:d.phone.trim()||null,email:d.email.trim()||null,area:d.area.trim()||null,message:d.message.trim()||null,page:(new URLSearchParams(location.search).get('from')||document.referrer||'contact').slice(0,120)})});
if(!r.ok)throw 0;f.hidden=true;document.getElementById('lead-ok').hidden=false}catch{err.textContent='That did not send. Please check your connection and try again.';err.hidden=false;b.disabled=false;b.textContent='Send'}});
</script>` })

// ---------- 404, robots, sitemap, styles
page('/404', { src: '404', noindex: true, title: `Page not found | ${BRAND.short}`, desc: 'That page is not here.', body: `<section class="hero"><div class="wrap narrow">${dots()}<h1>That page is not here.</h1><p class="lead" style="margin-top:18px">Try the <a href="/">home page</a>, or ${`<a href="${APP}/login?src=404">scan a room free</a>`}.</p></div></section>` })
writeFileSync(join(out, 'styles.css'), readFileSync(join(import.meta.dirname, 'styles.css')))
writeFileSync(join(out, 'chat.js'), readFileSync(join(import.meta.dirname, 'chat.js')))
cpSync(join(import.meta.dirname, 'static'), out, { recursive: true })
// Search engines and AI assistants are all welcome. llms.txt gives AI tools the facts in one plain file.
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\n${['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'Bingbot'].map((u) => `User-agent: ${u}\nAllow: /`).join('\n\n')}\n\nSitemap: ${host}/sitemap.xml\n`)
writeFileSync(join(out, 'site.webmanifest'), JSON.stringify({ name: `${BRAND.short}: ${BRAND.long}`, short_name: BRAND.short, start_url: '/', display: 'browser', background_color: '#ffffff', theme_color: '#111111', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }))
writeFileSync(join(out, 'llms.txt'), `# ${BRAND.short}: ${BRAND.long}

> ${BRAND.short} is a downsizing and move service for Toronto and the Greater Toronto Area. Homeowners scan each room with a phone to build a photo inventory, put a coloured dot on every item to say where it goes (move, keep, family, sell, donate, store, dispose), and one crew then handles the packing, moving, donation, consignment and disposal. The first room scan is free.

## Key facts
- Area served: ${AREAS.map((a) => a.name).join(', ')} (Ontario, Canada).
- Who it is for: people planning ahead who want an inventory and a price on file, and people moving soon who need it done.
- The app runs in a phone browser. Nothing to install. A helper can do the scanning with a first name and an invite code.
- Pricing: first room free. Home pass $29 CAD a month for the whole home; credited to the move if booked. A booked move has one flat price confirmed before approval; a $100 deposit holds the date.
- Guide ranges, not quotes: Clear from about $1,500; Clear + move $2,400 to $4,500; Clear, move + settle $3,500 to $6,000 (CAD).
- The inventory and the price are useful on their own; booking a move is optional.
- Privacy: photos are seen only by the owner, people they invite and the ${BRAND.short} team; never sold or shared; deleted on request.
- Questions are answered by an AI assistant on the site for quick things and by a person through the contact page.

## Start here
- [Home](${host}/): what ${BRAND.short} is
- [How it works](${host}/how-it-works): the eight steps from scan to empty home
- [Pricing](${host}/pricing): free scan, Home pass and move price guides
- [The app](${host}/app): what the scan and sorting tools do
- [Planning ahead](${host}/plan-ahead): for homeowners not moving yet
- [Moving soon](${host}/moving-soon): for a set date, a sold house or an estate
- [Questions](${host}/faq)
- [Contact](${host}/contact)

## Services
${SERVICES.map((s) => `- [${s.name}](${host}/services/${s.slug}): ${s.lead}`).join('\n')}

## Areas
${AREAS.map((a) => `- [Downsizing help in ${a.name}](${host}/areas/${a.slug}): includes ${a.near.join(', ')}`).join('\n')}

## Guides
${QUESTIONS.map((q) => `- [${q.q}](${host}/guides/${q.slug}): ${q.short}`).join('\n')}
`)
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((p) => p !== '/404').map((p) => `<url><loc>${host}${p === '/' ? '/' : p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`)
console.log(`Built ${pages.length} pages to dist (${host})`)
if (audit.length) console.log('Check lengths (title over 62, description outside 70 to 160):\n  ' + audit.join('\n  '))
