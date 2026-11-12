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

type ZoomCaps = { zoom?: { min: number; max: number } }
type Wide = { kind: 'zoom'; min: number } | { kind: 'device'; id: string } | null

/** Attach a live rear-camera stream to a <video>. Stops it on unmount.
 *  Also finds the ultra-wide (0.5x) lens when the phone has one, either as a zoom range on the
 *  main camera or as its own camera, and lets the screen switch to it. */
export function useCamera(active: boolean, opts: { preferWide?: boolean } = {}) {
  const video = useRef<HTMLVideoElement>(null)
  const track = useRef<MediaStreamTrack | null>(null)
  const [state, setState] = useState<CameraState>('idle')
  const [wide, setWide] = useState<Wide>(null)
  const [wideOn, setWideOn] = useState(false)
  const wantWide = useRef(Boolean(opts.preferWide))
  const deviceId = wideOn && wide?.kind === 'device' ? wide.id : null

  useEffect(() => {
    if (!active) return
    if (!cameraSupported()) { setState('unsupported'); return }
    let stream: MediaStream | undefined
    let on = true
    setState((s) => (s === 'live' ? s : 'starting'))
    const c: MediaStreamConstraints = deviceId ? { audio: false, video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } } : constraints
    navigator.mediaDevices.getUserMedia(c)
      .then(async (s) => {
        if (!on) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        const v = video.current
        if (!v) return
        v.srcObject = s
        v.onloadedmetadata = () => { v.play().catch(() => {}); setState('live') }
        try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
        const t = s.getVideoTracks()[0]; track.current = t
        if (deviceId) return // already on the ultra-wide camera
        // 1. Newer phones expose 0.5x as a zoom range on the main camera.
        const caps = (t.getCapabilities?.() ?? {}) as ZoomCaps
        if (caps.zoom && caps.zoom.min < 1) {
          const w: Wide = { kind: 'zoom', min: caps.zoom.min }
          setWide(w)
          if (wantWide.current) { wantWide.current = false; try { await t.applyConstraints({ advanced: [{ zoom: w.min } as MediaTrackConstraintSet] }); setWideOn(true) } catch { /* stay at 1x */ } }
          return
        }
        // 2. Otherwise look for a separate ultra-wide camera.
        try {
          const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
          const uw = cams.find((d) => /ultra[\s-]?(wide|grand|weit)|ultragrand|0[.,]5/i.test(d.label) && !/front|avant/i.test(d.label))
          if (uw && on) { setWide({ kind: 'device', id: uw.deviceId }); if (wantWide.current) { wantWide.current = false; setWideOn(true) } }
        } catch { /* no list available */ }
      })
      .catch(() => { if (on) { if (deviceId) setWideOn(false); else setState('denied') } })
    return () => {
      on = false
      stream?.getTracks().forEach((t) => t.stop())
      if (video.current) video.current.srcObject = null
    }
  }, [active, deviceId])

  /** Switch between 1x and the widest lens. */
  const toggleWide = async () => {
    if (!wide) return
    const next = !wideOn
    if (wide.kind === 'zoom') { try { await track.current?.applyConstraints({ advanced: [{ zoom: next ? wide.min : 1 } as MediaTrackConstraintSet] }) } catch { return } }
    setWideOn(next)
  }

  return { video, state, canWide: wide !== null, wideOn, toggleWide }
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
