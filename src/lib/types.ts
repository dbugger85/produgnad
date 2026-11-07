// Shapes returned by the database. Kept by hand; small enough.

export type OrderType = 'friend' | 'own' | 'extra'
export type FriendStatus = 'registrert' | 'betalt' | 'på vei' | 'levert' | 'avbestilt'

export interface PublicAdmin {
  name: string
  role_title: string
  phone: string | null
}

export interface PublicCampaign {
  id: string
  name: string
  team_name: string
  organizer_label: string
  purpose_text: string
  target_amount: number
  deadline: string | null
  locked: boolean
  closed: boolean
  closing_message: string
  accepting_orders: boolean
  max_qty_per_line: number
  raised: number
  admins: PublicAdmin[]
}

export interface PublicParent {
  name: string
  phone: string
  child_first_name: string
  link_code: string
}

export interface ProductImage {
  path: string
  thumb: string
  width: number | null
  height: number | null
}

export interface PublicProduct {
  id: string
  name: string
  description: string
  price: number
  to_team_amount: number
  images: ProductImage[]
}

export interface LinkPage {
  campaign: PublicCampaign
  parent: PublicParent
  products: PublicProduct[]
}

export interface StatusPage {
  code: string
  buyer_first_name: string
  status: FriendStatus
  created_at: string
  amount: number
  lines: { name: string; qty: number; unit_price: number }[]
  parent: PublicParent
  campaign: PublicCampaign
}

export interface Profile {
  user_id: string
  email: string
  name: string
  phone: string
  is_admin: boolean
  role_title: string
  show_phone_public: boolean
}

export interface Campaign {
  id: string
  name: string
  team_name: string
  organizer_label: string
  purpose_text: string
  target_amount: number
  deadline: string | null
  admin_vipps_name: string
  admin_vipps_phone: string
  contact_admin_user_id: string | null
  join_code: string
  locked_at: string | null
  closed_at: string | null
  share_template_short: string
  share_template_long: string
  reminder_template: string
  payment_reminder_template: string
  closing_message: string
  max_qty_per_line: number
}

export interface Product {
  id: string
  campaign_id: string
  name: string
  description: string
  price: number
  to_team_amount: number
  active: boolean
  sort_order: number
  product_images?: ProductImageRow[]
}

export interface ProductImageRow {
  id: string
  product_id: string
  storage_path: string
  thumb_path: string
  width: number | null
  height: number | null
  sort_order: number
}

export interface CampaignParent {
  id: string
  campaign_id: string
  parent_user_id: string
  child_first_name: string
  link_code: string
  payment_code: string
  goods_sent_at: string | null
  profiles?: Pick<Profile, 'name' | 'phone' | 'email'>
}

export interface OrderLine {
  id: string
  order_id: string
  product_id: string
  qty: number
  unit_price: number
  unit_to_team: number
}

export interface Order {
  id: string
  campaign_id: string
  campaign_parent_id: string
  code: string
  type: OrderType
  buyer_first_name: string
  note: string
  email: string | null
  wants_email: boolean
  paid_to_parent_at: string | null
  delivered_at: string | null
  created_by: 'friend' | 'parent'
  created_at: string
  deleted_at: string | null
  order_lines: OrderLine[]
}

export interface ParentTotals {
  campaign_parent_id: string
  campaign_id: string
  owed: number
  paid: number
  diff: number
  friend_unpaid: number
  order_count: number
}

export interface ParentPayment {
  id: string
  campaign_parent_id: string
  amount: number
  paid_on: string
  source: 'manual' | 'screenshot'
  confirmed_at: string
}

export function orderAmount(order: Pick<Order, 'order_lines'>): number {
  return order.order_lines.reduce((sum, l) => sum + l.qty * Number(l.unit_price), 0)
}

export function orderUnits(order: Pick<Order, 'order_lines'>): number {
  return order.order_lines.reduce((sum, l) => sum + l.qty, 0)
}

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  friend: 'Kunde',
  own: 'Egen',
  extra: 'Ekstra',
}

export const STATUS_LABEL: Record<FriendStatus, string> = {
  registrert: 'ikke betalt',
  betalt: 'betalt',
  'på vei': 'på vei',
  levert: 'levert',
  avbestilt: 'avbestilt',
}
