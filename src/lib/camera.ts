// Camera access: ask once after sign-in, remember the answer, hand out a stream fast.
import { useEffect, useRef, useState } from 'react'

const KEY = 'downsizing.cameraGranted'

export const cameraSupported = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext

export function cameraGrantedBefore(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

const constraints: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
}

/** Request permission. Resolves true if granted; stops the probe stream immediately. */
export async function requestCamera(): Promise<boolean> {
  if (!cameraSupported()) return false
  try {
    const s = await navigator.mediaDevices.getUserMedia(constraints)
    s.getTracks().forEach((t) => t.stop())
    try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
    return true
  } catch {
    return false
  }
}

export type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported'

/** Attach a live rear-camera stream to a <video>. Stops it on unmount. */
export function useCamera(active: boolean) {
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<CameraState>('idle')

  useEffect(() => {
    if (!active) return
    if (!cameraSupported()) { setState('unsupported'); return }
    let stream: MediaStream | undefined
    let on = true
    setState('starting')
    navigator.mediaDevices.getUserMedia(constraints)
      .then((s) => {
        if (!on) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        const v = video.current
        if (!v) return
        v.srcObject = s
        v.onloadedmetadata = () => { v.play().catch(() => {}); setState('live') }
        try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
      })
      .catch(() => { if (on) setState('denied') })
    return () => {
      on = false
      stream?.getTracks().forEach((t) => t.stop())
      if (video.current) video.current.srcObject = null
    }
  }, [active])

  return { video, state }
}

/** Grab the current frame as a JPEG data URL, scaled down for storage. */
export function snapshot(v: HTMLVideoElement, maxSide = 900, quality = 0.7): string | null {
  if (!v.videoWidth) return null
  const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(v.videoWidth * scale)
  c.height = Math.round(v.videoHeight * scale)
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(v, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}
