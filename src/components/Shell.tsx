import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { Home, LayoutGrid, ListChecks, ClipboardList } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/rooms', label: 'Rooms', Icon: LayoutGrid, end: false },
  { to: '/plan', label: 'Plan', Icon: ListChecks, end: false },
  { to: '/summary', label: 'Summary', Icon: ClipboardList, end: false },
]

export default function Shell() {
  const loc = useLocation()
  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <Outlet key={loc.pathname} />
        </AnimatePresence>
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 bg-surface/90 backdrop-blur border-t border-line pb-[var(--spacing-safe-b)]">
        <div className="grid grid-cols-4 max-w-xl mx-auto">
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 h-16 text-[13px] font-medium ${isActive ? 'text-ink' : 'text-ink-3'}`}>
              {({ isActive }) => (<><Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />{label}</>)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
