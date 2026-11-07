import { Link, useParams, useSearchParams } from 'react-router'
import { ErrorBox, Loading, Page, TopBar } from '../../components/ui'
import { useAdminData } from '../../lib/adminData'
import { CampaignSettings } from './CampaignSettings'
import { OrdersTab } from './OrdersTab'
import { OverviewTab } from './OverviewTab'
import { ParentsTab } from './ParentsTab'
import { ProductsTab } from './ProductsTab'

const TABS = [
  { key: 'oversikt', label: 'Oversikt' },
  { key: 'foreldre', label: 'Foreldre' },
  { key: 'bestillinger', label: 'Bestillinger' },
  { key: 'produkter', label: 'Varer' },
  { key: 'innstillinger', label: 'Innstillinger' },
] as const

export default function CampaignPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = params.get('fane') ?? 'oversikt'
  const { data, error, reload } = useAdminData(id)

  if (data === undefined) return <Loading />
  if (data === null) return <Page><ErrorBox>Fant ikke dugnaden.</ErrorBox></Page>

  return (
    <>
      <TopBar title={data.campaign.name} back="/admin" wide />
      <nav className="no-print sticky top-[53px] z-10 overflow-x-auto border-b border-line bg-cream">
        <div className="mx-auto flex max-w-4xl gap-1 px-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setParams({ fane: t.key }, { replace: true })}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.key ? 'border-brand text-brand' : 'border-transparent text-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <Page wide>
        <ErrorBox>{error}</ErrorBox>
        {tab === 'oversikt' && <OverviewTab data={data} reload={reload} />}
        {tab === 'foreldre' && <ParentsTab data={data} reload={reload} />}
        {tab === 'bestillinger' && <OrdersTab data={data} reload={reload} />}
        {tab === 'produkter' && <ProductsTab campaignId={id} products={data.products} reload={reload} />}
        {tab === 'innstillinger' && <CampaignSettings key={data.campaign.id} campaign={data.campaign} onSaved={reload} />}
        <Link to="/admin" className="block pt-4 text-sm text-muted">
          ← Alle dugnader
        </Link>
      </Page>
    </>
  )
}
