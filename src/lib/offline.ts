import type { CampaignParent } from './types'

type Person = { name: string; phone: string; email: string }
type SellerRow = { profiles?: Person | null; child_first_name: string; offline_name: string; offline_phone: string }

/** A seller added by an admin, for a parent who doesn't log in (no profile, no emails, link takes no orders) */
export function isOffline(cp: Pick<CampaignParent, 'parent_user_id'>): boolean {
  return cp.parent_user_id === null
}

/**
 * Fills in `profiles` for a seller without login (the database has none for them), so lists and
 * pages can keep using `profiles.name` / `profiles.phone`. Email stays empty: they get no emails.
 */
export function withProfile<T extends SellerRow>(cp: T): T & { profiles: Person } {
  if (cp.profiles) return cp as T & { profiles: Person }
  const child = cp.child_first_name.trim()
  const name = cp.offline_name.trim() || (child ? `Forelder til ${child}` : 'Uten navn')
  return { ...cp, profiles: { name, phone: cp.offline_phone, email: '' } }
}
