import type { SizeClass } from './types'
import type { ObjectDetection } from '@tensorflow-models/coco-ssd'

let model: Promise<ObjectDetection> | undefined
let lastFail = 0
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const typicalSizes: Record<string, SizeClass> = {
  bed: 'large', refrigerator: 'large', oven: 'large', 'dining table': 'large',
  chair: 'medium', bicycle: 'large', microwave: 'medium', suitcase: 'medium',
  laptop: 'small', keyboard: 'small', bottle: 'small', book: 'small',
  bowl: 'small', cup: 'small', 'cell phone': 'small', vase: 'small',
}

export async function identifyItems(photo: string | HTMLVideoElement) {
  if (!model && Date.now() - lastFail < 30000) throw new Error('model unavailable')
  model ??= Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/coco-ssd')])
    .then(async ([tf, coco]) => {
      // Some phones hang on the GPU backend; give it a moment, then fall back to CPU.
      const ok = await Promise.race([tf.setBackend('webgl').then(() => tf.ready()).then(() => true).catch(() => false), wait(4000).then(() => false)])
      if (!ok) { await tf.setBackend('cpu'); await tf.ready() }
      // Never leave the camera stuck on "Warming up": give up after 15 seconds.
      return Promise.race([coco.load({ base: 'lite_mobilenet_v2' }), wait(15000).then(() => { throw new Error('model load timed out') })])
    })
    .catch((error) => {
      model = undefined
      lastFail = Date.now()
      throw error
    })

  const image = typeof photo === 'string' ? new Image() : photo
  if (typeof photo === 'string' && image instanceof HTMLImageElement) {
    image.src = photo
    await image.decode()
  }
  const detector = await model
  const width = image instanceof HTMLVideoElement ? image.videoWidth : image.naturalWidth
  const height = image instanceof HTMLVideoElement ? image.videoHeight : image.naturalHeight
  if (!width || !height) return []
  const detections = await detector.detect(image, 20, 0.55)
  const centerX = width / 2
  const centerY = height / 2
  return detections
    .filter(({ class: label }) => label !== 'person')
    .sort((a, b) => Number(coversCenter(b.bbox)) - Number(coversCenter(a.bbox)) || b.score - a.score)
    .slice(0, 5)
    .map(({ class: label, bbox }) => ({
      name: label === 'couch' ? 'Sofa' : label === 'tv' ? 'TV' : label[0].toUpperCase() + label.slice(1),
      size: typicalSizes[label],
      bounds: bbox.map((value, index) => value / (index % 2 === 0 ? width : height)),
      centered: coversCenter(bbox),
    }))

  function coversCenter([x, y, width, height]: number[]) {
    return centerX >= x && centerX <= x + width && centerY >= y && centerY <= y + height
  }
}
