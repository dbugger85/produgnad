import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Card } from '../../components/ui'
import type { AdminData } from '../../lib/adminData'
import { kr, shortDateTimeText } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { ORDER_TYPE_LABEL, orderAmount, type Order, type OrderType } from '../../lib/types'

type StatusFilter = '' | 'ubetalt' | 'betalt' | 'levert'

export function OrdersTab({ data, reload }: { data: AdminData; reload: () => Promise<void> }) {
  const [parentId, setParentId] = useState('')
  const [type, setType] = useState<'' | OrderType>('')
  const [status, setStatus] = useState<StatusFilter>('')
  const names = useMemo(() => Object.fromEntries(data.products.map((p) => [p.id, p.name])), [data.products])
  const paymentCode = useMemo(() => Object.fromEntries(data.parents.map((p) => [p.id, p.payment_code])), [data.parents])
  const parentName = useMemo(
    () => Object.fromEntries(data.parents.map((p) => [p.id, p.profiles.name || p.profiles.email])),
    [data.parents],
  )

  const shown = data.orders.filter(
    (o) =>
      (!parentId || o.campaign_parent_id === parentId) &&
      (!type || o.type === type) &&
      (!status ||
        (status === 'ubetalt' && o.type === 'friend' && !o.paid_to_parent_at) ||
        (status === 'betalt' && !!o.paid_to_parent_at) ||
        (status === 'levert' && !!o.delivered_at)),
  )
  const sum = shown.reduce((s, o) => s + orderAmount(o), 0)

  async function toggle(o: Order, field: 'paid' | 'delivered', value: boolean) {
    if (field === 'paid') await supabase.rpc('set_order_paid', { p_order_id: o.id, p_paid: value })
    else await supabase.rpc('set_order_delivered', { p_order_id: o.id, p_delivered: value })
    await reload()
  }

  const select = 'rounded-xl border border-line bg-white px-2 py-2 text-sm'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <select className={select} value={parentId} onChange={(e) => setParentId(e.target.value)} aria-label="Forelder">
          <option value="">Alle foreldre</option>
          {data.parents.map((p) => (
            <option key={p.id} value={p.id}>
              {parentName[p.id]}
            </option>
          ))}
        </select>
        <select className={select} value={type} onChange={(e) => setType(e.target.value as OrderType | '')} aria-label="Type">
          <option value="">Alle typer</option>
          <option value="friend">Venn</option>
          <option value="own">Egen</option>
          <option value="extra">Ekstra</option>
        </select>
        <select className={select} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Status">
          <option value="">Alle</option>
          <option value="ubetalt">Ubetalt</option>
          <option value="betalt">Betalt</option>
          <option value="levert">Levert</option>
        </select>
      </div>
      <p className="text-sm text-muted">
        {shown.length} bestillinger, {kr(sum)}
      </p>
      {shown.map((o) => (
        <Card key={o.id} className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="font-bold">
              {paymentCode[o.campaign_parent_id]} · {o.code} · {o.type === 'friend' ? o.buyer_first_name : ORDER_TYPE_LABEL[o.type]}
            </span>
            <span className="font-bold">{kr(orderAmount(o))}</span>
          </div>
          <div className="text-muted">
            via {parentName[o.campaign_parent_id]} · {shortDateTimeText(o.created_at)}
          </div>
          <div className="text-muted">{o.order_lines.map((l) => `${l.qty} × ${names[l.product_id] ?? '?'}`).join(', ')}</div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {o.type !== 'friend' && <Badge>{ORDER_TYPE_LABEL[o.type]}</Badge>}
            {o.type === 'friend' && (
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-5 w-5 accent-[var(--color-brand)]" checked={!!o.paid_to_parent_at} onChange={(e) => void toggle(o, 'paid', e.target.checked)} />
                Betalt
              </label>
            )}
            {o.type === 'friend' && (
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-5 w-5 accent-[var(--color-brand)]" checked={!!o.delivered_at} onChange={(e) => void toggle(o, 'delivered', e.target.checked)} />
                Levert
              </label>
            )}
            <Link to={`/forelder/${o.campaign_parent_id}/ordre/${o.id}`} className="ml-auto font-semibold text-brand">
              Endre
            </Link>
          </div>
        </Card>
      ))}
    </div>
  )
}
