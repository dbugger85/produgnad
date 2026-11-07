import type { ReactNode } from 'react'
import { kr } from '../lib/format'
import { ORDER_TYPE_LABEL, orderAmount, orderUnits, type Order } from '../lib/types'

type ProductRef = { id: string; name: string; sort_order: number }

/** Units per product over some orders, in product order, only products with units. */
export function unitsByProduct(orders: Order[], products: ProductRef[]) {
  const units = new Map<string, number>()
  for (const o of orders) for (const l of o.order_lines) units.set(l.product_id, (units.get(l.product_id) ?? 0) + l.qty)
  return [...products]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((p) => (units.get(p.id) ?? 0) > 0)
    .map((p) => ({ id: p.id, name: p.name, units: units.get(p.id) ?? 0 }))
}

/** "4 × Kaffe, 8 × Sokker" */
export function unitsText(rows: { name: string; units: number }[]) {
  return rows.map((r) => `${r.units} × ${r.name}`).join(', ')
}

/** Product totals as big numbers, for counting goods */
export function UnitsTable({ rows }: { rows: { id: string; name: string; units: number }[] }) {
  return (
    <ul className="divide-y divide-line/70">
      {rows.map((r) => (
        <li key={r.id} className="flex items-baseline justify-between gap-3 py-1.5">
          <span>{r.name}</span>
          <span className="text-lg font-bold tabular-nums">{r.units} stk</span>
        </li>
      ))}
    </ul>
  )
}

/** "3 av 7 pakket" with a thin bar */
export function PackedProgress({ done, total, noun }: { done: number; total: number; noun: string }) {
  const all = total > 0 && done === total
  return (
    <div className="space-y-1.5">
      <p className={`font-semibold ${all ? 'text-green-800' : ''}`}>
        {all ? `Alt er pakket (${total} ${noun})` : `${done} av ${total} ${noun} pakket`}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-line/70">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${all ? 'bg-green-700' : 'bg-brand'}`}
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  )
}

/** One tappable row with a big tick circle. The whole row toggles. */
export function CheckRow({
  checked,
  onToggle,
  disabled = false,
  children,
  aside,
}: {
  checked: boolean
  onToggle: () => void
  disabled?: boolean
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-1 transition-colors ${
        checked ? 'bg-cream/70 ring-line/60' : 'bg-white ring-line'
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base font-bold transition-colors ${
          checked ? 'bg-brand text-white' : 'ring-2 ring-ink/30'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      <span className={`min-w-0 flex-1 ${checked ? 'text-muted' : ''}`}>{children}</span>
      {aside && <span className={`shrink-0 text-right text-sm ${checked ? 'text-muted' : ''}`}>{aside}</span>}
    </button>
  )
}

/** One parent's list, one row per order (per friend). Tick when that order is packed. */
export function OrderPackingList({
  orders,
  products,
  packed,
  onToggle,
}: {
  orders: Order[]
  products: ProductRef[]
  packed: (o: Order) => boolean
  onToggle: (o: Order) => void
}) {
  const sorted = [
    ...orders.filter((o) => o.type === 'friend').sort((a, b) => a.buyer_first_name.localeCompare(b.buyer_first_name, 'nb')),
    ...orders.filter((o) => o.type !== 'friend'),
  ]
  if (sorted.length === 0) return <p className="text-muted">Ingen bestillinger</p>
  return (
    <div className="space-y-2">
      {sorted.map((o) => {
        const done = packed(o)
        return (
          <CheckRow
            key={o.id}
            checked={done}
            onToggle={() => onToggle(o)}
            aside={
              <>
                <span className="block font-semibold">{orderUnits(o)} stk</span>
                {o.type === 'friend' && (
                  <span className={`block text-xs ${o.paid_to_parent_at || done ? '' : 'font-semibold text-amber-800'}`}>
                    {o.paid_to_parent_at ? 'betalt' : `ikke betalt, ${kr(orderAmount(o))}`}
                  </span>
                )}
              </>
            }
          >
            <span className={`block font-semibold ${done ? 'line-through decoration-ink/30' : ''}`}>
              {o.type === 'friend' ? o.buyer_first_name : ORDER_TYPE_LABEL[o.type]}{' '}
              <span className="font-normal text-muted">· {o.code}</span>
            </span>
            <span className="block text-sm">{unitsText(unitsByProduct([o], products))}</span>
            {o.note && <span className="block text-sm italic text-muted">{o.note}</span>}
          </CheckRow>
        )
      })}
    </div>
  )
}
