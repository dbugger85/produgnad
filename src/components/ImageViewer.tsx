import { useEffect, useState } from 'react'
import { imageUrl } from '../lib/supabase'
import type { ProductImage } from '../lib/types'

/** Full-screen picture viewer. Tap outside or × to close; arrows for more pictures. */
export function ImageViewer({
  images,
  title,
  onClose,
}: {
  images: ProductImage[]
  title: string
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length)
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images.length, onClose])

  const image = images[index]
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-label={title} onClick={onClose}>
      <div className="flex items-center justify-between p-3 text-white">
        <span className="font-semibold">{title}</span>
        <button type="button" className="h-11 w-11 text-3xl" aria-label="Lukk" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-2">
        <img
          src={imageUrl(image.path)}
          alt={title}
          className="max-h-full max-w-full rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-2 p-3" onClick={(e) => e.stopPropagation()}>
          {images.map((img, i) => (
            <button
              key={img.path}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-14 w-14 overflow-hidden rounded-lg ring-2 ${i === index ? 'ring-white' : 'ring-transparent opacity-60'}`}
              aria-label={`Bilde ${i + 1}`}
            >
              <img src={imageUrl(img.thumb)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
