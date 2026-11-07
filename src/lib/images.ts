// Shrinks product pictures in the browser before upload: longest side 1200 px
// (thumbnail 400 px), aiming for under 200 kB. The large picture is JPEG, because link previews
// in WhatsApp and others don't show WebP; the thumbnail (used on the order page) is WebP where possible.

export interface Resized {
  blob: Blob
  width: number
  height: number
  ext: 'webp' | 'jpg'
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Fall through to <img> (older Safari).
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function encode(canvas: HTMLCanvasElement, maxBytes: number, allowWebp: boolean): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  // Safari may not encode WebP; it then returns PNG, so we check the type.
  let quality = 0.85
  const probe = allowWebp ? await toBlob(canvas, 'image/webp', quality) : null
  const useWebp = probe?.type === 'image/webp'
  const type = useWebp ? 'image/webp' : 'image/jpeg'
  let blob = useWebp ? probe! : (await toBlob(canvas, type, quality))!
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1
    blob = (await toBlob(canvas, type, quality))!
  }
  return { blob, ext: useWebp ? 'webp' : 'jpg' }
}

async function resizeFrom(
  source: ImageBitmap | HTMLImageElement,
  maxSide: number,
  maxBytes: number,
  allowWebp: boolean,
): Promise<Resized> {
  const w0 = 'naturalWidth' in source ? source.naturalWidth : source.width
  const h0 = 'naturalHeight' in source ? source.naturalHeight : source.height
  const scale = Math.min(1, maxSide / Math.max(w0, h0))
  const width = Math.round(w0 * scale)
  const height = Math.round(h0 * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  const { blob, ext } = await encode(canvas, maxBytes, allowWebp)
  return { blob, width, height, ext }
}

export async function prepareProductImage(file: File): Promise<{ main: Resized; thumb: Resized }> {
  if (!file.type.startsWith('image/')) throw new Error('Filen er ikke et bilde.')
  if (file.size > 25 * 1024 * 1024) throw new Error('Bildet er for stort.')
  const source = await loadBitmap(file)
  const main = await resizeFrom(source, 1200, 200 * 1024, false)
  const thumb = await resizeFrom(source, 400, 60 * 1024, true)
  if ('close' in source) source.close()
  return { main, thumb }
}
