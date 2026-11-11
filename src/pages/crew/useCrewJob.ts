import { useEffect, useState } from 'react'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/store'

/** Make the job in the URL the active one (loading it if needed). */
export function useCrewJob(jobId: string) {
  const job = useStore(() => store.getJob())
  const [loading, setLoading] = useState(job?.id !== jobId)
  useEffect(() => {
    if (store.getJob()?.id === jobId) { setLoading(false); return }
    setLoading(true)
    void store.loadJob(jobId).finally(() => setLoading(false))
  }, [jobId])
  const rooms = useStore(() => (job?.id === jobId ? store.listRooms(jobId) : []))
  const items = useStore(() => (job?.id === jobId ? store.listItems(jobId) : []))
  return { job: job?.id === jobId ? job : null, rooms, items, loading }
}
