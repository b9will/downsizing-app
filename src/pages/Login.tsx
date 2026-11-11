import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Page } from '../components/ui'
import { sb } from '../lib/supabase'
import { store } from '../lib/store'

// Email a 6-digit code. No passwords to forget.
export default function Login() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'
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
    const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, data: { name: name.trim() }, emailRedirectTo: location.origin } })
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
      <img src="/icon.svg" alt="" width={48} height={48} className="rounded-xl mb-5" />
      <h1 className="mb-2">Downsizing Companion</h1>
      <p className="lead mb-8">Walk through the home. Point, tap, done. We take care of the rest.</p>

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
