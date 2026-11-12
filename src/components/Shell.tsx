import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { Home, LayoutGrid, ListChecks, Share, Truck, Check } from 'lucide-react'
import { useStore } from '../lib/hooks'
import { store } from '../lib/store'

const side = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/rooms', label: 'Rooms', Icon: LayoutGrid, end: false },
  null, // the Book button sits here
  { to: '/plan', label: 'Plan', Icon: ListChecks, end: false },
  { to: '/share', label: 'Share', Icon: Share, end: false },
] as const

export default function Shell() {
  const loc = useLocation()
  const booked = useStore(() => { const s = store.getJob()?.status; return !!s && s !== 'tagging' })
  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <Outlet key={loc.pathname} />
        </AnimatePresence>
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-line pb-[var(--spacing-safe-b)]">
        <div className="grid grid-cols-5 max-w-xl mx-auto">
          {side.map((t) => t ? (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 h-16 text-[13px] font-medium ${isActive ? 'text-ink font-bold' : 'text-ink-2'}`}>
              {({ isActive }) => (<><t.Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />{t.label}</>)}
            </NavLink>
          ) : (
            // The one big action: book the crew and the truck.
            <NavLink key="book" to="/book" aria-label={booked ? 'Your booking' : 'Book your move'} className="flex flex-col items-center h-16">
              {({ isActive }) => (
                <span className={`-mt-6 w-[68px] h-[68px] rounded-full flex flex-col items-center justify-center text-white shadow-[0_0_0_5px_var(--color-surface),0_8px_22px_rgba(0,0,0,0.28)] active:scale-95 transition-transform ${booked ? 'bg-accent' : 'bg-ink'} ${isActive ? 'scale-105' : ''}`}>
                  {booked ? <Check size={24} strokeWidth={2.6} /> : <Truck size={24} strokeWidth={2.2} />}
                  <span className="text-[12px] font-bold leading-none mt-0.5">{booked ? 'Booked' : 'Book'}</span>
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
