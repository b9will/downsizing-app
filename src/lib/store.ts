// Data layer. Cloud-first (Supabase) with a local cache and an outbox, so the app
// keeps working in a basement with no signal and catches up when it reconnects.
// Pages read synchronously from memory; writes apply locally first, then sync.
import type { RealtimeChannel, User as AuthUser } from '@supabase/supabase-js'
import { sb } from './supabase'
import { idbDel, idbGet, idbSet } from './idb'
import type { Item, ItemEvent, ItemStatus, Job, JobMode, Room, User } from './types'

const CACHE = 'downsizing.cache.v2'
const OUTBOX = 'downsizing.outbox.v2'
const ACTIVE = 'downsizing.activeJob'

interface DB { user: User | null; job: Job | null; jobs: Job[]; rooms: Room[]; items: Item[] }
type Op =
  | { k: 'upsert'; t: 'jobs' | 'rooms' | 'items'; id: string; row: Record<string, unknown>; n?: number }
  | { k: 'delete'; t: 'jobs' | 'rooms' | 'items'; id: string; n?: number }
  | { k: 'upload'; id: string; path: string; n?: number }
  | { k: 'event'; id: string; row: Record<string, unknown>; n?: number }

export const uid = () => crypto.randomUUID()
export const now = () => new Date().toISOString()

// Row mapping
const jobFrom = (r: any): Job => ({ id: r.id, ownerId: r.owner_id, clientName: r.client_name, tier: r.tier, moveDate: r.move_date, tagDeadline: r.tag_deadline, status: r.status, stickerKit: r.sticker_kit, createdAt: r.created_at, details: r.details && Object.keys(r.details).length ? r.details : undefined })
const jobTo = (j: Job) => ({ id: j.id, owner_id: j.ownerId, client_name: j.clientName, tier: j.tier, move_date: j.moveDate || j.details?.moveDate || null, tag_deadline: j.tagDeadline, status: j.status, sticker_kit: j.stickerKit, details: j.details ?? {} })
const roomFrom = (r: any): Room => ({ id: r.id, jobId: r.job_id, name: r.name, order: r.ord, done: r.done })
const roomTo = (r: Room) => ({ id: r.id, job_id: r.jobId, name: r.name, ord: r.order, done: r.done })
const itemFrom = (r: any): Item => ({ id: r.id, jobId: r.job_id, roomId: r.room_id, name: r.name, tag: r.tag, size: r.size, photoPath: r.photo_path ?? undefined, note: r.note ?? undefined, familyRecipient: r.family_recipient ?? undefined, sticker: r.sticker ?? undefined, status: r.status, statusNote: r.status_note ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at })
const itemTo = (i: Item) => ({ id: i.id, job_id: i.jobId, room_id: i.roomId, name: i.name, tag: i.tag, size: i.size, photo_path: i.photoPath ?? null, note: i.note ?? null, family_recipient: i.familyRecipient ?? null, sticker: i.sticker?.trim() || null, status: i.status ?? 'tagged', status_note: i.statusNote ?? null })

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* cache is best effort */ } }

const dataUrlToBlob = async (u: string) => (await fetch(u)).blob()

class CloudStore {
  private db: DB = { user: null, job: null, jobs: [], rooms: [], items: [] }
  private subs = new Set<() => void>()
  private outbox: Op[] = read<Op[]>(OUTBOX, [])
  private urls = new Map<string, string>() // photo path -> signed URL
  private local = new Map<string, string>() // item id -> data URL waiting to upload
  private channel: RealtimeChannel | null = null
  private flushing = false
  ready = false
  online = typeof navigator === 'undefined' ? true : navigator.onLine
  lastError = ''
  /** The last change the server refused, in words, for a gentle notice. */
  refused = ''

  constructor() {
    const cached = read<DB | null>(CACHE, null)
    if (cached) this.db = { ...this.db, ...cached }
    window.addEventListener('online', () => { this.online = true; this.emit(); void this.flush() })
    window.addEventListener('offline', () => { this.online = false; this.emit() })
    setInterval(() => { if (this.outbox.length) void this.flush() }, 15000)
    sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') this.clear() })
    void this.init()
  }

