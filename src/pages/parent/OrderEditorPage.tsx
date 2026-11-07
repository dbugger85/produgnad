import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ProductPicker, quantitiesToLines, quantitiesTotal, type Quantities } from '../../components/ProductPicker'
import { Button, Card, ErrorBox, Field, Input, Loading, Notice, Page, TopBar } from '../../components/ui'
import { errorText } from '../../lib/errors'
import { kr } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Order, OrderType, Product, PublicProduct } from '../../lib/types'
import { useConfirm } from '../../components/Confirm'

const TYPES: { value: OrderType; label: string; hint: string }[] = [
  { value: 'friend', label: 'Venn', hint: 'Bestilling fra venner, familie eller på døra' },
  { value: 'own', label: 'Egen', hint: 'Til din egen husholdning' },
  { value: 'extra', label: 'Ekstra', hint: 'Lager du selger senere' },
]

/** /forelder/:cpId/ny and /forelder/:cpId/ordre/:orderId */
export default function OrderEditorPage() {
  const { cpId = '', orderId } = useParams()
  const navigate = useNavigate()
  const [products, setProducts] = useState<PublicProduct[] | null>(null)
  const [maxQty, setMaxQty] = useState(20)
  const [locked, setLocked] = useState(false)
  const [type, setType] = useState<OrderType>('friend')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [paid, setPaid] = useState(false)
  const [quantities, setQuantities] = useState<Quantities>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const ask = useConfirm()

  useEffect(() => {
    async function load() {
      const { data: cp } = await supabase
        .from('campaign_parents')
        .select('campaign_id, campaigns(max_qty_per_line, locked_at, closed_at)')
        .eq('id', cpId)
        .maybeSingle()
      if (!cp) return setError('Fant ikke dugnaden.')
      const c = cp.campaigns as unknown as { max_qty_per_line: number; locked_at: string | null; closed_at: string | null }
      setMaxQty(c.max_qty_per_line)
      setLocked(!!c.locked_at || !!c.closed_at)

      let existing: Order | null = null
      if (orderId) {
        const { data } = await supabase.from('orders').select('*, order_lines(*)').eq('id', orderId).maybeSingle()
        existing = (data as Order) ?? null
        if (!existing) return setError('Fant ikke bestillingen.')
        setOrder(existing)
        setType(existing.type)
        setName(existing.buyer_first_name)
        setNote(existing.note)
        setPaid(!!existing.paid_to_parent_at)
        setQuantities(Object.fromEntries(existing.order_lines.map((l) => [l.product_id, l.qty])))
      }

      const { data: rows } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('campaign_id', cp.campaign_id)
        .order('sort_order')
      const onOrder = new Set(existing?.order_lines.map((l) => l.product_id) ?? [])
      setProducts(
        ((rows as Product[]) ?? [])
          .filter((p) => p.active || onOrder.has(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            // Existing lines keep the price from when they were ordered.
            price: existing?.order_lines.find((l) => l.product_id === p.id)?.unit_price ?? p.price,
            to_team_amount: p.to_team_amount,
            images: [...(p.product_images ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((i) => ({ path: i.storage_path, thumb: i.thumb_path, width: i.width, height: i.height })),
          })),
      )
    }
    void load()
  }, [cpId, orderId])

  const total = useMemo(() => (products ? quantitiesTotal(products, quantities) : 0), [products, quantities])

  if (error && !products) return <Page><ErrorBox>{error}</ErrorBox></Page>
  if (!products) return <Loading />

  async function save() {
    setError('')
    setBusy(true)
    const { error } = await supabase.rpc('save_order', {
      p_campaign_parent_id: cpId,
      p_type: type,
      p_lines: quantitiesToLines(quantities),
      p_buyer_first_name: name,
      p_note: note,
      p_paid: paid,
      p_order_id: orderId ?? null,
    })
    setBusy(false)
    if (error) return setError(errorText(error))
    navigate(`/forelder/${cpId}`)
  }

  async function remove() {
    if (!(await ask('Slette denne bestillingen?', { confirm: 'Slett', danger: true }))) return
    const { error } = await supabase.rpc('delete_order', { p_order_id: orderId })
    if (error) return setError(errorText(error))
    navigate(`/forelder/${cpId}`)
  }

  return (
    <>
      <TopBar title={order ? `Endre ${order.code}` : 'Ny bestilling'} back={`/forelder/${cpId}`} />
      <Page>
        {locked && <Notice>Bestillingene er låst. Bare admin kan endre nå.</Notice>}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Card className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`min-h-11 rounded-xl font-semibold ${type === t.value ? 'bg-brand text-white' : 'bg-cream'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted">{TYPES.find((t) => t.value === type)?.hint}</p>
            {type === 'friend' && (
              <>
                <Field label="Fornavn på vennen">
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
                </Field>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--color-brand)]"
                    checked={paid}
                    onChange={(e) => setPaid(e.target.checked)}
                  />
                  Allerede betalt
                </label>
              </>
            )}
            <Field label="Notat (valgfritt)" hint="For eksempel adresse eller når du skal levere">
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </Field>
          </Card>

          <ProductPicker products={products} quantities={quantities} onChange={setQuantities} maxQty={maxQty} />

          <Card className="space-y-3">
            <p className="flex items-baseline justify-between text-lg">
              <span>Totalt</span>
              <strong>{kr(total)}</strong>
            </p>
            <ErrorBox>{error}</ErrorBox>
            <Button type="submit" className="w-full" disabled={busy || total <= 0}>
              {busy ? 'Lagrer …' : 'Lagre'}
            </Button>
            {order && (
              <Button variant="danger" className="w-full" onClick={() => void remove()}>
                Slett bestillingen
              </Button>
            )}
          </Card>
        </form>
      </Page>
    </>
  )
}
