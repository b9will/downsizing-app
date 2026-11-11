// Tiny IndexedDB key-value store for photos waiting to upload. Far roomier than localStorage.
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const r = indexedDB.open('downsizing', 1)
  r.onupgradeneeded = () => r.result.createObjectStore('kv')
  r.onsuccess = () => resolve(r.result)
  r.onerror = () => reject(r.error)
})
let dbp: Promise<IDBDatabase> | undefined
const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
  dbp ??= open()
  const db = await dbp
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction('kv', mode).objectStore('kv'))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
export const idbGet = <T = string>(k: string) => tx<T | undefined>('readonly', (s) => s.get(k) as IDBRequest<T | undefined>)
export const idbSet = (k: string, v: unknown) => tx('readwrite', (s) => s.put(v, k))
export const idbDel = (k: string) => tx('readwrite', (s) => s.delete(k))
export const idbKeys = () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())
