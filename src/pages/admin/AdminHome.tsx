import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Card, Loading, Page, TopBar } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { longDate } from '../../lib/format'
import { cached, remember } from '../../lib/pageCache'
import { supabase } from '../../lib/supabase'
import type { Campaign } from '../../lib/types'

export default function AdminHome() {
  const { session } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(() => cached<Campaign[]>('admin:campaigns') ?? null)
  const [mine, setMine] = useState<{ id: string; child_first_name: string; campaigns: { name: string } | null }[]>(
    () => cached('admin:mine') ?? [],
  )
  useEffect(() => {
    if (!session) return
    supabase
      .from('campaign_parents')
      .select('id, child_first_name, campaigns(name)')
      .eq('parent_user_id', session.user.id)
      .then(({ data }) => setMine(remember('admin:mine', (data as unknown as typeof mine) ?? [])))
  }, [session])
  useEffect(() => {
    supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setCampaigns(remember('admin:campaigns', (data as Campaign[]) ?? [])))
  }, [])

  return (
    <>
      <TopBar title="Administrasjon" right={<Link to="/admin/folk" className="text-sm font-semibold text-brand">Innstillinger</Link>} />
      <Page>
        {mine.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Dugnader jeg er med på</h2>
            {mine.map((m) => (
              <Link key={m.id} to={`/forelder/${m.id}`} className="block">
                <Card className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">{m.campaigns?.name}</div>
                    <div className="text-sm text-muted">Mine bestillinger{m.child_first_name && ` (${m.child_first_name})`}</div>
                  </div>
                  <span className="text-xl text-brand">→</span>
                </Card>
              </Link>
            ))}
          </section>
        )}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Dugnader jeg administrerer</h2>
            {/* Small, so the heading keeps the same distance to the cards as the one above */}
            <Link to="/admin/ny" className="-my-1 shrink-0 rounded-full bg-brand px-3.5 py-1 text-sm font-semibold text-white">
              Ny
            </Link>
          </div>
        {campaigns === null ? (
          <Loading inline />
        ) : campaigns.length === 0 ? (
          <p className="text-muted">Ingen dugnader ennå</p>
        ) : (
          campaigns.map((c) => (
            <Link key={c.id} to={`/admin/d/${c.id}`} className="block">
              <Card className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{c.name}</span>
                  {c.closed_at ? <Badge>Avsluttet</Badge> : c.locked_at ? <Badge tone="amber">Låst</Badge> : <Badge tone="green">Åpen</Badge>}
                </div>
                <div className="text-sm text-muted">{c.deadline ? `Frist ${longDate(c.deadline)}` : 'Ingen frist'}</div>
              </Card>
            </Link>
          ))
        )}
        </section>
        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Annet</h2>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/personer"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-4 font-semibold text-brand ring-1 ring-brand/30"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
                <circle cx="17" cy="9" r="2.6" />
                <path d="M16.5 14.6c2.7.2 4.4 1.9 5 4.9" />
              </svg>
              Personer
            </Link>
            <p className="text-sm text-muted">Alle foreldre og admins, og hvem som er admin</p>
          </div>
        </section>
      </Page>
    </>
  )
}
