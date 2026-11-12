import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { BarChart3, Inbox, MessageCircleQuestion, RefreshCw, Truck, Home as HomeIcon } from 'lucide-react'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/store'
import { sb } from '../../lib/supabase'

// The office: one screen, sized for an iPad, for the people running the business.
// Leads from the website, every home in the system, what visitors ask the assistant, and the sales funnel.
// Office staff (role "admin") only. The database refuses these reads for everyone else, crew included.
type Tab = 'overview' | 'leads' | 'homes' | 'questions'
type Overview = { signups: number; homes: number; scanned: number; passes: number; booked: number; deposits: number; leads: number; leads_new: number; questions: number; sources: { src: string; n: number }[] }
type Lead = { id: string; created_at: string; name: string; email: string | null; phone: string | null; area: string | null; message: string | null; page: string | null; status: string; kind?: string; role?: string | null }
type HomeRow = { id: string; client_name: string; status: string; plan: string; deposit_paid_at: string | null; move_date: string; created_at: string; items: number; undecided: number; rooms: number; src: string; owner_email: string }
type Question = { id: number; created_at: string; page: string | null; question: string; reply: string | null; turn: number }

const STATUS: Record<string, string> = { tagging: 'Scanning and sorting', review: 'Booked, to review', scheduled: 'Scheduled', in_progress: 'In progress', done: 'Done', cancelled: 'Cancelled' }
const when = (d: string) => new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const day = (d: string) => new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
const TABS: Array<[Tab, string, typeof Inbox]> = [['overview', 'Overview', BarChart3], ['leads', 'Leads', Inbox], ['homes', 'Homes', HomeIcon], ['questions', 'Questions', MessageCircleQuestion]]

