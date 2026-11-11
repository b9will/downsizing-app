import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { Page } from '../components/ui'
import { cameraSupported, requestCamera } from '../lib/camera'

// Asked once, right after sign-in, with a reason. iOS remembers the answer for this site.
export default function CameraSetup() {
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const supported = cameraSupported()

  const allow = async () => {
    setBusy(true)
    const ok = await requestCamera()
    setBusy(false)
    if (ok) nav('/', { replace: true }); else setDenied(true)
  }

  const skip = () => { try { localStorage.setItem('downsizing.cameraGranted', '1') } catch { /* ignore */ } nav('/', { replace: true }) }

  return (
    <Page className="min-h-full flex flex-col justify-center">
      <div className="w-14 h-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-5"><Camera size={28} /></div>
      <h1 className="mb-2">Your camera does the work</h1>
      <p className="lead mb-8">Point your phone at anything in a room. It recognizes the item, you tap one button to say what happens to it. No typing, no camera roll.</p>
      {denied && <p className="text-danger font-semibold mb-4" role="alert">Camera was blocked. You can turn it on later in Settings, or carry on with photos from your library.</p>}
      {!supported && <p className="text-ink-2 mb-4">Live camera isn't available on this connection. You can still add photos from your library.</p>}
      <button className="btn" disabled={busy || !supported} onClick={allow}>{busy ? 'Asking…' : 'Allow camera'}</button>
      <button className="btn btn-ghost mt-1" onClick={skip}>Not now</button>
    </Page>
  )
}
