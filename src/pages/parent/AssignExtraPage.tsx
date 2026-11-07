import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { QtyStepper } from '../../components/QtyStepper'
import { Button, Card, ErrorBox, Field, Input, Loading, Page, TopBar } from '../../components/ui'
import { errorText } from '../../lib/errors'
import { kr } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Order } from '../../lib/types'

/** /forelder/:cpId/fra-ekstra/:orderId: give units from an "Ekstra" order to a named buyer. */
export default function AssignExtraPage() {
  const { cpId = '', orderId = '' } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [names, setNames] = useState<Record<string, string>>({})
  const [qty, setQty] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [paid, setPaid] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('orders').select('*, order_lines(*)').eq('id', orderId).maybeSingle()
      const o = data as Order | null
      setOrder(o && o.type === 'extra' && !o.deleted_at ? o : null)
      if (o) {
        const { data: products } = await supabase.from('products').select('id, name').in('id', o.order_lines.map((l) => l.product_id))
        setNames(Object.fromEntries((products ?? []).map((p) => [p.id, p.name])))
      }
    }
    void load()
  }, [orderId])

  if (order === undefined) return <Loading />
  if (order === null) return <Page><ErrorBox>Fant ikke ekstrabestillingen</ErrorBox></Page>

  const total = order.order_lines.reduce((s, l) => s + (qty[l.product_id] ?? 0) * Number(l.unit_price), 0)

  async function save() {
    setError('')
    if (!name.trim()) return setError('Skriv inn fornavnet til vennen')
    setBusy(true)
    const { error } = await supabase.rpc('assign_extra', {
      p_order_id: orderId,
      p_buyer_first_name: name.trim(),
      p_lines: Object.entries(qty).filter(([, q]) => q > 0).map(([product_id, q]) => ({ product_id, qty: q })),
      p_paid: paid,
    })
    setBusy(false)
    if (error) return setError(errorText(error))
    navigate(`/forelder/${cpId}`)
  }

  return (
    <>
      <TopBar title={`Gi bort fra ${order.code}`} back={`/forelder/${cpId}`} />
      <Page>
        <p className="text-muted">Velg hvor mange som skal til en venn. De trekkes fra ekstrabestillingen, og totalen din endrer seg ikke</p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Card className="space-y-3">
            {order.order_lines.map((l) => (
              <div key={l.product_id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{names[l.product_id] ?? 'Vare'}</div>
                  <div className="text-sm text-muted">
                    {l.qty} igjen · {kr(l.unit_price)}
                  </div>
                </div>
                <QtyStepper
                  value={qty[l.product_id] ?? 0}
                  max={l.qty}
                  label={names[l.product_id] ?? 'vare'}
                  onChange={(n) => setQty({ ...qty, [l.product_id]: n })}
                />
              </div>
            ))}
          </Card>
          <Card className="space-y-3">
            <Field label="Fornavn på vennen">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-brand)]" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              Allerede betalt
            </label>
            <p className="flex items-baseline justify-between text-lg">
              <span>Totalt</span>
              <strong>{kr(total)}</strong>
            </p>
            <ErrorBox>{error}</ErrorBox>
            <Button type="submit" className="w-full" disabled={busy || total <= 0}>
              {busy ? 'Lagrer …' : 'Gi til vennen'}
            </Button>
          </Card>
        </form>
      </Page>
    </>
  )
}
