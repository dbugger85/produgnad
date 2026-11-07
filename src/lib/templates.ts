import { kr, phone, weekdayDate } from './format'
import { DEFAULT_TEMPLATES, fillTemplate, type TemplateVars } from './share'
import type { Campaign, PublicProduct } from './types'

/** "500 g kaffe (120 kr) og te (80 kr)" */
export function productList(products: Pick<PublicProduct, 'name' | 'price'>[]): string {
  const parts = products.map((p) => `${p.name} (${kr(p.price)})`)
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}`
}

export function parentLink(linkCode: string): string {
  return `${window.location.origin}/k/${linkCode}`
}

export function baseVars(
  campaign: Campaign,
  parent: { name: string; phone: string; child_first_name: string; link_code: string },
  products: Pick<PublicProduct, 'name' | 'price'>[],
): TemplateVars {
  return {
    barn: parent.child_first_name || parent.name.split(' ')[0],
    lag: campaign.team_name,
    produkter: productList(products),
    frist: weekdayDate(campaign.deadline),
    lenke: parentLink(parent.link_code),
    forelder: parent.name,
    vipps: phone(parent.phone),
  }
}

export function templateOrDefault(campaign: Campaign, kind: 'short' | 'long' | 'reminder' | 'paymentReminder'): string {
  const value = {
    short: campaign.share_template_short,
    long: campaign.share_template_long,
    reminder: campaign.reminder_template,
    paymentReminder: campaign.payment_reminder_template,
  }[kind]
  return value?.trim() ? value : DEFAULT_TEMPLATES[kind]
}

export function fill(campaign: Campaign, kind: Parameters<typeof templateOrDefault>[1], vars: TemplateVars): string {
  return fillTemplate(templateOrDefault(campaign, kind), vars)
}
