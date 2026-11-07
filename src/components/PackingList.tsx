import { kr, longDate, phone } from '../lib/format'
import { ORDER_TYPE_LABEL, orderAmount, orderUnits, type Order } from '../lib/types'

export interface PackingParent {
  name: string
  phone: string
  child_first_name: string
  payment_code: string
}

/**
 * One parent's packing list: what the admins put in the parent's bag, and what goes to whom.
 * Made for paper too (one parent per printed page).
 */
export function PackingList({
  campaignName,
  organizer,
  parent,
  orders,
  products,
}: {
  campaignName: string
  organizer: string
  parent: PackingParent
  orders: Order[]
  products: { id: string; name: string; sort_order: number }[]
}) {
  const sorted = [...products].sort((a, b) => a.sort_order - b.sort_order)
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? 'vare'
  const units = Object.fromEntries(sorted.map((p) => [p.id, 0]))
  for (const o of orders) for (const l of o.order_lines) units[l.product_id] = (units[l.product_id] ?? 0) + l.qty
  const total = Object.values(units).reduce((a, b) => a + b, 0)

  const friends = orders
    .filter((o) => o.type === 'friend')
    .sort((a, b) => a.buyer_first_name.localeCompare(b.buyer_first_name, 'nb'))
  const others = orders.filter((o) => o.type !== 'friend')

  const lines = (o: Order) => o.order_lines.map((l) => `${l.qty} × ${name(l.product_id)}`).join(', ')

  return (
    <article className="packing space-y-4 rounded-[20px] bg-white p-5 ring-1 ring-line print:rounded-none print:p-0 print:ring-0">
      <header className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-xs text-muted">
            {organizer} · {campaignName}
          </p>
          <h2 className="font-display text-3xl leading-tight uppercase tracking-wide">Pakkeliste: {parent.name}</h2>
          <p className="text-sm text-muted">
            {parent.child_first_name && `${parent.child_first_name} · `}
            {phone(parent.phone)} · {parent.payment_code}
          </p>
        </div>
        <p className="text-right text-xs text-muted">Skrevet ut {longDate(new Date())}</p>
      </header>

      <section>
        <h3 className="mb-1 font-semibold">Til {parent.name.split(' ')[0]} ({total} stk)</h3>
        <table className="w-full text-sm">
          <tbody>
            {sorted
              .filter((p) => units[p.id] > 0)
              .map((p) => (
                <tr key={p.id} className="border-b border-line/70">
                  <td className="py-1.5">
                    <span className="mr-2 inline-block h-4 w-4 translate-y-0.5 rounded border border-ink/40" />
                    {p.name}
                  </td>
                  <td className="py-1.5 text-right text-base font-bold tabular-nums">{units[p.id]} stk</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="mb-1 font-semibold">Fordeling</h3>
        {orders.length === 0 && <p className="text-sm text-muted">Ingen bestillinger.</p>}
        <table className="w-full text-sm">
          <tbody>
            {[...friends, ...others].map((o) => (
              <tr key={o.id} className="border-b border-line/70 align-top">
                <td className="w-7 py-1.5">
                  <span
                    className={`inline-block h-4 w-4 translate-y-0.5 rounded border border-ink/40 text-center text-[11px] leading-[14px] ${o.delivered_at ? 'bg-brand text-white' : ''}`}
                  >
                    {o.delivered_at ? '✓' : ''}
                  </span>
                </td>
                <td className="py-1.5">
                  <span className="font-semibold">
                    {o.code} · {o.type === 'friend' ? o.buyer_first_name : ORDER_TYPE_LABEL[o.type]}
                  </span>
                  <span className="block text-muted">{lines(o)}</span>
                  {o.note && <span className="block italic text-muted">{o.note}</span>}
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  <span className="block">{orderUnits(o)} stk</span>
                  {o.type === 'friend' && (
                    <span className={`block text-xs ${o.paid_to_parent_at ? 'text-green-700' : 'font-semibold text-amber-800'}`}>
                      {o.paid_to_parent_at ? 'betalt' : `ikke betalt, ${kr(orderAmount(o))}`}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  )
}
