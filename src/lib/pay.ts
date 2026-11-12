// Home pass and booking deposit. Card details are entered on Stripe's own page, never in this app.
import { sb } from './supabase'
import { store } from './store'
import type { Item, Job, Room } from './types'

/** Paid for, booked, or set up by our team: the whole home is open. */
export function isUnlocked(job: Job): boolean {
  return (job.plan === 'pass' && (!job.passUntil || new Date(job.passUntil) > new Date())) || !!job.depositPaidAt || job.status !== 'tagging' || job.stickerKit || payOff()
}
/** The free plan covers one room: the first one they scanned. Null means they have not picked yet. */
export function freeRoomId(rooms: Room[], items: Item[]): string | null {
  const first = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
  return first && rooms.some((r) => r.id === first.roomId) ? first.roomId : null
}
export const roomLocked = (job: Job, rooms: Room[], items: Item[], roomId: string) => { const f = freeRoomId(rooms, items); return !isUnlocked(job) && f !== null && f !== roomId }

// Until payments are switched on, nothing is locked. We learn that the first time a checkout is attempted.
const OFF = 'dot.pay.off'
const payOff = () => { try { return sessionStorage.getItem(OFF) === '1' } catch { return false } }

/** Sends the person to Stripe. Resolves with a message only if it could not. */
export async function startCheckout(kind: 'pass' | 'deposit', job: Job): Promise<{ off?: boolean; message: string }> {
  const { data, error } = await sb.functions.invoke('pay', { body: { action: 'start', kind, job_id: job.id, origin: location.origin } })
  if (data?.url) { location.href = data.url; return new Promise(() => {}) }
  let body: { error?: string; message?: string } | undefined
  try { body = await (error as { context?: Response })?.context?.json() } catch { /* ignore */ }
  if (body?.error === 'not_configured' || body?.error === 'no_price') { try { sessionStorage.setItem(OFF, '1') } catch { /* ignore */ } return { off: true, message: body.message ?? 'Payments are not switched on yet.' } }
  return { message: body?.message ?? 'We could not open the payment page. Check your connection and try again.' }
}

/** Back from Stripe: have the server check the payment and unlock the home. */
export async function confirmPaid(sessionId: string): Promise<{ ok: boolean; kind?: 'pass' | 'deposit'; message?: string }> {
  const { data } = await sb.functions.invoke('pay', { body: { action: 'confirm', session_id: sessionId } })
  if (data?.ok) await store.init()
  return data?.ok ? { ok: true, kind: data.kind } : { ok: false, message: data?.message ?? 'We could not confirm that payment. If you were charged, it will show up here shortly.' }
}
