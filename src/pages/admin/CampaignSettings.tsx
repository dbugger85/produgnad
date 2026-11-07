import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, ErrorBox, Field, Input, Page, TextArea, TopBar } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { errorText } from '../../lib/errors'
import { DEFAULT_TEMPLATES, PLACEHOLDERS } from '../../lib/share'
import { supabase } from '../../lib/supabase'
import type { Campaign, Profile } from '../../lib/types'

type Form = Omit<Campaign, 'id' | 'join_code' | 'locked_at' | 'closed_at'>

function emptyForm(userId: string | undefined): Form {
  return {
    name: 'Kaffesalg',
    team_name: '',
    organizer_label: 'Foreldre og supportere av ',
    purpose_text: 'Alt overskudd går til cupavgifter og reiser for laget.',
    target_amount: 0,
    deadline: null,
    admin_vipps_name: '',
    admin_vipps_phone: '',
    contact_admin_user_id: userId ?? null,
    share_template_short: DEFAULT_TEMPLATES.short,
    share_template_long: DEFAULT_TEMPLATES.long,
    reminder_template: DEFAULT_TEMPLATES.reminder,
    payment_reminder_template: DEFAULT_TEMPLATES.paymentReminder,
    closing_message: '',
    max_qty_per_line: 20,
  }
}

/** Create (no campaign) or edit a campaign. */
export function CampaignSettings({ campaign, onSaved }: { campaign?: Campaign; onSaved?: () => void }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(() => (campaign ? { ...campaign } : emptyForm(profile?.user_id)))
  const [admins, setAdmins] = useState<Profile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('is_admin', true)
      .then(({ data }) => setAdmins((data as Profile[]) ?? []))
  }, [])

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setError('')
    setBusy(true)
    const row = {
      name: form.name.trim(),
      team_name: form.team_name.trim(),
      organizer_label: form.organizer_label.trim(),
      purpose_text: form.purpose_text.trim(),
      target_amount: Number(form.target_amount) || 0,
      deadline: form.deadline || null,
      admin_vipps_name: form.admin_vipps_name.trim(),
      admin_vipps_phone: form.admin_vipps_phone.trim(),
      contact_admin_user_id: form.contact_admin_user_id || null,
      share_template_short: form.share_template_short,
      share_template_long: form.share_template_long,
      reminder_template: form.reminder_template,
      payment_reminder_template: form.payment_reminder_template,
      closing_message: form.closing_message,
      max_qty_per_line: Number(form.max_qty_per_line) || 20,
    }
    if (campaign) {
      const { error } = await supabase.from('campaigns').update(row).eq('id', campaign.id)
      setBusy(false)
      if (error) return setError(errorText(error))
      setSaved(true)
      onSaved?.()
    } else {
      const { data, error } = await supabase.from('campaigns').insert(row).select('id').single()
      setBusy(false)
      if (error) return setError(errorText(error))
      navigate(`/admin/d/${data.id}?fane=produkter`)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Om dugnaden</h2>
        <Field label="Navn på dugnaden">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </Field>
        <Field label="Laget" hint="For eksempel G2012. Brukes som {lag} i tekstene">
          <Input value={form.team_name} onChange={(e) => set('team_name', e.target.value)} />
        </Field>
        <Field label="Hvem som organiserer" hint="Vises på alle sider. Skriv at det er foreldre/supportere, ikke klubben">
          <Input value={form.organizer_label} onChange={(e) => set('organizer_label', e.target.value)} required />
        </Field>
        <Field label="Hva pengene går til">
          <TextArea rows={2} value={form.purpose_text} onChange={(e) => set('purpose_text', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mål (kr til laget)">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={form.target_amount}
              onChange={(e) => set('target_amount', Number(e.target.value))}
            />
          </Field>
          <Field label="Bestillingsfrist">
            <Input type="date" value={form.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || null)} />
          </Field>
        </div>
        <Field label="Maks antall per vare i én bestilling">
          <Input
            type="number"
            min={1}
            max={999}
            value={form.max_qty_per_line}
            onChange={(e) => set('max_qty_per_line', Number(e.target.value))}
          />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Betaling fra foreldre</h2>
        <p className="text-sm text-muted">Foreldrene vippser det de skylder hit, med betalingskoden sin som melding.</p>
        <Field label="Vipps-navn">
          <Input value={form.admin_vipps_name} onChange={(e) => set('admin_vipps_name', e.target.value)} />
        </Field>
        <Field label="Vipps-nummer">
          <Input inputMode="tel" value={form.admin_vipps_phone} onChange={(e) => set('admin_vipps_phone', e.target.value)} />
        </Field>
        <Field label="Kontaktperson for e-post" hint="Svar på e-poster fra appen går til denne personen">
          <select
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
            value={form.contact_admin_user_id ?? ''}
            onChange={(e) => set('contact_admin_user_id', e.target.value || null)}
          >
            <option value="">Velg …</option>
            {admins.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.name || a.email}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Tekster foreldrene deler</h2>
        <p className="text-sm text-muted">
          Du kan bruke {PLACEHOLDERS.map((p) => `{${p}}`).join(', ')}. Foreldrene kan endre teksten før de deler.
        </p>
        <Field label="Kort tekst (SMS, chat)">
          <TextArea rows={4} value={form.share_template_short} onChange={(e) => set('share_template_short', e.target.value)} />
        </Field>
        <Field label="Lang tekst (Facebook)">
          <TextArea rows={8} value={form.share_template_long} onChange={(e) => set('share_template_long', e.target.value)} />
        </Field>
        <Field label="Påminnelse om frist" hint="Vises for foreldrene de siste tre dagene før fristen">
          <TextArea rows={3} value={form.reminder_template} onChange={(e) => set('reminder_template', e.target.value)} />
        </Field>
        <Field label="Betalingspåminnelse" hint="Per ubetalt bestilling. «Hei!» blir til «Hei Kari!»">
          <TextArea
            rows={3}
            value={form.payment_reminder_template}
            onChange={(e) => set('payment_reminder_template', e.target.value)}
          />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Avslutning</h2>
        <Field label="Avslutningsmelding" hint="Vises på alle sider når dugnaden er avsluttet: hvor mye som ble samlet inn og hva det betaler">
          <TextArea rows={4} value={form.closing_message} onChange={(e) => set('closing_message', e.target.value)} />
        </Field>
      </Card>

      <ErrorBox>{error}</ErrorBox>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Lagrer …' : saved ? 'Lagret ✓' : campaign ? 'Lagre' : 'Opprett dugnaden'}
      </Button>
    </form>
  )
}

export default function NewCampaignPage() {
  return (
    <>
      <TopBar title="Ny dugnad" back="/admin" />
      <Page>
        <CampaignSettings />
      </Page>
    </>
  )
}
