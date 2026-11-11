import { useEffect, useState } from 'react'
import { store } from './store'

/** Re-render when the store changes. */
export function useStore<T>(select: () => T): T {
  const [, tick] = useState(0)
  useEffect(() => store.subscribe(() => tick((n) => n + 1)), [])
  return select()
}

/** Shrink a photo before saving so localStorage stays small. */
export function fileToDataUrl(file: File, maxSide = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no canvas'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}
