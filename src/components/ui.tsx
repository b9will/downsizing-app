import { Drawer } from 'vaul'
import { motion, AnimatePresence } from 'motion/react'
import type { ReactNode } from 'react'
import { TAGS, TAG_ORDER, type Tag } from '../lib/types'

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
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-2xl outline-none max-h-[92dvh] flex flex-col">
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

/** Tag chip row. One tap. */
export function TagChips({ value, onChange, compact = false }: { value: Tag | null; onChange: (t: Tag) => void; compact?: boolean }) {
  const order = TAG_ORDER
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-2'}`} role="radiogroup" aria-label="What should happen to it">
      {order.map((t) => {
        const on = value === t
        return (
          <button
            key={t} type="button" role="radio" aria-checked={on} onClick={() => onChange(t)}
            className={`flex items-center gap-2 h-12 px-3 rounded-xl border text-left transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink'}`}
          >
            <Dot tag={t} />
            <span className={`font-medium ${compact ? 'text-[13px]' : 'text-[15px]'}`}>{TAGS[t].name}</span>
          </button>
        )
      })}
    </div>
  )
}

/** The sticker dot. White and yellow get a ring so they read on white. */
export function Dot({ tag, size = 14 }: { tag: Tag; size?: number }) {
  return <span aria-hidden className="rounded-full shrink-0 inline-block" style={{ width: size, height: size, background: TAGS[tag].hex, boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,0.25)' }} />
}

export function TagPill({ tag, small = false }: { tag: Tag; small?: boolean }) {
  const t = TAGS[tag]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-semibold ${small ? 'px-1.5 py-px text-[12px] uppercase tracking-[0.03em]' : 'px-2 py-0.5 text-[13px] uppercase tracking-[0.03em]'}`} style={{ background: t.hex, color: t.fg, boxShadow: tag === 'undecided' ? 'inset 0 0 0 1px #c9c6be' : undefined }}>
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
