import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, HardHat, Home, HeartHandshake, Landmark, KeyRound } from 'lucide-react'
import { Page } from '../components/ui'
import { useStore } from '../lib/hooks'
import { createJob, store } from '../lib/store'
import type { JobMode } from '../lib/types'

// First screen after signing in: whose home is this, and who is doing the work?
export default function Start() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const user = useStore(() => store.getUser())
  const [mode, setMode] = useState<JobMode | 'code' | 'staff' | null>(params.get('code') ? 'code' : null)
  const [whose, setWhose] = useState('')
  const [code, setCode] = useState(params.get('code') ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!user) return null

  const start = (m: JobMode) => {
    if (m !== 'self' && !whose.trim()) return setErr(m === 'estate' ? 'Whose estate is it?' : 'Whose home is it?')
    createJob(user, m, m === 'self' ? user.name : m === 'estate' ? `Estate of ${whose.trim()}` : whose.trim())
    nav('/setup', { replace: true })
  }
  const staff = async () => {
    setBusy(true); setErr('')
    try { await store.claimStaff(code); nav('/crew', { replace: true }) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const join = async () => {
    setBusy(true); setErr('')
    try { await store.joinJob(code); nav('/setup', { replace: true }) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const Choice = ({ m, icon, title, body }: { m: JobMode | 'code' | 'staff'; icon: React.ReactNode; title: string; body: string }) => (
    <button type="button" onClick={() => { setMode(m); setErr('') }} className={`row py-4 items-start ${mode === m ? 'bg-surface-2' : ''}`} aria-pressed={mode === m}>
      <span className="mt-0.5 text-ink-2">{icon}</span>
      <span className="flex-1 min-w-0"><span className="block font-semibold">{title}</span><span className="block text-ink-2 text-[15px]">{body}</span></span>
      <ChevronRight size={18} className="text-ink-3 mt-1" />
    </button>
  )

  return (
    <Page>
      <h1 className="mb-2">Welcome, {user.name.split(' ')[0]}.</h1>
      <p className="lead mb-6">Who are we helping?</p>
      <div className="group mb-5">
        <Choice m="self" icon={<Home size={22} />} title="My own home" body="I'm downsizing or moving." />
        <Choice m="helper" icon={<HeartHandshake size={22} />} title="A parent or relative's home" body="I'm helping someone I love move." />
        <Choice m="estate" icon={<Landmark size={22} />} title="An estate" body="I'm the executor, clearing a home after a death." />
        <Choice m="code" icon={<KeyRound size={22} />} title="I have an invite code" body="Someone already started and invited me." />
        <Choice m="staff" icon={<HardHat size={22} />} title="I work for the company" body="Crew and staff sign in with a staff code." />
      </div>

      {mode === 'self' && <button className="btn" onClick={() => start('self')}>Start</button>}
      {(mode === 'helper' || mode === 'estate') && (
        <div className="flex flex-col gap-2">
          <label htmlFor="whose" className="font-medium text-[15px]">{mode === 'estate' ? 'Name of the person who passed' : 'Their name'}</label>
          <input id="whose" className="input" value={whose} onChange={(e) => setWhose(e.target.value)} autoComplete="off" />
          {mode === 'estate' && <p className="text-ink-2 text-[15px]">We're sorry for your loss. We'll handle this with care, and nothing leaves the home until you approve the plan.</p>}
          {err && <p role="alert" className="text-danger font-semibold">{err}</p>}
          <button className="btn mt-2" onClick={() => start(mode)}>Start</button>
        </div>
      )}
      {mode === 'staff' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="scode" className="font-medium text-[15px]">Staff code</label>
          <input id="scode" className="input text-center text-[22px] tracking-[0.25em] uppercase" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" />
          {err && <p role="alert" className="text-danger font-semibold">{err}</p>}
          <button className="btn mt-2" disabled={code.length < 6 || busy} onClick={staff}>{busy ? 'Checking…' : 'Switch to crew mode'}</button>
        </div>
      )}
      {mode === 'code' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="code" className="font-medium text-[15px]">Invite code</label>
          <input id="code" className="input text-center text-[22px] tracking-[0.25em] uppercase" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" />
          {err && <p role="alert" className="text-danger font-semibold">{err}</p>}
          <button className="btn mt-2" disabled={code.length < 6 || busy} onClick={join}>{busy ? 'Joining…' : 'Join'}</button>
        </div>
      )}
    </Page>
  )
}