  // ---------- lifecycle ----------
  async init() {
    const { data } = await sb.auth.getSession()
    const session = data.session
    if (!session) { this.clear(); return }
    if (this.db.user?.id === session.user.id) { this.ready = true; this.emit() } // show cache instantly
    else this.db = { user: null, job: null, jobs: [], rooms: [], items: [] }
    try { await this.refresh(session.user) } catch (e) { this.lastError = String(e) }
    this.ready = true; this.emit()
    void this.flush()
  }

  async refresh(au?: AuthUser) {
    const authUser = au ?? (await sb.auth.getUser()).data.user
    if (!authUser) return
    const { data: p } = await sb.from('profiles').select('*').eq('id', authUser.id).maybeSingle()
    this.db.user = { id: authUser.id, email: authUser.email ?? '', name: p?.name || authUser.user_metadata?.name || '', role: p?.role ?? 'client' }
    if (this.db.user.role === 'client') {
      const { data: jobs } = await sb.from('jobs').select('*').neq('status', 'cancelled').order('created_at', { ascending: false })
      this.db.jobs = (jobs ?? []).map(jobFrom)
      const pick = this.db.jobs.find((j) => j.id === localStorage.getItem(ACTIVE)) ?? this.db.jobs.find((j) => j.ownerId === authUser.id) ?? this.db.jobs[0]
      if (pick) await this.loadJob(pick.id); else { this.db.job = null; this.db.rooms = []; this.db.items = [] }
    } else {
      await this.loadJobs()
      const active = localStorage.getItem(ACTIVE)
      if (active && this.db.jobs.some((j) => j.id === active)) await this.loadJob(active)
    }
    this.persist()
  }

  async loadJobs() {
    const { data } = await sb.from('jobs').select('*').neq('status', 'cancelled').order('move_date', { ascending: true, nullsFirst: false })
    this.db.jobs = (data ?? []).map(jobFrom)
    this.emit()
  }

  /** Make a job the active one and load its rooms and items. */
  async loadJob(id: string) {
    const [{ data: j }, { data: rooms }, { data: items }] = await Promise.all([
      sb.from('jobs').select('*').eq('id', id).single(),
      sb.from('rooms').select('*').eq('job_id', id).order('ord'),
      sb.from('items').select('*').eq('job_id', id),
    ])
    if (!j) return
    const pending = new Set(this.outbox.map((o) => o.id))
    const keepLocal = (list: { id: string }[]) => list.filter((x) => pending.has(x.id))
    this.db.job = pending.has(id) && this.db.job?.id === id ? this.db.job : jobFrom(j)
    this.db.rooms = [...(rooms ?? []).map(roomFrom).filter((r) => !pending.has(r.id)), ...keepLocal(this.db.rooms.filter((r) => r.jobId === id)) as Room[]]
    this.db.items = [...(items ?? []).map(itemFrom).filter((i) => !pending.has(i.id)), ...keepLocal(this.db.items.filter((i) => i.jobId === id)) as Item[]]
    localStorage.setItem(ACTIVE, id)
    await this.restoreLocalPhotos()
    await this.signPhotos()
    this.watch(id)
    this.persist(); this.emit()
  }

