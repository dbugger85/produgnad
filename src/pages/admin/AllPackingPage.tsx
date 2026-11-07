import { useParams } from 'react-router'
import { PackingList } from '../../components/PackingList'
import { Button, ErrorBox, Loading, Page, TopBar } from '../../components/ui'
import { useAdminData } from '../../lib/adminData'

/** /admin/d/:id/pakkelister: every parent's packing list, one per printed page. */
export default function AllPackingPage() {
  const { id = '' } = useParams()
  const { data } = useAdminData(id)
  if (data === undefined) return <Loading />
  if (data === null) return <Page><ErrorBox>Fant ikke dugnaden.</ErrorBox></Page>

  const withOrders = data.parents
    .filter((p) => data.orders.some((o) => o.campaign_parent_id === p.id))
    .sort((a, b) => a.profiles.name.localeCompare(b.profiles.name, 'nb'))

  return (
    <>
      <TopBar
        title="Alle pakkelister"
        back={`/admin/d/${id}?fane=foreldre`}
        right={<Button variant="secondary" onClick={() => window.print()}>Skriv ut</Button>}
      />
      <Page>
        {withOrders.length === 0 && <p className="text-muted">Ingen bestillinger ennå.</p>}
        {withOrders.map((p) => (
          <PackingList
            key={p.id}
            campaignName={data.campaign.name}
            organizer={data.campaign.organizer_label}
            parent={{ name: p.profiles.name, phone: p.profiles.phone, child_first_name: p.child_first_name, payment_code: p.payment_code }}
            orders={data.orders.filter((o) => o.campaign_parent_id === p.id)}
            products={data.products}
          />
        ))}
      </Page>
    </>
  )
}
