import { useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Card, ErrorBox, Field, Input } from '../../components/ui'
import type { AdminData } from '../../lib/adminData'
import { errorText } from '../../lib/errors'
import { kr, longDate, phone, todayOslo } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { useConfirm } from '../../components/Confirm'

type Totals = AdminData['totals'][number]
type Row = { parent: AdminData['parents'][number]; totals: Totals | undefined }

const num = (v: unknown) => Number(v ?? 0)
const ordersText = (n: number) => `${n} ${n === 1 ? 'bestilling' : 'bestillinger'}`
const parentName = (p: Row['parent']) => p.profiles.name || p.profiles.email

/** Paid / owed and whether it's settled, for one parent or a whole family */
function Owing({ paid, owed }: { paid: number; owed: number }) {
  const diff = owed - paid
  return (
    <div className="shrink-0 space-y-1 text-right text-sm whitespace-nowrap">
      <div>
        {kr(paid)} / {kr(owed)}
      </div>
      {diff === 0 && owed > 0 ? (
        <Badge tone="green">Oppgjort</Badge>
      ) : diff > 0 ? (
        <Badge tone="amber">Skylder {kr(diff)}</Badge>
      ) : diff < 0 ? (
        <Badge tone="blue">Betalt {kr(-diff)} for mye</Badge>
      ) : null}
    </div>
  )
}

/** Children by first name (case and spaces ignored); parents who gave no name go last */
function byChild(rows: Row[]) {
  const groups = new Map<string, { name: string; rows: Row[] }>()
  for (const r of rows) {
    const name = r.parent.child_first_name.trim()
    const key = name.toLocaleLowerCase('nb')
    const g = groups.get(key)
    // Show a capitalised spelling if any parent typed one ("Emma" over "emma")
    if (!g) groups.set(key, { name, rows: [r] })
    else {
      g.rows.push(r)
      if (name[0] && name[0] === name[0].toLocaleUpperCase('nb')) g.name = name
    }
  }
  for (const g of groups.values()) g.name = g.name.charAt(0).toLocaleUpperCase('nb') + g.name.slice(1)
  return [...groups.values()].sort((a, b) =>
    !a.name ? 1 : !b.name ? -1 : a.name.localeCompare(b.name, 'nb'),
  )
}

export function ParentsTab({ data, reload }: { data: AdminData; reload: () => Promise<void> }) {
  const [open, setOpen] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'child' | 'name' | 'team'>('child')
  const rows: Row[] = data.parents
    .map((p) => ({ parent: p, totals: data.totals.find((t) => t.campaign_parent_id === p.id) }))
    .sort((a, b) =>
      sortBy === 'team'
        ? num(b.totals?.to_team) - num(a.totals?.to_team)
        : parentName(a.parent).localeCompare(parentName(b.parent), 'nb'),
    )
  const toggle = (id: string) => setOpen(open === id ? null : id)

  const packingLink = (
    <Link to={`/admin/d/${data.campaign.id}/pakkelister`} className="block w-fit font-semibold text-brand">
      Pakkeliste for alle foreldre →
    </Link>
  )
  if (rows.length === 0) return <p className="text-muted">Ingen foreldre har meldt seg på ennå. Del påmeldingslenken fra Oversikt</p>

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {packingLink}
        <div className="flex gap-1 text-sm" role="radiogroup" aria-label="Vis">
          {(['child', 'name', 'team'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={sortBy === k}
              onClick={() => setSortBy(k)}
              className={`rounded-full px-3 py-1 ${sortBy === k ? 'bg-ink text-white' : 'bg-line'}`}
            >
              {k === 'child' ? 'Barn' : k === 'name' ? 'Navn' : 'Mest til laget'}
            </button>
          ))}
        </div>
      </div>

      {sortBy === 'child'
        ? byChild(rows).map((g) => {
            const sum = (f: keyof Totals) => g.rows.reduce((n, r) => n + num(r.totals?.[f]), 0)
            const orders = sum('order_count')
            return (
              <Card key={g.name || '-'} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold">{g.name || 'Barn ikke oppgitt'}</div>
                    <div className="text-sm text-muted">
                      {ordersText(orders)} · <strong className="text-ink">{kr(sum('to_team'))}</strong> til laget
                    </div>
                  </div>
                  {g.rows.length > 1 && <Owing paid={sum('paid')} owed={sum('owed')} />}
                </div>
                {g.rows.map(({ parent, totals }) => (
                  <div key={parent.id} className="border-t border-line pt-2">
                    <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => toggle(parent.id)}>
                      <div>
                        <div className="font-semibold">
                          {parentName(parent)} <span className="font-normal text-muted">{parent.payment_code}</span>
                        </div>
                        {g.rows.length > 1 && (
                          <div className="text-sm text-muted">
                            {ordersText(num(totals?.order_count))} · {kr(totals?.to_team)} til laget
                          </div>
                        )}
                      </div>
                      <Owing paid={num(totals?.paid)} owed={num(totals?.owed)} />
                    </button>
                    {open === parent.id && <ParentDetail data={data} parentId={parent.id} reload={reload} />}
                  </div>
                ))}
              </Card>
            )
          })
        : rows.map(({ parent, totals }) => (
            <Card key={parent.id} className="space-y-2">
              <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => toggle(parent.id)}>
                <div>
                  <div className="font-bold">
                    {parentName(parent)} <span className="font-normal text-muted">{parent.payment_code}</span>
                  </div>
                  <div className="text-sm text-muted">
                    {parent.child_first_name && `${parent.child_first_name} · `}
                    {ordersText(num(totals?.order_count))} · <strong className="text-ink">{kr(totals?.to_team)}</strong> til laget
                  </div>
                </div>
                <Owing paid={num(totals?.paid)} owed={num(totals?.owed)} />
              </button>
              {open === parent.id && <ParentDetail data={data} parentId={parent.id} reload={reload} />}
            </Card>
          ))}
    </div>
  )
}

