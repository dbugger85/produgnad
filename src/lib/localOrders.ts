// Friend orders remembered on this device, so reopening a parent's link shows them.

export interface LocalOrder {
  link_code: string
  code: string
  status_token: string
  amount: number
  created_at: string
}

const KEY = 'produgnad:orders'

export function loadLocalOrders(): LocalOrder[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as LocalOrder[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function rememberOrder(order: LocalOrder): void {
  try {
    const list = loadLocalOrders().filter((o) => o.status_token !== order.status_token)
    list.unshift(order)
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)))
  } catch {
    // Private mode or blocked storage: the status link still works.
  }
}

export function ordersForLink(linkCode: string): LocalOrder[] {
  return loadLocalOrders().filter((o) => o.link_code.toUpperCase() === linkCode.toUpperCase())
}
