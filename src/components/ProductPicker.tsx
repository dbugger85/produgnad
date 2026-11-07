import { useState } from 'react'
import { kr } from '../lib/format'
import { imageUrl } from '../lib/supabase'
import type { PublicProduct } from '../lib/types'
import { ImageViewer } from './ImageViewer'
import { QtyStepper } from './QtyStepper'

export type Quantities = Record<string, number>

export function ProductPicker({
  products,
  quantities,
  onChange,
  maxQty,
}: {
  products: PublicProduct[]
  quantities: Quantities
  onChange: (next: Quantities) => void
  maxQty: number
}) {
  const [viewing, setViewing] = useState<PublicProduct | null>(null)
  return (
    <div className="space-y-3">
      {products.map((p) => {
        const main = p.images[0]
        return (
          <article key={p.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200">
            {main ? (
              <button
                type="button"
                className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100"
                onClick={() => setViewing(p)}
                aria-label={`Se bilde av ${p.name}`}
              >
                <img src={imageUrl(main.thumb)} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-3xl">☕</div>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="font-bold leading-tight">{p.name}</h3>
              {p.description && <p className="text-sm text-stone-600">{p.description}</p>}
              <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                <span className="font-bold">{kr(p.price)}</span>
                <QtyStepper
                  value={quantities[p.id] ?? 0}
                  max={maxQty}
                  label={p.name}
                  onChange={(n) => onChange({ ...quantities, [p.id]: n })}
                />
              </div>
            </div>
          </article>
        )
      })}
      {viewing && <ImageViewer images={viewing.images} title={viewing.name} onClose={() => setViewing(null)} />}
    </div>
  )
}

export function quantitiesTotal(products: Pick<PublicProduct, 'id' | 'price'>[], q: Quantities): number {
  return products.reduce((sum, p) => sum + (q[p.id] ?? 0) * Number(p.price), 0)
}

export function quantitiesToLines(q: Quantities) {
  return Object.entries(q)
    .filter(([, qty]) => qty > 0)
    .map(([product_id, qty]) => ({ product_id, qty }))
}
