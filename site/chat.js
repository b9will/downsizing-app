// Website assistant: a small chat panel. Answers come from the site-chat function, which only
// talks about DOT and downsizing and has daily limits. Questions are saved without any visitor details.
(() => {
  const URL_ = 'https://mcsnkmfyqvzpdfeffvzi.supabase.co/functions/v1/site-chat'
  const KEY = 'dot.chat.v1', MAX = 500
  let msgs = []
  try { msgs = JSON.parse(sessionStorage.getItem(KEY) || '[]') } catch { /* start fresh */ }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }

  const fab = el('button', 'chat-fab'); fab.type = 'button'; fab.setAttribute('aria-haspopup', 'dialog'); fab.setAttribute('aria-expanded', 'false')
  fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg><span>Ask a question</span>'
  const panel = el('section', 'chat-panel'); panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Ask DOT a question')
  const head = el('header', 'chat-head')
  head.innerHTML = '<div><b>Ask DOT</b><small>AI assistant. Questions are saved, without your details (<a href="/privacy">privacy</a>). Or <a href="/contact">talk to a person</a>.</small></div>'
  const close = el('button', 'chat-x', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close'); head.appendChild(close)
  const log = el('div', 'chat-log'); log.setAttribute('aria-live', 'polite')
  const chips = el('div', 'chat-chips')
  const form = el('form', 'chat-form')
  const input = el('input'); input.type = 'text'; input.maxLength = MAX; input.placeholder = 'Type your question'; input.setAttribute('aria-label', 'Your question'); input.autocomplete = 'off'
  const send = el('button', 'btn sm', 'Send'); send.type = 'submit'
  form.append(input, send); panel.append(head, log, chips, form); document.body.append(fab, panel)

  // Replies are plain text. Site paths the assistant mentions (like /pricing) become links.
  const bubble = (role, text) => {
    const b = el('div', `chat-msg ${role}`)
    text.split(/(\/[a-z][a-z-]*(?:\/[a-z-]+)?)/g).forEach((part, i) => {
      if (i % 2 && /^\/(contact|pricing|how-it-works|plan-ahead|moving-soon|guides|services|areas|app|faq)(\/[a-z-]+)?$/.test(part)) { const a = el('a', '', part); a.href = part; b.appendChild(a) } else b.appendChild(document.createTextNode(part))
    })
    log.appendChild(b); log.scrollTop = log.scrollHeight; return b
  }
  const render = () => {
    log.textContent = ''
    bubble('bot', 'Hello. I can answer questions about DOT, pricing and downsizing. What would you like to know?')
    msgs.forEach((m) => bubble(m.role === 'user' ? 'me' : 'bot', m.content))
    chips.textContent = ''
    if (!msgs.length) ['How much does it cost?', 'How does the free scan work?', 'Can someone else scan for me?'].forEach((q) => { const c = el('button', '', q); c.type = 'button'; c.onclick = () => ask(q); chips.appendChild(c) })
  }
  let busy = false
  async function ask(q) {
    q = q.trim().slice(0, MAX); if (!q || busy) return
    busy = true; send.disabled = true; input.value = ''
    msgs.push({ role: 'user', content: q }); render()
    const wait = bubble('bot', '…')
    let reply = 'I could not reach the assistant. Please check your connection, or use the contact page to reach a person.'
    try {
      const r = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs.slice(-8), page: location.pathname }) })
      const d = await r.json(); if (d.reply) reply = d.reply
    } catch { /* keep the fallback */ }
    wait.remove(); msgs.push({ role: 'assistant', content: reply })
    try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-20))) } catch { /* ignore */ }
    render(); busy = false; send.disabled = false; input.focus()
  }
  const open = (on) => { panel.hidden = !on; fab.setAttribute('aria-expanded', String(on)); document.body.classList.toggle('chat-open', on); if (on) { render(); input.focus() } else fab.focus() }
  fab.onclick = () => open(panel.hidden); close.onclick = () => open(false)
  form.onsubmit = (e) => { e.preventDefault(); ask(input.value) }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) open(false) })
})()
