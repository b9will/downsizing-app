import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dot, Page } from '../components/ui'
import { useStore } from '../lib/hooks'
import { store } from '../lib/store'
import { sb } from '../lib/supabase'

// Where an invite link lands. First name and the code are all a helper needs: no email, no password.
// The code is unique to the invitation, so we know whose home it is and what they are allowed to do.
type Info = { from: string; relation: 'scanner' | 'family' | 'executor' }

export default function Join() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const user = useStore(() => store.getUser())
  const [name, setName] = useState('')
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase())
  const [info, setInfo] = useState<Info | null | 'bad'>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user?.name && !name) setName(user.name.split(' ')[0]) }, [user?.name])
  // Look up who the invite is from as soon as the code is complete.
  useEffect(() => {
    if (code.length < 6) { setInfo(null); return }
    let live = true
    void sb.rpc('invite_info', { p_code: code }).then(({ data }) => { if (live) setInfo((data as Info | null) ?? 'bad') })
    return () => { live = false }
  }, [code])

  const from = info && info !== 'bad' ? info.from : ''
  const scan = !info || info === 'bad' || info.relation === 'scanner'
  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Please enter your first name.')
    if (code.length < 6) return setErr('Enter the 6-character code from your invite.')
    setErr(''); setBusy(true)
    try {
      if (!(await sb.auth.getSession()).data.session) {
        const { error } = await sb.auth.signInAnonymously({ options: { data: { name: name.trim() } } })
        // If code-only sign-in is switched off, fall back to the email sign-in and come straight back here.
        if (error) { nav(`/login?next=${encodeURIComponent(`/join?code=${code}`)}`, { replace: true }); return }
      }
      await store.init()
      const u = store.getUser()
      if (u && !u.name) store.setUser({ ...u, name: name.trim() })
      await store.joinJob(code)
      nav('/setup', { replace: true })
    } catch (e) { setErr((e as Error).message || 'That did not work. Please try again.') } finally { setBusy(false) }
  }

  return (
    <Page className="min-h-full flex flex-col justify-center">
      <div className="flex gap-2 mb-5" aria-hidden><Dot tag="move" size={44} /><Dot tag="donate" size={44} /><Dot tag="sell" size={44} /><Dot tag="family" size={44} /></div>
      <h1 className="mb-3 text-[36px]">{from ? (scan ? `${from} asked you to scan the house.` : `${from} invited you to look at the list.`) : "You've been invited."}</h1>
      <p className="lead mb-7">{scan ? 'Walk through each room with your phone. That is all. ' + (from || 'They') + ' will decide where everything goes.' : 'See what is in the home and say what you would like.'}</p>
      <form onSubmit={go} className="flex flex-col gap-2">
        <label htmlFor="jname" className="font-medium text-[15px]">Your first name</label>
        <input id="jname" className="input" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="jcode" className="font-medium text-[15px] mt-2">Invite code</label>
        <input id="jcode" className="input text-center text-[24px] tracking-[0.25em] uppercase h-16" maxLength={6} autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        {info === 'bad' && <p role="alert" className="text-danger font-semibold">That code did not work or has expired. Ask for a new invite.</p>}
        {err && <p role="alert" className="text-danger font-semibold">{err}</p>}
        <button className="btn mt-3" type="submit" disabled={busy || info === 'bad'}>{busy ? 'Opening…' : scan ? 'Start scanning' : 'Open the list'}</button>
        <p className="text-ink-2 text-[14px] text-center mt-1">No account or password needed.</p>
      </form>
    </Page>
  )
}