  private watch(jobId: string) {
    if (this.channel) void sb.removeChannel(this.channel)
    const pending = () => new Set(this.outbox.map((o) => o.id))
    this.channel = sb.channel(`job-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `job_id=eq.${jobId}` }, async (p) => {
        if (p.eventType === 'DELETE') { this.db.items = this.db.items.filter((i) => i.id !== (p.old as any).id) }
        else { const it = itemFrom(p.new); if (pending().has(it.id)) return; this.upsertLocal('items', it); await this.signPhotos() }
        this.persist(); this.emit()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `job_id=eq.${jobId}` }, (p) => {
        if (p.eventType === 'DELETE') this.db.rooms = this.db.rooms.filter((r) => r.id !== (p.old as any).id)
        else { const r = roomFrom(p.new); if (!pending().has(r.id)) this.upsertLocal('rooms', r) }
        this.persist(); this.emit()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` }, (p) => {
        if (!pending().has(jobId)) { this.db.job = jobFrom(p.new); this.persist(); this.emit() }
      })
      .subscribe()
  }

  private async signPhotos() {
    const need = [...new Set(this.db.items.map((i) => i.photoPath).filter((p): p is string => !!p && !this.urls.has(p)))]
    for (let k = 0; k < need.length; k += 100) {
      const { data } = await sb.storage.from('photos').createSignedUrls(need.slice(k, k + 100), 60 * 60 * 12)
      data?.forEach((d) => { if (d.path && d.signedUrl) this.urls.set(d.path, d.signedUrl) })
    }
  }
  private async restoreLocalPhotos() {
    for (const o of this.outbox) if (o.k === 'upload' && !this.local.has(o.id)) { const u = await idbGet<string>(`photo:${o.id}`); if (u) this.local.set(o.id, u) }
  }
  photoUrl(path?: string) { return path ? this.urls.get(path) : undefined }

  private clear() {
    if (this.channel) void sb.removeChannel(this.channel)
    this.db = { user: null, job: null, jobs: [], rooms: [], items: [] }
    try { localStorage.removeItem(CACHE); localStorage.removeItem(ACTIVE) } catch { /* ignore */ }
    this.ready = true; this.emit()
  }
  private persist() {
    // Photos stay out of localStorage; they live in IndexedDB or the cloud.
    write(CACHE, { ...this.db, items: this.db.items.map(({ photo: _p, ...rest }) => rest) })
  }
  private emit() { this.subs.forEach((fn) => fn()) }
  subscribe(fn: () => void) { this.subs.add(fn); return () => { this.subs.delete(fn) } }

  // ---------- sync ----------
  private queue(op: Op) {
    // Collapse repeated upserts of the same row.
    if (op.k === 'upsert') this.outbox = this.outbox.filter((o) => !(o.k === 'upsert' && o.id === op.id))
    if (op.k === 'delete') this.outbox = this.outbox.filter((o) => !((o.k === 'upsert' || o.k === 'upload') && o.id === op.id))
    this.outbox.push(op)
    write(OUTBOX, this.outbox)
    this.emit()
    void this.flush()
  }
  pending() { return this.outbox.length }

  async flush() {
    if (this.flushing || !this.outbox.length) return
    this.flushing = true
    try {
      while (this.outbox.length) {
        const op = this.outbox[0]
        const err = await this.run(op)
        if (err) {
          op.n = (op.n ?? 0) + 1
          this.lastError = err
          const network = /fetch|network|timeout|load failed|offline|abort|5\d\d/i.test(err)
          // Network trouble: keep it and retry later. A refusal (permissions, rules): drop it and
          // reload from the server so the screen shows the truth.
          if (network && op.n < 50) { write(OUTBOX, this.outbox); break }
          console.warn('Change refused', op, err)
          this.refused = err
          const jobId = this.db.job?.id
          if (jobId) setTimeout(() => void this.loadJob(jobId), 0)
        }
        this.outbox.shift(); write(OUTBOX, this.outbox); this.emit()
      }
    } finally { this.flushing = false; this.emit() }
  }

  private async run(op: Op): Promise<string | null> {
    try {
      if (op.k === 'upsert') { const { error } = await sb.from(op.t).upsert(op.row); return error?.message ?? null }
      if (op.k === 'delete') { const { error } = await sb.from(op.t).delete().eq('id', op.id); return error?.message ?? null }
      if (op.k === 'event') { const { error } = await sb.from('item_events').insert(op.row); return error?.message ?? null }
      const url = this.local.get(op.id) ?? (await idbGet<string>(`photo:${op.id}`))
      if (!url) return null
      const { error } = await sb.storage.from('photos').upload(op.path, await dataUrlToBlob(url), { upsert: true, contentType: 'image/jpeg' })
      if (error) return error.message
      await idbDel(`photo:${op.id}`)
      return null
    } catch (e) { return String(e) }
  }

  private upsertLocal<T extends { id: string }>(k: 'rooms' | 'items', row: T) {
    const list = this.db[k] as unknown as T[]
    const i = list.findIndex((x) => x.id === row.id)
    const next = [...list]; if (i >= 0) next[i] = row; else next.push(row)
    ;(this.db[k] as unknown as T[]) = next
  }

  // ---------- reads ----------
  getUser() { return this.db.user }
  getJob() { return this.db.job }
  listJobs() { return this.db.jobs }
  listRooms(jobId: string) { return this.db.rooms.filter((r) => r.jobId === jobId).sort((a, b) => a.order - b.order) }
  listItems(jobId: string, roomId?: string) {
    return this.db.items
      .filter((i) => i.jobId === jobId && (!roomId || i.roomId === roomId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => ({ ...i, photo: this.local.get(i.id) ?? this.photoUrl(i.photoPath) }))
  }
  getItem(id: string) { const i = this.db.items.find((x) => x.id === id); return i ? { ...i, photo: this.local.get(i.id) ?? this.photoUrl(i.photoPath) } : null }
  async listEvents(itemId: string): Promise<ItemEvent[]> {
    const { data } = await sb.from('item_events').select('*').eq('item_id', itemId).order('at', { ascending: false })
    const paths = (data ?? []).map((e) => e.photo_path).filter(Boolean)
    const signed = new Map<string, string>()
    if (paths.length) (await sb.storage.from('photos').createSignedUrls(paths, 3600)).data?.forEach((d) => d.path && d.signedUrl && signed.set(d.path, d.signedUrl))
    return (data ?? []).map((e) => ({ id: e.id, itemId: e.item_id, status: e.status, note: e.note ?? undefined, photo: e.photo_path ? signed.get(e.photo_path) : undefined, byLabel: e.by_label ?? undefined, at: e.at }))
  }

  // ---------- writes ----------
  setUser(u: User | null) {
    if (!u) { void sb.auth.signOut(); this.clear(); return }
    this.db.user = u; this.persist(); this.emit()
    void sb.from('profiles').update({ name: u.name }).eq('id', u.id)
  }
  saveJob(j: Job) {
    this.db.job = j
    this.db.jobs = this.db.jobs.some((x) => x.id === j.id) ? this.db.jobs.map((x) => (x.id === j.id ? j : x)) : [j, ...this.db.jobs]
    this.persist(); this.emit()
    this.queue({ k: 'upsert', t: 'jobs', id: j.id, row: jobTo(j) })
  }
  saveRoom(r: Room) { this.upsertLocal('rooms', r); this.persist(); this.emit(); this.queue({ k: 'upsert', t: 'rooms', id: r.id, row: roomTo(r) }) }
  deleteRoom(id: string) {
    this.db.rooms = this.db.rooms.filter((r) => r.id !== id)
    this.db.items = this.db.items.filter((i) => i.roomId !== id)
    this.persist(); this.emit(); this.queue({ k: 'delete', t: 'rooms', id })
  }
  /** Saves locally at once. A new photo is kept in IndexedDB and uploaded in the background. */
  saveItem(input: Item, _requirePersistence = false) {
    const i: Item = { ...input, status: input.status ?? 'tagged', updatedAt: now() }
    if (i.photo?.startsWith('data:') && (!i.photoPath || this.local.get(i.id) !== i.photo)) {
      i.photoPath = `${i.jobId}/${i.id}-${Date.now().toString(36)}.jpg`
      this.local.set(i.id, i.photo)
      void idbSet(`photo:${i.id}`, i.photo)
      this.queue({ k: 'upload', id: i.id, path: i.photoPath })
    }
    const { photo: _p, ...row } = i
    this.upsertLocal('items', row as Item)
    this.persist(); this.emit()
    this.queue({ k: 'upsert', t: 'items', id: i.id, row: itemTo(i) })
  }
  deleteItem(id: string) {
    this.db.items = this.db.items.filter((i) => i.id !== id)
    this.local.delete(id); void idbDel(`photo:${id}`)
    this.persist(); this.emit(); this.queue({ k: 'delete', t: 'items', id })
  }
  /** Crew status change with an optional proof photo and note. */
  setStatus(item: Item, status: ItemStatus, note?: string, photo?: string) {
    this.saveItem({ ...item, photo: undefined, status, statusNote: note || undefined })
    if (photo) {
      const eid = uid(); const path = `${item.jobId}/proof/${eid}.jpg`
      this.local.set(eid, photo); void idbSet(`photo:${eid}`, photo)
      this.queue({ k: 'upload', id: eid, path })
      this.queue({ k: 'event', id: eid, row: { id: eid, item_id: item.id, job_id: item.jobId, status: 'photo', note: note ?? null, photo_path: path, by_user: this.db.user?.id, by_label: this.db.user?.name } })
    }
  }

  // ---------- account ----------
  async claimStaff(code: string) {
    const { data, error } = await sb.rpc('claim_staff', { p_code: code })
    if (error) throw new Error(error.message)
    await this.refresh(); this.emit(); return data as string
  }
  async joinJob(code: string) {
    const { data, error } = await sb.rpc('join_job', { p_code: code })
    if (error) throw new Error(error.message)
    await this.refresh(); await this.loadJob(data as string); return data as string
  }
  async invite(relation: 'family' | 'executor' = 'family') {
    const job = this.db.job; if (!job) throw new Error('No job')
    await this.flush()
    const { data, error } = await sb.from('job_invites').insert({ job_id: job.id, relation, created_by: this.db.user?.id }).select('code').single()
    if (error) throw new Error(error.message)
    return data.code as string
  }
  async guestLink(scope: unknown, label: string) {
    const job = this.db.job; if (!job) throw new Error('No job')
    await this.flush()
    const { data, error } = await sb.from('guest_links').insert({ job_id: job.id, scope, label, created_by: this.db.user?.id }).select('token').single()
    if (error) throw new Error(error.message)
    return `${location.origin}/g/${data.token}`
  }
}

