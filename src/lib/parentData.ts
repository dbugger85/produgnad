import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Campaign, CampaignParent, LinkPage, Order, ParentPayment, ParentTotals } from './types'

export interface ParentData {
  cp: CampaignParent & { campaigns: Campaign; profiles: { name: string; phone: string; email: string } }
  orders: Order[]
  totals: ParentTotals | null
  payments: ParentPayment[]
  page: LinkPage | null
}

/** Everything the parent page needs, for one campaign_parents row. */
export function useParentData(cpId: string) {
  const [data, setData] = useState<ParentData | null | undefined>(undefined)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data: cp, error: cpError } = await supabase
      .from('campaign_parents')
      .select('*, campaigns(*), profiles(name, phone, email)')
      .eq('id', cpId)
      .maybeSingle()
    if (cpError) return setError(cpError.message)
    if (!cp) return setData(null)
    const [orders, totals, payments, page] = await Promise.all([
      supabase
        .from('orders')
        .select('*, order_lines(*)')
        .eq('campaign_parent_id', cpId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('v_parent_totals').select('*').eq('campaign_parent_id', cpId).maybeSingle(),
      supabase.from('parent_payments').select('*').eq('campaign_parent_id', cpId).order('paid_on'),
      supabase.rpc('public_campaign_by_link', { p_link_code: cp.link_code }),
    ])
    setData({
      cp: cp as ParentData['cp'],
      orders: (orders.data as Order[]) ?? [],
      totals: (totals.data as ParentTotals) ?? null,
      payments: (payments.data as ParentPayment[]) ?? [],
      page: (page.data as LinkPage) ?? null,
    })
  }, [cpId])

  useEffect(() => {
    void load()
  }, [load])

  return { data, error, reload: load }
}
