import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { OrderPackingList, PackedProgress, UnitsTable, unitsByProduct } from '../components/PackingList'
import { Card, ErrorBox, Loading, Page, TopBar } from '../components/ui'
import { useAuth } from '../lib/auth'
import { errorText } from '../lib/errors'
import { phone } from '../lib/format'
import { cached, remember } from '../lib/pageCache'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'

interface Loaded {
  campaign: { id: string; name: string; organizer_label: string }
  parent: { name: string; phone: string; child_first_name: string; payment_code: string; user_id: string }
  orders: Order[]
  products: { id: string; name: string; sort_order: number }[]
}

/** /pakkeliste/:cpId for the parent (their own) or an admin: tick each friend's order when it is packed. */
export default function PackingPage() {
  const { cpId = '' } = useParams()
  const { profile } = useAuth()
  const key = `packing:${cpId}`
  const [data, setData] = useState<Loaded | null | undefined>(() => cached<Loaded>(key))
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: cp } = await supabase
        .from('campaign_parents')
        .select('parent_user_id, child_first_name, payment_code, campaign_id, campaigns(id, name, organizer_label), profiles(name, phone)')
        .eq('id', cpId)
        .maybeSingle()
      if (!cp) return setData(null)
      const c = cp as unknown as {
        parent_user_id: string
        child_first_name: string
        payment_code: string
        campaign_id: string
        campaigns: Loaded['campaign']
        profiles: { name: string; phone: string }
      }
      const [orders, products] = await Promise.all([
        supabase.from('orders').select('*, order_lines(*)').eq('campaign_parent_id', cpId).is('deleted_at', null).order('created_at'),
        supabase.from('products').select('id, name, sort_order').eq('campaign_id', c.campaign_id),
      ])
      setData(
        remember(key, {
          campaign: c.campaigns,
          parent: { ...c.profiles, child_first_name: c.child_first_name, payment_code: c.payment_code, user_id: c.parent_user_id },
          orders: (orders.data as Order[]) ?? [],
          products: products.data ?? [],
        }),
      )
    }
    void load()
  }, [cpId, key])

  async function toggle(o: Order) {
    if (!data) return
    const packedAt = o.packed_at ? null : new Date().toISOString()
    const set = (value: string | null) =>
      setData((d) => d && remember(key, { ...d, orders: d.orders.map((x) => (x.id === o.id ? { ...x, packed_at: value } : x)) }))
    setError('')
    set(packedAt) // Show the tick at once; undo if saving fails
    const { error } = await supabase.rpc('set_order_packed', { p_order_id: o.id, p_packed: packedAt !== null })
    if (error) {
      set(o.packed_at)
      setError(errorText(error))
    }
  }

  if (data === undefined) return <Loading />
  if (data === null) return <Page><ErrorBox>Fant ikke pakkelisten.</ErrorBox></Page>

  // Admins packing someone else's list go back to the list of all parents
  const own = data.parent.user_id === profile?.user_id
  const back = own ? `/forelder/${cpId}` : `/admin/d/${data.campaign.id}/pakkelister`
  const done = data.orders.filter((o) => o.packed_at).length
  const units = unitsByProduct(data.orders, data.products)
  const total = units.reduce((a, r) => a + r.units, 0)

  return (
    <>
      <TopBar title="Pakkeliste" back={back} />
      <Page>
        <div>
          <p className="text-sm text-muted">{data.campaign.name}</p>
          <h2 className="text-lg font-bold">
            {data.parent.name}
            {data.parent.child_first_name && <span className="font-normal text-muted"> · {data.parent.child_first_name}</span>}
          </h2>
          {!own && <p className="text-sm text-muted">{phone(data.parent.phone)} · {data.parent.payment_code}</p>}
        </div>

        <Card className="space-y-2">
          <h3 className="font-semibold">I posen fra de ansvarlige ({total} stk)</h3>
          {units.length ? <UnitsTable rows={units} /> : <p className="text-sm text-muted">Ingen varer ennå</p>}
        </Card>

        {data.orders.length > 0 && <PackedProgress done={done} total={data.orders.length} noun="bestillinger" />}
        <p className="text-sm text-muted">Trykk på en bestilling når den er pakket. Trykk igjen for å angre</p>
        <ErrorBox>{error}</ErrorBox>
        <OrderPackingList orders={data.orders} products={data.products} packed={(o) => !!o.packed_at} onToggle={(o) => void toggle(o)} />
      </Page>
    </>
  )
}