export const store = new CloudStore()

const DEFAULT_ROOMS = ['Living room', 'Kitchen', 'Dining room', 'Primary bedroom', 'Second bedroom', 'Bathroom', 'Basement', 'Garage']

/** Remove every room and item of a job and recreate the default rooms. Account and details stay. */
export function resetJob(jobId: string) {
  const job = store.getJob()
  store.listItems(jobId).forEach((i) => store.deleteItem(i.id))
  store.listRooms(jobId).forEach((r) => store.deleteRoom(r.id))
  if (job) store.saveJob({ ...job, status: 'tagging', tagDeadline: new Date(Date.now() + 14 * 86400000).toISOString() })
  DEFAULT_ROOMS.forEach((name, order) => store.saveRoom({ id: uid(), jobId, name, order, done: false }))
}

/** Cancel this job and sign out. Our team keeps the record of anything already sent. */
export async function wipeAll() {
  const job = store.getJob()
  if (job) { store.saveJob({ ...job, status: 'cancelled' }); await store.flush() }
  try { localStorage.removeItem(OUTBOX) } catch { /* ignore */ }
  store.setUser(null)
  location.assign('/login')
}

/** Start a job for this account. `clientName` is whose home it is (a parent, or the estate). */
export function createJob(user: User, mode: JobMode, clientName?: string, stickerKit = false): Job {
  const job: Job = {
    id: uid(), ownerId: user.id, clientName: clientName?.trim() || user.name, tier: 'clear-move', moveDate: null,
    tagDeadline: new Date(Date.now() + 14 * 86400000).toISOString(), status: 'tagging', stickerKit, createdAt: now(),
    details: mode === 'self' ? undefined : { phone: '', email: '', currentAddress: '', newAddress: '', moveDate: '', contactName: user.name, contactRelation: mode === 'estate' ? 'Executor' : '', contactPhone: '', charity: '', charityAddress: '', accessNotes: '', mode },
  }
  store.saveJob(job)
  DEFAULT_ROOMS.forEach((name, order) => store.saveRoom({ id: uid(), jobId: job.id, name, order, done: false }))
  return job
}
/** Back-compat for screens that just need a job to exist. */
export function ensureJob(user: User): Job { return store.getJob() ?? createJob(user, 'self') }
