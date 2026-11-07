import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { LoginForm } from '../components/LoginForm'
import { Transparency } from '../components/Transparency'
import { Button, Card, ErrorBox, Field, Input, Loading, Logo, Page, Title } from '../components/ui'
import { useAuth } from '../lib/auth'
import { errorText } from '../lib/errors'
import { longDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { PublicCampaign } from '../lib/types'

/** /bli-med/<join_code>: a parent signs up as a seller in a campaign. */
export default function JoinPage() {
  const { code = '' } = useParams()
  const { session, profile, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<PublicCampaign | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [child, setChild] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('public_campaign_by_join', { p_join_code: code }).then(({ data }) => setCampaign((data as PublicCampaign) ?? null))
  }, [code])

  useEffect(() => {
    if (profile) {
      setName((n) => n || profile.name)
      setPhone((p) => p || profile.phone)
    }
  }, [profile])

  if (campaign === undefined || loading) return <Loading />
  if (campaign === null)
    return (
      <Page>
        <ErrorBox>Fant ikke denne påmeldingslenken</ErrorBox>
      </Page>
    )

  async function join() {
    setError('')
    setBusy(true)
    const { data, error } = await supabase.rpc('join_campaign', {
      p_join_code: code,
      p_name: name,
      p_phone: phone,
      p_child_first_name: child,
    })
    setBusy(false)
    if (error) return setError(errorText(error))
    await refreshProfile()
    navigate(`/forelder/${data as string}`)
  }

  return (
    <Page>
      <header className="space-y-1">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <p className="text-sm font-semibold text-brand">{campaign.organizer_label}</p>
        </div>
        <Title>Bli med som selger: {campaign.name}</Title>
        {campaign.deadline && <p className="text-ink">Bestillingsfrist {longDate(campaign.deadline)}</p>}
      </header>

      {!session ? (
        <Card className="space-y-3">
          <p>Først logger du inn med e‑posten din. Du får en kode, ikke noe passord</p>
          <LoginForm next={`/bli-med/${code}`} />
        </Card>
      ) : (
        <Card>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void join()
            }}
          >
            <Field label="Navnet ditt" hint="Vennene dine ser dette når de betaler">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} />
            </Field>
            <Field label="Mobilnummer (Vipps)" hint="Vises til de som bestiller, så de kan vippse deg">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                required
                minLength={8}
              />
            </Field>
            <Field label="Barnets fornavn" hint="Vises som «forelder til …»">
              <Input value={child} onChange={(e) => setChild(e.target.value)} maxLength={40} />
            </Field>
            <p className="text-xs text-muted">Innlogget som {session.user.email}</p>
            <ErrorBox>{error}</ErrorBox>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Lagrer …' : 'Bli med'}
            </Button>
          </form>
        </Card>
      )}
      <Transparency campaign={campaign} />
    </Page>
  )
}
