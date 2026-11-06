import { useEffect, type ReactNode } from 'react'
import Icon from './Icon'

interface DrawerProps {
  title: string
  onClose: () => void
  children: ReactNode
}

// A panel that slides in from the right (full screen on phones). Escape or the backdrop closes it.
export default function Drawer({ title, onClose, children }: DrawerProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      // A modal opened from inside the drawer handles its own Escape first.
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-drawer])')) onClose()
    }
    window.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-drawer
        className="flex h-full w-full max-w-4xl flex-col bg-slate-50 shadow-pop ring-1 ring-slate-900/5 animate-slide-in-right"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <p className="truncate text-sm font-semibold text-slate-700">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  )
}
