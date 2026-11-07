import { useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Card, ErrorBox, Field, Input } from '../../components/ui'
import type { AdminData } from '../../lib/adminData'
import { errorText } from '../../lib/errors'
import { kr, longDate, phone, todayOslo } from '../../lib/format'
import { supabase } from '../../lib/supabase'

export function ParentsTab({ data, reload }: { data: AdminData; reload: () => Promise<void> }) {
  const [open, setOpen] = useState<string | null>(null)
  const rows = data.parents
    .map((p) => ({ parent: p, totals: data.totals.find((t) => t.campaign_parent_id === p.id) }))
    .sort((a, b) => a.parent.profiles.name.localeCompare(b.parent.profiles.name, 'nb'))

  if (rows.length === 0) return <p className="text-stone-600">Ingen foreldre har meldt seg på ennå. Del påmeldingslenken fra Oversikt.</p>

  return (
    <div className="space-y-2">
      {rows.map(({ parent, totals }) => {
        const diff = Number(totals?.diff ?? 0)
        return (
          <Card key={parent.id} className="space-y-2">
            <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOpen(open === parent.id ? null : parent.id)}>
              <div>
                <div className="font-bold">
                  {parent.profiles.name || parent.profiles.email} <span className="font-normal text-stone-500">{parent.payment_code}</span>
                </div>
                <div className="text-sm text-stone-600">
                  {parent.child_first_name && `${parent.child_first_name} · `}
                  {totals?.order_count ?? 0} bestillinger
                </div>
              </div>
              <div className="text-right text-sm">
                <div>
                  {kr(totals?.paid)} / {kr(totals?.owed)}
                </div>
                {diff === 0 && Number(totals?.owed ?? 0) > 0 ? (
                  <Badge tone="green">Oppgjort</Badge>
                ) : diff > 0 ? (
                  <Badge tone="amber">Skylder {kr(diff)}</Badge>
                ) : diff < 0 ? (
                  <Badge tone="blue">Betalt {kr(-diff)} for mye</Badge>
                ) : null}
              </div>
            </button>
            {open === parent.id && <ParentDetail data={data} parentId={parent.id} reload={reload} />}
          </Card>
        )
      })}
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

  async function addPayment() {
    setError('')
    const value = Number(amount.replace(',', '.').replace(/\s/g, ''))
    if (!value) return setError('Skriv inn et beløp.')
    setBusy(true)
    const { error } = await supabase
      .from('parent_payments')
      .insert({ campaign_parent_id: parentId, amount: value, paid_on: date, source: 'manual' })
    setBusy(false)
    if (error) return setError(errorText(error))
    await reload()
  }

  async function removePayment(id: string) {
    if (!confirm('Slette denne betalingen?')) return
    await supabase.from('parent_payments').delete().eq('id', id)
    await reload()
  }

  async function toggleSent() {
    const next = parent.goods_sent_at ? null : new Date().toISOString()
    if (next && !confirm(`Merke at varene er sendt til ${parent.profiles.name}? Forelderen får e-post.`)) return
    await supabase.from('campaign_parents').update({ goods_sent_at: next }).eq('id', parentId)
    await reload()
  }

  return (
    <div className="space-y-3 border-t border-stone-200 pt-3 text-sm">
      <p>
        {phone(parent.profiles.phone)} · {parent.profiles.email}
      </p>
      <div className="space-y-1">
        <h3 className="font-semibold">Betalinger</h3>
        {payments.length === 0 && <p className="text-stone-500">Ingen registrert.</p>}
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
        <Link to={`/forelder/${parent.id}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-brand">
          Se forelderens side →
        </Link>
      </div>
    </div>
  )
}