export default function Office() {
  const user = useStore(() => store.getUser())
  const [tab, setTab] = useState<Tab>('overview')
  const [days, setDays] = useState(30)
  const [ov, setOv] = useState<Overview | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [homes, setHomes] = useState<HomeRow[]>([])
  const [qs, setQs] = useState<Question[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setBusy(true); setErr('')
    const [a, b, c, d] = await Promise.all([
      sb.rpc('office_overview', { p_days: days }),
      sb.from('leads').select('*').order('created_at', { ascending: false }).limit(200),
      sb.rpc('office_jobs'),
      sb.from('chat_questions').select('*').order('created_at', { ascending: false }).limit(300),
    ])
    const e = a.error ?? b.error ?? c.error ?? d.error
    if (e) setErr(e.message)
    setOv((a.data as Overview) ?? null); setLeads((b.data as Lead[]) ?? []); setHomes((c.data as HomeRow[]) ?? []); setQs((d.data as Question[]) ?? [])
    setBusy(false)
  }, [days])
  useEffect(() => { void load() }, [load])

  if (!user) return null
  if (user.role !== 'admin') return <Navigate to="/crew" replace />

  const setLead = async (l: Lead, status: string) => {
    setLeads((all) => all.map((x) => (x.id === l.id ? { ...x, status } : x)))
    const { error } = await sb.from('leads').update({ status }).eq('id', l.id)
    if (error) { setErr(error.message); void load() }
  }
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '')
  const funnel: Array<[string, number, string]> = ov ? [
    ['Signed up', ov.signups, ''], ['Started a home', ov.homes, pct(ov.homes, ov.signups)], ['Scanned something', ov.scanned, pct(ov.scanned, ov.homes)],
    ['Bought the Home pass', ov.passes, pct(ov.passes, ov.scanned)], ['Booked a move', ov.booked, pct(ov.booked, ov.scanned)], ['Paid a deposit', ov.deposits, ''],
  ] : []
  const top = Math.max(1, ...funnel.map((f) => f[1]))

  return (
    <div className="min-h-full md:grid md:grid-cols-[220px_1fr] bg-surface">
      <aside className="md:min-h-screen md:border-r border-line md:sticky md:top-0 md:self-start p-4 pt-[calc(var(--spacing-safe-t)+16px)] flex md:flex-col gap-2 overflow-x-auto">
        <div className="hidden md:flex items-center gap-2 mb-4 px-2"><span className="w-7 h-7 rounded-full bg-[#1d4ed8]" /><b className="text-[20px]" style={{ fontFamily: 'var(--font-display)' }}>DOT office</b></div>
        {TABS.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={`flex items-center gap-2.5 h-12 px-4 rounded-full font-semibold text-[16px] whitespace-nowrap ${tab === k ? 'bg-ink text-white' : 'text-ink hover:bg-surface-2'}`}>
            <Icon size={19} />{label}{k === 'leads' && ov && ov.leads_new > 0 && <span className={`ml-auto text-[13px] rounded-full px-2 ${tab === k ? 'bg-white text-ink' : 'bg-[#1d4ed8] text-white'}`}>{ov.leads_new}</span>}
          </button>
        ))}
        <Link to="/crew" className="flex items-center gap-2.5 h-12 px-4 rounded-full font-semibold text-[16px] text-ink-2 hover:bg-surface-2 md:mt-auto whitespace-nowrap"><Truck size={19} />Crew view</Link>
      </aside>

      <main className="p-5 md:p-8 pb-16 max-w-5xl w-full">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h1 className="text-[32px]">{TABS.find((t) => t[0] === tab)?.[1]}</h1>
          <button onClick={load} aria-label="Refresh" className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center"><RefreshCw size={19} className={busy ? 'animate-spin' : ''} /></button>
        </div>
        {err && <p role="alert" className="text-danger font-semibold mb-4">{err}</p>}

        {tab === 'overview' && (
          <div className="flex flex-col gap-5">
            <div className="flex gap-2" role="group" aria-label="Period">{[7, 30, 90].map((d) => <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} className={`h-10 px-4 rounded-full font-semibold text-[15px] ${days === d ? 'bg-ink text-white' : 'bg-surface-2'}`}>Last {d} days</button>)}</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[['New leads waiting', ov?.leads_new ?? 0], ['Leads', ov?.leads ?? 0], ['Assistant questions', ov?.questions ?? 0], ['Deposits paid', ov?.deposits ?? 0]].map(([l, n]) => (
                <div key={l as string} className="card"><div className="text-[34px] font-semibold tabular-nums leading-none" style={{ fontFamily: 'var(--font-display)' }}>{n}</div><div className="text-ink-2 text-[15px] mt-1.5">{l}</div></div>
              ))}
            </div>
            <section className="card">
              <div className="sec mb-3">From sign-up to booking</div>
              {funnel.length ? funnel.map(([label, n, p]) => (
                <div key={label} className="grid grid-cols-[150px_1fr_auto] md:grid-cols-[190px_1fr_auto] items-center gap-3 py-1.5">
                  <span className="text-[15px] font-medium">{label}</span>
                  <span className="h-6 rounded-full bg-surface overflow-hidden"><span className="block h-full rounded-full bg-[#1d4ed8]" style={{ width: `${Math.max(n ? 3 : 0, (n / top) * 100)}%` }} /></span>
                  <span className="tabular-nums font-semibold text-[16px] min-w-[76px] text-right">{n}{p && <span className="text-ink-2 font-normal text-[13px]"> {p}</span>}</span>
                </div>
              )) : <p className="text-ink-2">Loading…</p>}
              <p className="text-ink-2 text-[13px] mt-3">Each percentage is the share of the step above it. Test accounts are left out of sign-ups.</p>
            </section>
            <section className="card">
              <div className="sec mb-3">Where sign-ups came from</div>
              {ov?.sources.length ? ov.sources.map((s) => (
                <div key={s.src} className="flex justify-between py-2 border-b border-line last:border-0 text-[16px]"><span className="truncate">{s.src}</span><b className="tabular-nums">{s.n}</b></div>
              )) : <p className="text-ink-2">No sign-ups in this period.</p>}
              <p className="text-ink-2 text-[13px] mt-3">The name is the website button they tapped, for example "area-etobicoke-hero". "direct" means they opened the app without coming from the website.</p>
            </section>
          </div>
        )}

        {tab === 'leads' && (leads.length ? (
          <div className="flex flex-col gap-3">
            {leads.map((l) => (
              <article key={l.id} className={`card flex flex-col gap-2 ${l.status !== 'new' ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-[19px] font-semibold">{l.name}{l.kind === 'application' && <span className="ml-2 align-middle text-[12px] font-bold uppercase tracking-wide bg-[#7e22ce] text-white rounded-full px-2 py-0.5">Applying: {l.role || 'role not given'}</span>}</b><span className="text-ink-2 text-[14px]">{when(l.created_at)}{l.area ? ` · ${l.area}` : ''}</span></div>
                <div className="flex flex-wrap gap-2">
                  {l.phone && <a href={`tel:${l.phone}`} className="btn btn-sm h-11">Call {l.phone}</a>}
                  {l.email && <a href={`mailto:${l.email}`} className="btn btn-secondary btn-sm h-11">{l.email}</a>}
                </div>
                {l.message && <p className="text-[16px] whitespace-pre-wrap">{l.message}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label={`Status for ${l.name}`}>
                  {[['new', 'New'], ['contacted', 'Contacted'], ['won', l.kind === 'application' ? 'Hired' : 'Booked'], ['closed', 'Closed']].map(([k, label]) => <button key={k} onClick={() => setLead(l, k)} aria-pressed={l.status === k} className={`h-9 px-3.5 rounded-full text-[14px] font-semibold ${l.status === k ? 'bg-ink text-white' : 'bg-surface text-ink-2'}`}>{label}</button>)}
                  {l.page && <span className="text-ink-3 text-[13px] ml-auto truncate max-w-[50%]">from {l.page}</span>}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="text-ink-2">No enquiries yet. Customer enquiries and job applications from the website arrive here.</p>)}

        {tab === 'homes' && (homes.length ? (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-left text-[15px] border-separate border-spacing-y-1.5 min-w-[720px]">
              <thead><tr className="text-ink-2 text-[13px] uppercase tracking-wide"><th className="font-semibold px-3 py-1">Home</th><th className="font-semibold px-3">Stage</th><th className="font-semibold px-3">Items</th><th className="font-semibold px-3">Plan</th><th className="font-semibold px-3">Move date</th><th className="font-semibold px-3">Came from</th><th className="font-semibold px-3">Started</th></tr></thead>
              <tbody>
                {homes.map((h) => (
                  <tr key={h.id} className="bg-surface-2">
                    <td className="px-3 py-3 rounded-l-2xl"><Link to={`/crew/jobs/${h.id}`} className="font-semibold underline underline-offset-2">{h.client_name || 'Unnamed'}</Link><div className="text-ink-2 text-[13px] truncate max-w-[200px]">{h.owner_email || 'Joined with a code'}</div></td>
                    <td className="px-3">{STATUS[h.status] ?? h.status}</td>
                    <td className="px-3 tabular-nums">{h.items}{h.undecided > 0 && <span className="text-ink-2"> ({h.undecided} unsorted)</span>}<div className="text-ink-2 text-[13px]">{h.rooms} rooms</div></td>
                    <td className="px-3">{h.plan === 'pass' ? 'Home pass' : 'Free'}{h.deposit_paid_at && <div className="text-accent text-[13px] font-semibold">Deposit paid</div>}</td>
                    <td className="px-3">{h.move_date || 'Not set'}</td>
                    <td className="px-3 text-ink-2 max-w-[150px] truncate">{h.src}</td>
                    <td className="px-3 rounded-r-2xl text-ink-2">{day(h.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-ink-2">No homes yet.</p>)}

        {tab === 'questions' && (qs.length ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-ink-2 text-[15px] mb-1">What visitors asked the website assistant. Repeated questions are gaps in the site's copy, and good titles for guides.</p>
            {qs.map((q) => (
              <details key={q.id} className="card py-3">
                <summary className="cursor-pointer list-none flex items-baseline justify-between gap-3"><span className="font-semibold text-[16px]">{q.question}</span><span className="text-ink-2 text-[13px] whitespace-nowrap">{day(q.created_at)}{q.page ? ` · ${q.page}` : ''}</span></summary>
                <p className="text-ink-2 text-[15px] mt-2 whitespace-pre-wrap">{q.reply ?? 'No answer was given.'}</p>
              </details>
            ))}
          </div>
        ) : <p className="text-ink-2">No questions yet. They appear here when visitors use the assistant on the website.</p>)}
      </main>
    </div>
  )
}
