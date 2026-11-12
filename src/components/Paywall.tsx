import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft } from 'lucide-react'
import { Dot } from './ui'
import { startCheckout } from '../lib/pay'
import { store } from '../lib/store'
import type { Job } from '../lib/types'

/** Shown when someone on the free plan reaches past their one free room. */
export function Paywall({ job, reason, back = '/', onOpen }: { job: Job; reason?: string; back?: string; onOpen?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const owner = job.ownerId === store.getUser()?.id
  const first = job.clientName.split(' ')[0]
  const go = async () => {
    setBusy(true); setMsg('')
    const r = await startCheckout('pass', job)
    setBusy(false)
    if (r.off) { onOpen?.(); return } // payments are not live yet: let them through
    setMsg(r.message)
  }
  return (
    <div className="page min-h-full flex flex-col gap-4">
      <Link to={back} aria-label="Back" className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center"><ChevronLeft size={22} /></Link>
      <div className="flex gap-2" aria-hidden><Dot tag="move" size={40} /><Dot tag="donate" size={40} /><Dot tag="sell" size={40} /><Dot tag="family" size={40} /></div>
      <h1 className="text-[34px]">Unlock the whole home</h1>
      <p className="lead">{reason ?? 'Your first room is free. The Home pass opens every room and everything else.'}</p>
      <ul className="flex flex-col gap-3 my-1">
        {['Scan every room, as many times as you need', 'Invite family and a helper to scan', 'Send lists to charities, consignment and storage', 'A photo inventory PDF of the whole home', 'We keep it all safe until the move is done'].map((t) => (
          <li key={t} className="flex items-center gap-2.5 text-[16px]"><span className="w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center shrink-0"><Check size={14} strokeWidth={3} /></span>{t}</li>
        ))}
      </ul>
      <div className="card">
        <div className="text-[34px] font-semibold tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)' }}>$29 <span className="text-ink-2 text-[18px] font-medium">a month</span></div>
        <p className="text-ink-2 text-[15px] mt-1.5">Cancel any time. If you book your move with us, what you paid comes off the price.</p>
      </div>
      {msg && <p role="alert" className="text-danger font-semibold">{msg}</p>}
      <div className="mt-auto flex flex-col gap-2">
        {owner ? <button className="btn" disabled={busy} onClick={go}>{busy ? 'Opening secure payment…' : 'Get the Home pass'}</button> : <p className="text-center font-semibold">Ask {first} to unlock the whole home.</p>}
        <p className="text-ink-2 text-[13px] text-center">Payment is handled by Stripe. We never see your card. <a className="underline" href="https://dot-toronto.vercel.app/terms" target="_blank" rel="noreferrer">Terms</a></p>
      </div>
    </div>
  )
}
