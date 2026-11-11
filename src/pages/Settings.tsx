import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, ChevronLeft, ChevronRight, FileSpreadsheet, HardHat, LogOut, RotateCcw, Trash2, UserPlus } from 'lucide-react'
import { Page, Sheet } from '../components/ui'
import { cameraGrantedBefore, cameraSupported, requestCamera } from '../lib/camera'
import { exportCsv } from '../lib/export'
import { ExportSheet } from '../components/ExportSheet'
import { useStore } from '../lib/hooks'
import { resetJob, store, wipeAll } from '../lib/store'
import { type Job } from '../lib/types'

const TIERS: Array<[Job['tier'], string]> = [['clear', 'Clear'], ['clear-move', 'Clear and move'], ['clear-move-settle', 'Clear, move and settle']]
const SUPPORT_PHONE = '416 000 0000'

type Danger = 'reset' | 'delete' | 'invite' | 'crew' | null

export default function Settings() {
  const nav = useNavigate()
  const user = useStore(() => store.getUser())
  const job = useStore(() => store.getJob())
  const rooms = useStore(() => (job ? store.listRooms(job.id) : []))
  const items = useStore(() => (job ? store.listItems(job.id) : []))
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [cam, setCam] = useState<'allowed' | 'blocked' | 'unknown'>(cameraGrantedBefore() ? 'allowed' : 'unknown')
  const [danger, setDanger] = useState<Danger>(null)
  const [typed, setTyped] = useState('')
  const [msg, setMsg] = useState('')
  const [exporting, setExporting] = useState(false)
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Ask the browser what it remembers, when it will tell us.
    navigator.permissions?.query({ name: 'camera' as PermissionName }).then((p) => {
      setCam(p.state === 'granted' ? 'allowed' : p.state === 'denied' ? 'blocked' : cameraGrantedBefore() ? 'allowed' : 'unknown')
    }).catch(() => {})
  }, [])

  if (!user || !job) return null
  const isOwner = job.ownerId === user.id

  const [inviteKind, setInviteKind] = useState<'family' | 'scanner'>('family')
  const makeInvite = async (kind: 'family' | 'scanner' = 'family') => {
    setInviteKind(kind)
    setDanger('invite'); setInvite(''); setBusy(true)
    try { setInvite(await store.invite(kind)) } catch { setInvite('') ; setMsg('Could not make a code. Check your connection.') } finally { setBusy(false) }
  }
  const shareInvite = async () => {
    const url = `${location.origin}/join?code=${invite}`
    const text = inviteKind === 'scanner'
      ? `Could you scan the rooms for ${job.clientName.split(' ')[0]}'s move? Open ${url} on your phone, sign in, and turn slowly in each room. Code: ${invite}`
      : `Have a look at the list for ${job.clientName.split(' ')[0]}'s move and say what you'd like. Open ${url} and sign in. Code: ${invite}`
    if (navigator.share) { try { await navigator.share({ text }); return } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(text); setMsg('Invite copied.') } catch { /* ignore */ }
  }
  const claimCrew = async () => {
    setBusy(true)
    try { await store.claimStaff(typed); setDanger(null); nav('/crew', { replace: true }) } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  const locked = job.status === 'scheduled' || job.status === 'done'

  const saveAccount = () => {
    if (!name.trim() || !/.+@.+\..+/.test(email)) return
    store.setUser({ ...user, name: name.trim(), email: email.trim().toLowerCase() })
    store.saveJob({ ...job, clientName: name.trim() })
    setEditing(false)
  }

  const askCamera = async () => {
    if (!cameraSupported()) { setMsg('Live camera needs a secure connection.'); return }
    const ok = await requestCamera()
    setCam(ok ? 'allowed' : 'blocked')
    setMsg(ok ? 'Camera allowed.' : 'Still blocked. Open iOS Settings, find Safari or this app, and turn Camera on.')
  }


  const confirmDanger = async () => {
    if (danger === 'reset' && typed === 'RESET') {
      try { await exportCsv(job, rooms, items) } catch { /* best effort backup */ }
      resetJob(job.id)
      setDanger(null); setTyped(''); nav('/', { replace: true })
    }
    if (danger === 'delete' && typed === 'DELETE') {
      try { await exportCsv(job, rooms, items) } catch { /* best effort backup */ }
      await wipeAll()
    }
  }

  const Row = ({ to, onClick, icon, label, value, danger: d }: { to?: string; onClick?: () => void; icon?: React.ReactNode; label: string; value?: React.ReactNode; danger?: boolean }) => {
    const inner = (<>
      {icon && <span className={d ? 'text-danger' : 'text-ink-3'}>{icon}</span>}
      <span className={`flex-1 font-medium ${d ? 'text-danger' : ''}`}>{label}</span>
      {value && <span className="text-ink-2 text-[14px] truncate max-w-[45%]">{value}</span>}
      <ChevronRight size={18} className="text-ink-3 shrink-0" />
    </>)
    return to ? <Link to={to} className="row py-3">{inner}</Link> : <button type="button" onClick={onClick} className="row py-3">{inner}</button>
  }

  return (
    <Page>
      <Link to="/" className="back"><ChevronLeft size={18} /> Home</Link>
      <h1 className="mb-6">Settings</h1>

      <div className="eyebrow mb-2 px-1">Account</div>
      <div className="group mb-6">
        {editing ? (
          <div className="px-4 py-3 flex flex-col gap-2">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="name" />
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" />
            <div className="grid grid-cols-2 gap-2 mt-1"><button className="btn btn-secondary" onClick={() => { setEditing(false); setName(user.name); setEmail(user.email) }}>Cancel</button><button className="btn" onClick={saveAccount}>Save</button></div>
          </div>
        ) : <Row onClick={() => setEditing(true)} label="Name and email" value={`${user.name} · ${user.email}`} />}
        <Row to="/details" label="Your details" value={job.details?.phone ? 'Saved' : 'Not yet'} />
      </div>

      <div className="eyebrow mb-2 px-1">Job</div>
      <div className="group mb-6">
        <div className="px-4 py-3">
          <div className="font-medium mb-2">Service</div>
          <div className="flex flex-col gap-1">
            {TIERS.map(([v, label]) => (
              <label key={v} className="flex items-center gap-3 min-h-10">
                <input type="radio" name="tier" className="w-5 h-5 accent-ink" checked={job.tier === v} onChange={() => store.saveJob({ ...job, tier: v })} />
                <span className="text-[15px]">{label}</span>
              </label>
            ))}
          </div>
          {job.status !== 'tagging' && <p className="text-ink-2 text-[13px] mt-2">Changing this after sending flags the job for our review.</p>}
        </div>
        <Row to="/rooms" label="Rooms" value={`${rooms.length}`} />
        <div className="row py-3"><span className="flex-1 font-medium">Status</span><span className="text-ink-2 text-[14px] capitalize">{job.status}</span></div>
      </div>

      <div className="eyebrow mb-2 px-1">People</div>
      <div className="group mb-6">
        <Row onClick={() => makeInvite('family')} icon={<UserPlus size={18} />} label="Invite family" value="They say what they'd like" />
        <Row onClick={() => makeInvite('scanner')} icon={<Camera size={18} />} label="Invite someone to scan" value="They scan, you sort" />
      </div>

      <div className="eyebrow mb-2 px-1">Camera</div>
      <div className="group mb-6">
        <Row onClick={askCamera} icon={<Camera size={18} />} label="Camera access" value={cam === 'allowed' ? 'Allowed' : cam === 'blocked' ? 'Blocked' : 'Not asked yet'} />
      </div>

      <div className="eyebrow mb-2 px-1">Data</div>
      <div className="group mb-6">
        <Row onClick={() => setExporting(true)} icon={<FileSpreadsheet size={18} />} label="Export lists" value={`${items.length} items`} />
        <Row onClick={() => { if (!locked) { setDanger('reset'); setTyped('') } else setMsg('This job is scheduled. Call us to make changes.') }} icon={<RotateCcw size={18} />} label="Start this job over" />
        {isOwner && <Row onClick={() => { setDanger('delete'); setTyped('') }} icon={<Trash2 size={18} />} label="Cancel and delete this job" danger />}
      </div>

      <div className="eyebrow mb-2 px-1">About</div>
      <div className="group mb-6">
        <div className="row py-3"><span className="flex-1 font-medium">Need a hand?</span><a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className="text-ink-2 text-[14px] select-text">{SUPPORT_PHONE}</a></div>
        <Row onClick={() => { setDanger('crew'); setTyped('') }} icon={<HardHat size={18} />} label="I work for the company" />
        <div className="row py-3"><span className="flex-1 font-medium">Version</span><span className="text-ink-2 text-[14px]">0.4</span></div>
      </div>

      <button className="btn btn-ghost" onClick={() => { store.setUser(null); nav('/login', { replace: true }) }}><LogOut size={18} /> Sign out</button>
      <p className="text-ink-2 text-[15px] text-center mt-2" role="status">{msg || 'Everything is saved to your account. Sign in on any phone.'}</p>

      <ExportSheet open={exporting} onOpenChange={setExporting} job={job} rooms={rooms} items={items} />

      <Sheet open={danger !== null} onOpenChange={(o) => { if (!o) setDanger(null) }}>
        {danger === 'invite' && (
          <div>
            <h2 className="mb-2">{inviteKind === 'scanner' ? 'Invite someone to scan' : 'Invite family'}</h2>
            <p className="text-ink-2 text-[16px] mb-4">{inviteKind === 'scanner' ? 'For someone at the house. They sign in, enter this code, and scan each room. Nothing is decided: every item comes to you to sort.' : 'They sign in with their own email, enter this code, and see the list. They can say what they would like. You make the final call.'}</p>
            <div className="text-center text-[36px] font-semibold tracking-[0.25em] tabular-nums mb-4" aria-live="polite">{busy ? '…' : invite || '—'}</div>
            <button className="btn" disabled={!invite} onClick={shareInvite}>Send the invite</button>
            <p className="text-ink-2 text-[14px] text-center mt-2">The code works for 30 days.</p>
          </div>
        )}
        {danger === 'crew' && (
          <div>
            <h2 className="mb-2">Crew sign-in</h2>
            <p className="text-ink-2 text-[16px] mb-4">Enter the staff code from your manager. This switches your account to crew mode.</p>
            <input className="input mb-3 text-center text-[22px] tracking-[0.2em]" autoCapitalize="characters" autoCorrect="off" aria-label="Staff code" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} />
            <button className="btn" disabled={typed.length < 6 || busy} onClick={claimCrew}>Switch to crew mode</button>
          </div>
        )}
        {(danger === 'reset' || danger === 'delete') && (
          <div>
            <h2 className="mb-2">{danger === 'reset' ? 'Start this job over?' : 'Cancel this job?'}</h2>
            <p className="text-ink-2 text-[15px] mb-1">
              {danger === 'reset'
                ? `This removes all ${items.length} tagged items and photos and gives you fresh rooms. Your name and details stay.`
                : 'This cancels the job for everyone invited to it and signs you out.'}
            </p>
            {job.status !== 'tagging' && danger === 'delete' && <p className="text-ink-2 text-[15px] mb-1">If a date is booked, please also call us.</p>}
            <p className="text-ink-2 text-[15px] mb-4">A spreadsheet backup is exported first.</p>
            <label className="eyebrow block mb-1" htmlFor="confirm">Type {danger === 'reset' ? 'RESET' : 'DELETE'} to confirm</label>
            <input id="confirm" className="input mb-3" autoCapitalize="characters" autoCorrect="off" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} />
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-secondary" onClick={() => setDanger(null)}>Keep everything</button>
              <button className={`btn ${danger === 'delete' ? 'bg-danger' : ''}`} disabled={typed !== (danger === 'reset' ? 'RESET' : 'DELETE')} onClick={confirmDanger}>{danger === 'reset' ? 'Start over' : 'Delete'}</button>
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  )
}
