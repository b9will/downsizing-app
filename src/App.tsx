import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Shell from './components/Shell'
import { useStore } from './lib/hooks'
import { store } from './lib/store'
import { isStaff } from './lib/types'
import { cameraGrantedBefore } from './lib/camera'
import CameraSetup from './pages/CameraSetup'
import Details from './pages/Details'
import Home from './pages/Home'
import ItemForm from './pages/ItemForm'
import Login from './pages/Login'
import Plan from './pages/Plan'
import Room from './pages/Room'
import Rooms from './pages/Rooms'
import Scan from './pages/Scan'
import QuickScan from './pages/QuickScan'
import Sort from './pages/Sort'
import Settings from './pages/Settings'
import Book from './pages/Summary'
import SharePage from './pages/Share'
import Start from './pages/Start'
import Guest from './pages/Guest'
import CrewHome from './pages/crew/CrewHome'
import CrewJob from './pages/crew/CrewJob'
import CrewStop from './pages/crew/CrewStop'
import StickerEntry from './pages/crew/StickerEntry'
import StickerPrint from './pages/crew/StickerPrint'

function Loading() {
  return <div className="min-h-full flex items-center justify-center text-ink-2" role="status">Loading…</div>
}

function RequireAuth() {
  const ready = useStore(() => store.ready)
  const user = useStore(() => store.getUser())
  const loc = useLocation()
  if (!ready) return <Loading />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <Outlet />
}

/** Clients need a job; staff go to crew mode. */
function ClientOnly() {
  const user = useStore(() => store.getUser())
  const job = useStore(() => store.getJob())
  const loc = useLocation()
  if (isStaff(user) && !loc.pathname.startsWith('/settings')) return <Navigate to="/crew" replace />
  if (!job && !isStaff(user)) return <Navigate to="/start" replace />
  return <Outlet />
}
function StaffOnly() {
  const user = useStore(() => store.getUser())
  return isStaff(user) ? <Outlet /> : <Navigate to="/" replace />
}
function RequireCamera() {
  return cameraGrantedBefore() ? <Outlet /> : <Navigate to="/setup" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/g/:token" element={<Guest />} />
        <Route element={<RequireAuth />}>
          <Route path="/start" element={<Start />} />
          <Route path="/join" element={<Start />} />
          <Route path="/setup" element={<CameraSetup />} />
          <Route element={<StaffOnly />}>
            <Route path="/crew" element={<CrewHome />} />
            <Route path="/crew/stickers" element={<StickerPrint />} />
            <Route path="/crew/jobs/:jobId" element={<CrewJob />} />
            <Route path="/crew/jobs/:jobId/stop/:tag" element={<CrewStop />} />
            <Route path="/crew/jobs/:jobId/enter" element={<StickerEntry />} />
          </Route>
          <Route element={<ClientOnly />}>
            <Route element={<RequireCamera />}>
              <Route path="/rooms/:roomId/scan" element={<Scan />} />
              <Route path="/rooms/:roomId/quick" element={<QuickScan />} />
              <Route element={<Shell />}>
                <Route path="/" element={<Home />} />
                <Route path="/rooms" element={<Rooms />} />
                <Route path="/rooms/:roomId" element={<Room />} />
                <Route path="/rooms/:roomId/new" element={<ItemForm />} />
                <Route path="/items/:itemId" element={<ItemForm />} />
                <Route path="/plan" element={<Plan />} />
                <Route path="/sort" element={<Sort />} />
                <Route path="/book" element={<Book />} />
                <Route path="/summary" element={<Navigate to="/book" replace />} />
                <Route path="/share" element={<SharePage />} />
                <Route path="/details" element={<Details />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
