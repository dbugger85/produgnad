import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, ErrorBox, Input, Loading, Page, TopBar } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { errorText } from '../../lib/errors'
import { phone } from '../../lib/format'
import { supabase } from '../../lib/supabase'

interface Person {
  user_id: string
  email: string
  name: string
  phone: string
  is_admin: boolean
  role_title: string
  campaign_parents: { child_first_name: string; campaigns: { name: string } | null }[]
}

/** /admin/personer: everyone in the app, parents and admins; admins can change who is admin. */
export default function PersonsPage() {
  const { profile } = useAuth()
  const [people, setPeople] = useState<Person[] | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email, name, phone, is_admin, role_title, campaign_parents(child_first_name, campaigns(name))')
    if (error) setError(errorText(error))
    setPeople((data as unknown as Person[]) ?? [])
  }
  useEffect(() => {
    void load()
  }, [])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (people ?? [])
      .filter((p) => !q || `${p.name} ${p.email} ${p.phone}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.is_admin) - Number(a.is_admin) || (a.name || a.email).localeCompare(b.name || b.email, 'nb'))
  }, [people, search])

  async function makeAdmin(p: Person) {
    if (!confirm(`Gjøre ${p.name || p.email} til admin? Admins ser og kan endre alle dugnader, og personen får en e‑post.`)) return
    setError('')
    setMessage('')
    setBusy(p.user_id)
    const { error } = await supabase.functions.invoke('invite-admin', { body: { email: p.email } })
    setBusy(null)
    if (error) {
      let code = ''
      try {
        code = ((await (error as { context?: Response }).context?.json()) as { error?: string })?.error ?? ''
      } catch {
        // No readable body
      }
      return setError(errorText(code || error))
    }
    setMessage(`${p.name || p.email} er nå admin og har fått en e‑post.`)
    await load()
  }

  async function removeAdmin(p: Person) {
    if (!confirm(`Fjerne ${p.name || p.email} som admin? Personen beholder bestillingene sine som selger.`)) return
    setError('')
    setMessage('')
    setBusy(p.user_id)
    const { error } = await supabase.rpc('set_admin', { p_email: p.email, p_is_admin: false })
    setBusy(null)
    if (error) return setError(errorText(error))
    setMessage(`${p.name || p.email} er ikke lenger admin.`)
    await load()
  }

  if (people === null) return <Loading />
  const admins = people.filter((p) => p.is_admin).length

  return (
    <>
      <TopBar title="Personer" back="/admin" />
      <Page>
        <p className="text-sm text-muted">
          {people.length} personer, {admins} {admins === 1 ? 'admin' : 'admins'}. Nye personer kommer hit når de melder seg på
          som selger, eller når du legger dem til som admin under Innstillinger
        </p>
        <Input
          type="search"
          placeholder="Søk på navn, e‑post eller telefon"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Søk"
        />
        <ErrorBox>{error}</ErrorBox>
        {message && <p className="text-sm text-green-800">{message}</p>}
        {shown.length === 0 && <p className="text-muted">Ingen treff.</p>}
        {shown.map((p) => {
          const me = p.user_id === profile?.user_id
          return (
            <Card key={p.user_id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-bold">
                    <span className="truncate">{p.name || p.email}</span>
                    {p.is_admin && <Badge tone="blue">Admin{p.role_title && ` · ${p.role_title}`}</Badge>}
                    {me && <Badge>Deg</Badge>}
                  </div>
                  <div className="truncate text-sm text-muted">
                    {[p.name ? p.email : '', p.phone ? phone(p.phone) : ''].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <div className="text-sm">
                {p.campaign_parents.length > 0 ? (
                  <>
                    Selger i:{' '}
                    {p.campaign_parents
                      .map((cp) => `${cp.campaigns?.name ?? '?'}${cp.child_first_name ? ` (${cp.child_first_name})` : ''}`)
                      .join(', ')}
                  </>
                ) : (
                  <span className="text-muted">Ikke med i noen dugnad som selger</span>
                )}
              </div>
              {!me && (
                <div>
                  {p.is_admin ? (
                    <Button variant="secondary" className="min-h-10 text-sm" disabled={busy === p.user_id} onClick={() => void removeAdmin(p)}>
                      Fjern admin
                    </Button>
                  ) : (
                    <Button variant="secondary" className="min-h-10 text-sm" disabled={busy === p.user_id} onClick={() => void makeAdmin(p)}>
                      {busy === p.user_id ? 'Lagrer …' : 'Gjør til admin'}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </Page>
    </>
  )
}
