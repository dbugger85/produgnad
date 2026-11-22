import { useCallback, useEffect, useState } from 'react'
import { cached, remember } from './pageCache'
import { supabase } from './supabase'
import type { Campaign, CampaignParent, Order, ParentPayment, ParentTotals, Product } from './types'

export interface AdminData {
  campaign: Campaign
  products: Product[]
  parents: (CampaignParent & {
    profiles: { name: string; phone: string; email: string }
    /** Admins' own name for the child ("Emil H."); parents and friends never see it */
    child_labels: { label: string } | null
  })[]
  totals: ParentTotals[]
  orders: Order[]
  payments: ParentPayment[]
  progress: { raised: number; sales: number; target_amount: number } | null
  supplier: { product_id: string; units: number }[]
}

/** The child's name on admin pages: the admins' label if set, otherwise what the parent wrote */
export function adminChildName(p: AdminData['parents'][number]): string {
  return p.child_labels?.label?.trim() || p.child_first_name.trim()
}

/** Sets the admins' label for these parents' child; the parent's own spelling (or nothing) removes it */
export async function saveChildLabel(parents: AdminData['parents'], value: string) {
  const label = value.trim()
  const clear = parents.filter((p) => !label || label === p.child_first_name.trim()).map((p) => p.id)
  const set = parents.filter((p) => !clear.includes(p.id)).map((p) => ({ campaign_parent_id: p.id, label, updated_at: new Date().toISOString() }))
  if (clear.length) {
    const { error } = await supabase.from('child_labels').delete().in('campaign_parent_id', clear)
    if (error) return error
  }
  if (set.length) {
    const { error } = await supabase.from('child_labels').upsert(set)
    if (error) return error
  }
  return null
}

export function useAdminData(campaignId: string) {
  const [data, setData] = useState<AdminData | null | undefined>(() => cached<AdminData>(`admin:${campaignId}`))
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data: campaign, error } = await supabase.from('campaigns').select('*').eq('id', campaignId).maybeSingle()
    if (error) return setError(error.message)
    if (!campaign) return setData(null)
    const [products, parents, totals, orders, payments, progress, supplier] = await Promise.all([
      supabase.from('products').select('*, product_images(*)').eq('campaign_id', campaignId).order('sort_order').order('created_at'),
      supabase.from('campaign_parents').select('*, profiles(name, phone, email), child_labels(label)').eq('campaign_id', campaignId).order('created_at'),
      supabase.from('v_parent_totals').select('*').eq('campaign_id', campaignId),
      supabase
        .from('orders')
        .select('*, order_lines(*)')
        .eq('campaign_id', campaignId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('parent_payments')
        .select('*, campaign_parents!inner(campaign_id)')
        .eq('campaign_parents.campaign_id', campaignId)
        .order('paid_on'),
      supabase.from('v_campaign_progress').select('*').eq('campaign_id', campaignId).maybeSingle(),
      supabase.from('v_supplier_totals').select('product_id, units').eq('campaign_id', campaignId),
    ])
    const firstError = [products, parents, totals, orders, payments, progress, supplier].find((r) => r.error)?.error
    if (firstError) setError(firstError.message)
    setData(remember(`admin:${campaignId}`, {
      campaign: campaign as Campaign,
      products: ((products.data as Product[]) ?? []).map((p) => ({
        ...p,
        product_images: [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      })),
      parents: (parents.data as AdminData['parents']) ?? [],
      totals: (totals.data as ParentTotals[]) ?? [],
      orders: (orders.data as Order[]) ?? [],
      payments: (payments.data as ParentPayment[]) ?? [],
      progress: (progress.data as AdminData['progress']) ?? null,
      supplier: (supplier.data as AdminData['supplier']) ?? [],
    }))
  }, [campaignId])

  useEffect(() => {
    void load()
  }, [load])

  return { data, error, reload: load }
}
