import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { PackingList } from '../components/PackingList'
import { Button, ErrorBox, Loading, Page, TopBar } from '../components/ui'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'

interface Loaded {
  campaign: { id: string; name: string; organizer_label: string }
  parent: { name: string; phone: string; child_first_name: string; payment_code: string }
  orders: Order[]
  products: { id: string; name: string; sort_order: number }[]
}

/** /pakkeliste/:cpId for the parent (their own) or an admin. */
export default function PackingPage() {
  const { cpId = '' } = useParams()
  const { profile } = useAuth()
  const [data, setData] = useState<Loaded | null | undefined>(undefined)

  useEffect(() => {
    async function load() {
      const { data: cp } = await supabase
        .from('campaign_parents')
        .select('child_first_name, payment_code, campaign_id, campaigns(id, name, organizer_label), profiles(name, phone)')
        .eq('id', cpId)
        .maybeSingle()
      if (!cp) return setData(null)
      const c = cp as unknown as {
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
      setData({
        campaign: c.campaigns,
        parent: { ...c.profiles, child_first_name: c.child_first_name, payment_code: c.payment_code },
        orders: (orders.data as Order[]) ?? [],
        products: products.data ?? [],
      })
    }
    void load()
  }, [cpId])

  if (data === undefined) return <Loading />
  if (data === null) return <Page><ErrorBox>Fant ikke pakkelisten.</ErrorBox></Page>

  const back = profile?.is_admin ? `/admin/d/${data.campaign.id}?fane=foreldre` : `/forelder/${cpId}`
  return (
    <>
      <TopBar title="Pakkeliste" back={back} right={<Button variant="secondary" onClick={() => window.print()}>Skriv ut</Button>} />
      <Page>
        <PackingList
          campaignName={data.campaign.name}
          organizer={data.campaign.organizer_label}
          parent={data.parent}
          orders={data.orders}
          products={data.products}
        />
      </Page>
    </>
  )
}
