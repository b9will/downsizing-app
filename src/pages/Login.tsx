import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dot, Page } from '../components/ui'
import { sb } from '../lib/supabase'
import { store } from '../lib/store'

// Email a 6-digit code. No passwords to forget.
export default function Login() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'
  // Which website page sent them here ("area-etobicoke-hero"), kept so we can see what brings people in.
  const src = (() => { try { const s = params.get('src'); if (s) localStorage.setItem('dot.src', s.slice(0, 80)); return localStorage.getItem('dot.src') ?? undefined } catch { return undefined } })()
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Please enter your name.')
    if (!/.+@.+\..+/.test(email)) return setError('That email does not look right.')
    setError(''); setBusy(true)
    const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, data: { name: name.trim(), src }, emailRedirectTo: location.origin } })
    setBusy(false)
    if (error) return setError(/rate/i.test(error.message) ? 'Too many codes sent. Wait a minute and try again.' : error.message)
    setStep('code')
  }
  // Staff and testing: sign in with a password instead of an emailed code.
  const withPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/.+@.+\..+/.test(email) || !password) return setError('Enter your email and password.')
    setError(''); setBusy(true)
    const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) { setBusy(false); return setError('That email and password did not match.') }
    await store.init()
    setBusy(false)
    nav(next, { replace: true })
  }
  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{6,8}$/.test(code)) return setError('Enter the numbers from your email.')
    setError(''); setBusy(true)
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' })
    if (error) { setBusy(false); return setError('That code did not work. Check the newest email, or send a new one.') }
    await store.init()
    const u = store.getUser()
    if (u && !u.name) store.setUser({ ...u, name: name.trim() })
    setBusy(false)
    nav(next, { replace: true })
  }

  return (
    <Page className="min-h-full flex flex-col justify-center">
      <div className="flex gap-2 mb-5" aria-hidden><Dot tag="move" size={44} /><Dot tag="donate" size={44} /><Dot tag="sell" size={44} /><Dot tag="family" size={44} /></div>
      <h1 className="mb-3 text-[40px]">Put a dot on it.<br />We do the rest.</h1>
      <p className="lead mb-8">Walk through the home with your phone. Choose where each thing goes. Our crew handles the moving, giving, selling and clearing.</p>

      {step === 'email' ? (
        <form onSubmit={sendCode} className="flex flex-col gap-2">
          <label htmlFor="name" className="font-medium text-[15px]">Your name</label>
          <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="email" className="font-medium text-[15px] mt-2">Email</label>
          <input id="email" className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p role="alert" className="text-danger font-semibold">{error}</p>}
          <button className="btn mt-3" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
          <p className="text-ink-2 text-[15px] text-center mt-1">No password. We email you a short code each time.</p>
          <button type="button" className="btn btn-ghost" onClick={() => { setStep('password'); setError('') }}>Sign in with a password</button>
        </form>
      ) : step === 'password' ? (
        <form onSubmit={withPassword} className="flex flex-col gap-2">
          <label htmlFor="pemail" className="font-medium text-[15px]">Email</label>
          <input id="pemail" className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="pw" className="font-medium text-[15px] mt-2">Password</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="text-danger font-semibold">{error}</p>}
          <button className="btn mt-3" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setStep('email'); setError('') }}>Email me a code instead</button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-2">
          <label htmlFor="code" className="font-medium text-[15px]">Code sent to {email}</label>
          <input id="code" className="input text-center text-[26px] tracking-[0.3em] h-16" inputMode="numeric" autoComplete="one-time-code" maxLength={8} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          {error && <p role="alert" className="text-danger font-semibold">{error}</p>}
          <button className="btn mt-2" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
          <button className="btn btn-ghost" type="button" onClick={() => { setStep('email'); setCode(''); setError('') }}>Send a new code</button>
          <p className="text-ink-2 text-[15px] text-center">Can't find it? Check junk mail. It can take a minute.</p>
        </form>
      )}
    </Page>
  )
}
