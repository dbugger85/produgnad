import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { ConfirmProvider } from './components/Confirm'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Footer } from './components/Footer'
import { RequireAdmin, RequireLogin } from './components/Guards'
import { ErrorBox, Loading, Page } from './components/ui'
import { AuthProvider } from './lib/auth'
import FriendOrderPage from './pages/FriendOrderPage'
import OrderStatusPage from './pages/OrderStatusPage'

// Friends only load the order and status pages first; the rest is fetched in the background
// right after, so later page changes don't wait for code.
const loadHomePage = () => import('./pages/HomePage')
const loadLoginPage = () => import('./pages/LoginPage')
const loadJoinPage = () => import('./pages/JoinPage')
const loadParentPage = () => import('./pages/parent/ParentPage')
const loadOrderEditorPage = () => import('./pages/parent/OrderEditorPage')
const loadAdminHome = () => import('./pages/admin/AdminHome')
const loadNewCampaignPage = () => import('./pages/admin/CampaignSettings')
const loadCampaignPage = () => import('./pages/admin/CampaignPage')
const loadPeoplePage = () => import('./pages/admin/PeoplePage')
const loadPersonsPage = () => import('./pages/admin/PersonsPage')
const loadPackingPage = () => import('./pages/PackingPage')
const loadAllPackingPage = () => import('./pages/admin/AllPackingPage')
const loadAssignExtraPage = () => import('./pages/parent/AssignExtraPage')

function preloadPages() {
  for (const load of [loadHomePage, loadLoginPage, loadJoinPage, loadParentPage, loadOrderEditorPage, loadAdminHome, loadNewCampaignPage, loadCampaignPage, loadPeoplePage, loadPersonsPage, loadPackingPage, loadAllPackingPage, loadAssignExtraPage]) void load().catch(() => {})
}
const HomePage = lazy(loadHomePage)
const LoginPage = lazy(loadLoginPage)
const JoinPage = lazy(loadJoinPage)
const ParentPage = lazy(loadParentPage)
const OrderEditorPage = lazy(loadOrderEditorPage)
const AdminHome = lazy(loadAdminHome)
const NewCampaignPage = lazy(loadNewCampaignPage)
const CampaignPage = lazy(loadCampaignPage)
const PeoplePage = lazy(loadPeoplePage)
const PersonsPage = lazy(loadPersonsPage)
const PackingPage = lazy(loadPackingPage)
const AllPackingPage = lazy(loadAllPackingPage)
const AssignExtraPage = lazy(loadAssignExtraPage)

export default function App() {
  useEffect(() => {
    // Friends on the order or status page don't need the rest: save their mobile data
    if (/^\/(k|status)\//.test(window.location.pathname)) return
    const idle = (window as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    const id = idle ? idle(preloadPages) : window.setTimeout(preloadPages, 1500)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <AuthProvider>
      <ConfirmProvider>
      <BrowserRouter>
        <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/k/:code" element={<FriendOrderPage />} />
            <Route path="/status/:token" element={<OrderStatusPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/logg-inn" element={<LoginPage />} />
            <Route path="/bli-med/:code" element={<JoinPage />} />
            <Route path="/forelder/:cpId" element={<RequireLogin><ParentPage /></RequireLogin>} />
            <Route path="/forelder/:cpId/ny" element={<RequireLogin><OrderEditorPage /></RequireLogin>} />
            <Route path="/forelder/:cpId/ordre/:orderId" element={<RequireLogin><OrderEditorPage /></RequireLogin>} />
            <Route path="/forelder/:cpId/fra-ekstra/:orderId" element={<RequireLogin><AssignExtraPage /></RequireLogin>} />
            <Route path="/pakkeliste/:cpId" element={<RequireLogin><PackingPage /></RequireLogin>} />
            <Route path="/admin/d/:id/pakkelister" element={<RequireAdmin><AllPackingPage /></RequireAdmin>} />
            <Route path="/admin" element={<RequireAdmin><AdminHome /></RequireAdmin>} />
            <Route path="/admin/ny" element={<RequireAdmin><NewCampaignPage /></RequireAdmin>} />
            <Route path="/admin/d/:id" element={<RequireAdmin><CampaignPage /></RequireAdmin>} />
            <Route path="/admin/personer" element={<RequireAdmin><PersonsPage /></RequireAdmin>} />
            <Route path="/admin/folk" element={<RequireAdmin><PeoplePage /></RequireAdmin>} />
            <Route path="*" element={<Page><ErrorBox>Fant ikke siden</ErrorBox></Page>} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
        <Footer />
      </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  )
}