function ParentDetail({ data, parentId, reload }: { data: AdminData; parentId: string; reload: () => Promise<void> }) {
  const parent = data.parents.find((p) => p.id === parentId)!
  const totals = data.totals.find((t) => t.campaign_parent_id === parentId)
  const payments = data.payments.filter((p) => p.campaign_parent_id === parentId)
  const [amount, setAmount] = useState(String(Math.max(0, Number(totals?.diff ?? 0))))
  const [date, setDate] = useState(todayOslo())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ask = useConfirm()

  async function addPayment() {
    setError('')
    const value = Number(amount.replace(',', '.').replace(/\s/g, ''))
    if (!value) return setError('Skriv inn et beløp')
    setBusy(true)
    const { error } = await supabase
      .from('parent_payments')
      .insert({ campaign_parent_id: parentId, amount: value, paid_on: date, source: 'manual' })
    setBusy(false)
    if (error) return setError(errorText(error))
    await reload()
  }

  async function removePayment(id: string) {
    if (!(await ask('Slette denne betalingen?', { confirm: 'Slett', danger: true }))) return
    await supabase.from('parent_payments').delete().eq('id', id)
    await reload()
  }

  async function toggleSent() {
    const next = parent.goods_sent_at ? null : new Date().toISOString()
    if (next && !(await ask(`Merke at varene er sendt til ${parent.profiles.name}? Forelderen får e‑post`, { confirm: 'Merk sendt' }))) return
    await supabase.from('campaign_parents').update({ goods_sent_at: next }).eq('id', parentId)
    await reload()
  }

  async function removeParent() {
    const name = parent.profiles.name || parent.profiles.email
    const orders = totals?.order_count ?? 0
    const paid = Number(totals?.paid ?? 0)
    const lost = [
      orders ? `${orders} ${orders === 1 ? 'bestilling' : 'bestillinger'} (${kr(totals?.to_team)} til laget)` : '',
      payments.length ? `${payments.length} ${payments.length === 1 ? 'betaling' : 'betalinger'} (${kr(paid)})` : '',
    ].filter(Boolean)
    const message = [
      lost.length ? `Dette slettes for godt: ${lost.join(' og ')}` : 'Forelderen har ingen bestillinger eller betalinger',
      'Bestillingslenken slutter å virke. Brukeren beholdes, så forelderen kan melde seg på igjen',
    ].join('. ')
    const ok = await ask(message, {
      title: `Fjerne ${name} fra dugnaden?`,
      confirm: 'Fjern',
      danger: true,
      typeToConfirm: lost.length ? name : undefined,
    })
    if (!ok) return
    setError('')
    setBusy(true)
    const { error } = await supabase.from('campaign_parents').delete().eq('id', parentId)
    setBusy(false)
    if (error) return setError(errorText(error))
    await reload()
  }

  return (
    <div className="space-y-3 border-t border-line pt-3 text-sm">
      <p>
        {phone(parent.profiles.phone)} · {parent.profiles.email}
      </p>
      <div className="space-y-1">
        <h3 className="font-semibold">Betalinger</h3>
        {payments.length === 0 && <p className="text-muted">Ingen registrert</p>}
        {payments.map((p) => (
          <div key={p.id} className="flex justify-between">
            <span>
              {longDate(p.paid_on)}: {kr(p.amount)}
            </span>
            <button type="button" className="text-red-700" onClick={() => void removePayment(p.id)}>
              Slett
            </button>
          </div>
        ))}
      </div>
      <form
        className="grid grid-cols-2 items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void addPayment()
        }}
      >
        <Field label="Beløp (kr)">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Dato">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button type="submit" className="col-span-2" disabled={busy}>
          Registrer betaling fra {parent.profiles.name.split(' ')[0] || 'forelder'}
        </Button>
      </form>
      <ErrorBox>{error}</ErrorBox>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void toggleSent()}>
          {parent.goods_sent_at ? `Varer sendt ${longDate(parent.goods_sent_at)} (angre)` : 'Merk varer sendt'}
        </Button>
        <Link to={`/pakkeliste/${parent.id}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-brand">
          Pakkeliste
        </Link>
        <Link to={`/forelder/${parent.id}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-brand">
          Se forelderens side →
        </Link>
      </div>
      <div className="border-t border-line pt-3">
        <Button variant="danger" onClick={() => void removeParent()} disabled={busy}>
          Fjern fra dugnaden
        </Button>
      </div>
    </div>
  )
}
