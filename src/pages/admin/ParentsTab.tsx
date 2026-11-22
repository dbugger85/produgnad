import { useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Card, ErrorBox, Field, Input } from '../../components/ui'
import { adminChildName, saveChildLabel, type AdminData } from '../../lib/adminData'
import { errorText } from '../../lib/errors'
import { kr, longDate, phone, todayOslo } from '../../lib/format'
import { isOffline } from '../../lib/offline'
import { supabase } from '../../lib/supabase'
import { useConfirm } from '../../components/Confirm'

type Totals = AdminData['totals'][number]
type Row = { parent: AdminData['parents'][number]; totals: Totals | undefined }

const num = (v: unknown) => Number(v ?? 0)
const ordersText = (n: number) => `${n} ${n === 1 ? 'bestilling' : 'bestillinger'}`
const parentName = (p: Row['parent']) => p.profiles.name || p.profiles.email
/** Marks a seller an admin added for a parent who doesn't log in */
const OfflineBadge = ({ parent }: { parent: Row['parent'] }) => (isOffline(parent) ? <Badge>Uten innlogging</Badge> : null)

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
    const name = adminChildName(r.parent)
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
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const addChild = adding ? (
    <SellerForm
      campaignId={data.campaign.id}
      onDone={async (id) => {
        setAdding(false)
        if (!id) return
        await reload()
        setOpen(id)
      }}
    />
  ) : (
    <Button variant="secondary" onClick={() => setAdding(true)} disabled={!!data.campaign.closed_at}>
      + Legg til barn
    </Button>
  )

  const packingLink = (
    <Link to={`/admin/d/${data.campaign.id}/pakkelister`} className="block w-fit font-semibold text-brand">
      Pakkeliste for alle foreldre →
    </Link>
  )
  if (rows.length === 0)
    return (
      <div className="space-y-3">
        <p className="text-muted">Ingen foreldre har meldt seg på ennå. Del påmeldingslenken fra Oversikt</p>
        {addChild}
      </div>
    )

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
              {k === 'child' ? 'Barn' : k === 'name' ? 'Foreldre' : 'Mest til laget'}
            </button>
          ))}
        </div>
      </div>
      {addChild}

      {sortBy === 'child'
        ? byChild(rows).map((g) => {
            const sum = (f: keyof Totals) => g.rows.reduce((n, r) => n + num(r.totals?.[f]), 0)
            const orders = sum('order_count')
            return (
              <Card key={g.name || '-'} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg font-bold">{g.name || 'Barn ikke oppgitt'}</span>
                      {g.name && editing !== g.name && (
                        <button type="button" className="text-sm font-semibold text-brand" onClick={() => setEditing(g.name)}>
                          Endre navn
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-muted">
                      {ordersText(orders)} · <strong className="text-ink">{kr(sum('to_team'))}</strong> til laget
                    </div>
                  </div>
                  {g.rows.length > 1 && <Owing paid={sum('paid')} owed={sum('owed')} />}
                </div>
                {editing === g.name && (
                  <ChildNameForm
                    parents={g.rows.map((r) => r.parent)}
                    initial={g.name}
                    onDone={async (saved) => {
                      setEditing(null)
                      if (saved) await reload()
                    }}
                  />
                )}
                {g.rows.map(({ parent, totals }) => (
                  <div key={parent.id} className="border-t border-line pt-2">
                    <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => toggle(parent.id)}>
                      <div>
                        <div className="font-semibold">
                          {parentName(parent)} <span className="font-normal text-muted">{parent.payment_code}</span>{' '}
                          <OfflineBadge parent={parent} />
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
                    {parentName(parent)} <span className="font-normal text-muted">{parent.payment_code}</span>{' '}
                    <OfflineBadge parent={parent} />
                  </div>
                  <div className="text-sm text-muted">
                    {adminChildName(parent) && `${adminChildName(parent)} · `}
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

/** Admins' name for a child, for this overview only. Parents and friends keep seeing what the parent wrote */
function ChildNameForm({
  parents,
  initial,
  onDone,
}: {
  parents: AdminData['parents']
  initial: string
  onDone: (saved: boolean) => Promise<void> | void
}) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // What parents and friends see, each spelling once ("Emma", not "emma / Emma")
  const spellings = new Map<string, string>()
  for (const p of parents) {
    const n = p.child_first_name.trim()
    const k = n.toLocaleLowerCase('nb')
    if (n && (!spellings.has(k) || n[0] === n[0].toLocaleUpperCase('nb'))) spellings.set(k, n)
  }
  const theirs = [...spellings.values()].join(' / ')

  async function save() {
    setError('')
    setBusy(true)
    const err = await saveChildLabel(parents, value)
    setBusy(false)
    if (err) return setError(errorText(err))
    await onDone(true)
  }

  return (
    <form
      className="space-y-2 rounded-xl bg-cream p-3 ring-1 ring-line"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field
        label={parents.length > 1 ? `Navn i oversikten (for alle ${parents.length} foreldrene)` : 'Navn i oversikten'}
        hint={`Bare admin ser dette, for eksempel «Emil H.» når flere barn heter det samme. Foreldre og venner ser fortsatt «${theirs || 'navnet forelderen skrev'}»`}
      >
        <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} autoFocus />
      </Field>
      <ErrorBox>{error}</ErrorBox>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Lagrer …' : 'Lagre'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void onDone(false)}>
          Avbryt
        </Button>
      </div>
    </form>
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
  const [editingChild, setEditingChild] = useState(false)
  const offline = isOffline(parent)

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
    const question = `Merke at varene er sendt til ${parent.profiles.name}?${offline ? '' : ' Forelderen får e‑post'}`
    if (next && !(await ask(question, { confirm: 'Merk sendt' }))) return
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
      offline ? '' : 'Bestillingslenken slutter å virke. Brukeren beholdes, så forelderen kan melde seg på igjen',
    ]
      .filter(Boolean)
      .join('. ')
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
      {offline ? (
        editingChild ? (
          <SellerForm
            campaignId={data.campaign.id}
            parent={parent}
            onDone={async (id) => {
              setEditingChild(false)
              if (id) await reload()
            }}
          />
        ) : (
          <>
            <p>
              Barn: {parent.child_first_name}
              {parent.offline_name && ` · ${parent.offline_name}`}
              {parent.offline_phone && ` · ${phone(parent.offline_phone)}`}{' '}
              <button type="button" className="font-semibold text-brand" onClick={() => setEditingChild(true)}>
                Endre
              </button>
            </p>
            <p className="text-muted">Uten innlogging: du legger inn bestillinger og betalinger, og forelderen får ingen e‑post</p>
          </>
        )
      ) : (
        <p>
          {phone(parent.profiles.phone)} · {parent.profiles.email}
        </p>
      )}
      {offline ? null : editingChild ? (
        <ChildNameForm
          parents={[parent]}
          initial={adminChildName(parent)}
          onDone={async (saved) => {
            setEditingChild(false)
            if (saved) await reload()
          }}
        />
      ) : (
        <p>
          Barn: {adminChildName(parent) || 'ikke oppgitt'}
          {parent.child_labels && parent.child_first_name.trim() && (
            <span className="text-muted"> (forelderen skrev «{parent.child_first_name.trim()}»)</span>
          )}{' '}
          <button type="button" className="font-semibold text-brand" onClick={() => setEditingChild(true)}>
            Endre
          </button>
        </p>
      )}
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
          Registrer betaling fra {(offline ? parent.offline_name : parent.profiles.name).split(' ')[0] || 'forelder'}
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
        {offline && (
          <Link to={`/forelder/${parent.id}/ny`} className="inline-flex min-h-11 items-center px-2 font-semibold text-brand">
            + Ny bestilling
          </Link>
        )}
        <Link to={`/forelder/${parent.id}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-brand">
          {offline ? 'Se bestillingene →' : 'Se forelderens side →'}
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

/** Adds or changes a seller without login: a child whose parent doesn't want to log in */
function SellerForm({
  campaignId,
  parent,
  onDone,
}: {
  campaignId: string
  parent?: AdminData['parents'][number]
  onDone: (id: string | null) => Promise<void> | void
}) {
  const [child, setChild] = useState(parent?.child_first_name ?? '')
  const [name, setName] = useState(parent?.offline_name ?? '')
  const [tel, setTel] = useState(parent?.offline_phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_save_seller', {
      p_campaign_id: campaignId,
      p_child_first_name: child,
      p_name: name,
      p_phone: tel,
      p_campaign_parent_id: parent?.id ?? null,
    })
    setBusy(false)
    if (error) return setError(errorText(error))
    await onDone(data as string)
  }

  return (
    <form
      className="space-y-2 rounded-xl bg-cream p-3 text-sm ring-1 ring-line"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      {!parent && (
        <p className="text-muted">
          For foreldre som ikke vil logge inn. Du legger inn bestillingene og betalingene deres selv, og de får ingen e‑post
        </p>
      )}
      <Field label="Barnets fornavn">
        <Input value={child} onChange={(e) => setChild(e.target.value)} maxLength={40} required autoFocus />
      </Field>
      <Field label="Forelderens navn (valgfritt)">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" />
      </Field>
      <Field label="Mobilnummer (valgfritt)">
        <Input value={tel} onChange={(e) => setTel(e.target.value)} maxLength={30} inputMode="tel" autoComplete="off" />
      </Field>
      <ErrorBox>{error}</ErrorBox>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !child.trim()}>
          {busy ? 'Lagrer …' : parent ? 'Lagre' : 'Legg til'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void onDone(null)}>
          Avbryt
        </Button>
      </div>
    </form>
  )
}
