import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Footer } from './components/Footer'
import { RequireAdmin, RequireLogin } from './components/Guards'
import { ErrorBox, Loading, Page } from './components/ui'
import { AuthProvider } from './lib/auth'
import FriendOrderPage from './pages/FriendOrderPage'
import OrderStatusPage from './pages/OrderStatusPage'

// Friends only load the order and status pages; the rest loads on demand.
const HomePage = lazy(() => import('./pages/HomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const JoinPage = lazy(() => import('./pages/JoinPage'))
const ParentPage = lazy(() => import('./pages/parent/ParentPage'))
const OrderEditorPage = lazy(() => import('./pages/parent/OrderEditorPage'))
const AdminHome = lazy(() => import('./pages/admin/AdminHome'))
const NewCampaignPage = lazy(() => import('./pages/admin/CampaignSettings'))
const CampaignPage = lazy(() => import('./pages/admin/CampaignPage'))
const PeoplePage = lazy(() => import('./pages/admin/PeoplePage'))
const PersonsPage = lazy(() => import('./pages/admin/PersonsPage'))
const PackingPage = lazy(() => import('./pages/PackingPage'))
const AllPackingPage = lazy(() => import('./pages/admin/AllPackingPage'))
const AssignExtraPage = lazy(() => import('./pages/parent/AssignExtraPage'))

export default function App() {
  return (
    <AuthProvider>
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
            <Route path="*" element={<Page><ErrorBox>Fant ikke siden.</ErrorBox></Page>} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
        <Footer />
      </BrowserRouter>
    </AuthProvider>
  )
}
