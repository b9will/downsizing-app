import { Drawer } from 'vaul'
import { motion, AnimatePresence } from 'motion/react'
import type { ReactNode } from 'react'
import { TAGS, TAG_ICON, TAG_ORDER, type Tag } from '../lib/types'

/** Page wrapper with a soft slide-in. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      className={`page ${className}`}
    >
      {children}
    </motion.div>
  )
}

/** Bottom sheet. Drag to dismiss, snaps, keyboard-safe. */
export function Sheet({ open, onOpenChange, children, footer, dismissible = true }: { open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode; footer?: ReactNode; dismissible?: boolean }) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={dismissible} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-[28px] outline-none max-h-[92dvh] flex flex-col">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line" aria-hidden />
          <Drawer.Title className="sr-only">Item</Drawer.Title>
          <div className={`overflow-y-auto px-5 pt-3 ${footer ? 'pb-4' : 'pb-[calc(var(--spacing-safe-b)+20px)]'}`}>{children}</div>
          {/* Always-visible actions, so Save is never below the fold or behind the keyboard. */}
          {footer && <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[calc(var(--spacing-safe-b)+12px)]">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/** Destination picker: eight big sticker dots, each with its pictogram and word. One tap. */
export function TagChips({ value, onChange, compact = false }: { value: Tag | null; onChange: (t: Tag) => void; compact?: boolean }) {
  const size = compact ? 48 : 58
  return (
    <div className="grid grid-cols-4 gap-x-1 gap-y-3" role="radiogroup" aria-label="Where does it go">
      {TAG_ORDER.map((t) => {
        const on = value === t
        return (
          <button key={t} type="button" role="radio" aria-checked={on} onClick={() => onChange(t)}
            className="flex flex-col items-center gap-1.5 min-h-11 active:scale-95 transition-transform">
            <Dot tag={t} size={size} selected={on} />
            <span className={`text-[14px] ${on ? 'font-bold' : 'font-semibold'}`}>{TAGS[t].name}</span>
          </button>
        )
      })}
    </div>
  )
}

/** The sticker dot. From 22px up it carries its pictogram; white gets an ink ring so it reads on white. */
export function Dot({ tag, size = 14, selected = false }: { tag: Tag; size?: number; selected?: boolean }) {
  const t = TAGS[tag]
  const ring = selected ? '0 0 0 3px #fff, 0 0 0 6px #111' : tag === 'undecided' ? 'inset 0 0 0 2px #111' : tag === 'donate' && size < 22 ? 'inset 0 0 0 1.5px rgba(0,0,0,0.25)' : undefined
  return (
    <span aria-hidden className="rounded-full shrink-0 inline-flex items-center justify-center" style={{ width: size, height: size, background: t.hex, color: t.fg, boxShadow: ring }}>
      {size >= 22 && <svg width={Math.round(size * 0.46)} height={Math.round(size * 0.46)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={TAG_ICON[tag]} /></svg>}
    </span>
  )
}

export function TagPill({ tag, small = false }: { tag: Tag; small?: boolean }) {
  const t = TAGS[tag]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${small ? 'px-2 py-px text-[12px] uppercase tracking-[0.03em]' : 'px-2.5 py-0.5 text-[13px] uppercase tracking-[0.03em]'}`} style={{ background: t.hex, color: t.fg, boxShadow: tag === 'undecided' ? 'inset 0 0 0 1px #c9c6be' : undefined }}>
      {TAGS[tag].name}
    </span>
  )
}

/** Transient confirmation with undo. */
export function Toast({ show, text, onUndo }: { show: boolean; text: string; onUndo?: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-ink text-white rounded-full pl-5 pr-2 py-2 shadow-xl"
          style={{ bottom: 'calc(var(--spacing-safe-b) + 112px)' }} role="status"
        >
          <span className="font-semibold text-[15px]">{text}</span>
          {onUndo && <button className="rounded-full bg-white/15 px-3 py-1.5 text-[14px] font-semibold" onClick={onUndo}>Undo</button>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** "Is this a set?" Shown for things that usually come in multiples. */
export function SetPicker({ name, value, onChange }: { name: string; value: number; onChange: (n: number) => void }) {
  const opts = [1, 2, 4, 6, 8]
  const custom = !opts.includes(value)
  const chip = (on: boolean) => `h-12 min-w-12 px-4 rounded-full font-semibold text-[16px] ${on ? 'bg-ink text-white' : 'bg-surface-2 text-ink'}`
  return (
    <div>
      <div className="sec mb-2">Is this a set?</div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`How many of ${name || 'this item'}`}>
        {opts.map((n) => <button key={n} type="button" aria-pressed={value === n} className={chip(value === n)} onClick={() => onChange(n)}>{n === 1 ? 'Just one' : n}</button>)}
        <span className={`flex items-center rounded-full ${custom ? 'bg-ink text-white' : 'bg-surface-2'}`}>
          <button type="button" aria-label="One fewer" className="w-11 h-12 text-[22px] font-semibold" onClick={() => onChange(Math.max(1, value - 1))}>−</button>
          <span className="min-w-6 text-center font-semibold tabular-nums" aria-live="polite">{value}</span>
          <button type="button" aria-label="One more" className="w-11 h-12 text-[22px] font-semibold" onClick={() => onChange(Math.min(99, value + 1))}>+</button>
        </span>
      </div>
      {value > 1 && <p className="text-ink-2 text-[14px] mt-1.5">Set of {value}. They stay together and go to the same place.</p>}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: { options: Array<[T, string]>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 p-1 rounded-xl bg-surface-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`h-11 rounded-lg text-[15px] font-medium transition-colors ${value === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}>{label}</button>
      ))}
    </div>
  )
}
