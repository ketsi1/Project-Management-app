import type { ReactNode } from 'react'
import BrandMark from '../ui/BrandMark'
import Icon, { type IconName } from '../ui/Icon'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

const CURRENT_YEAR = new Date().getFullYear()

const HIGHLIGHTS: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'board', title: 'Boards & lists', text: 'Drag work between your own custom statuses.' },
  { icon: 'users', title: 'Team capacity', text: 'See who is overloaded before deadlines slip.' },
  { icon: 'zap', title: 'Real-time', text: 'Every change appears for your team instantly.' },
]

// Split screen on desktop (brand panel + form), single column on phones.
export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh bg-white">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden w-[44%] max-w-xl shrink-0 overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative flex items-center gap-3">
          <BrandMark className="h-9 w-9" />
          <span className="text-lg font-bold tracking-tight">FlowDesk PM</span>
        </div>

        <div className="relative mt-auto">
          <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            Plan, track and deliver
            <span className="block text-indigo-300">work your way.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            One workspace for projects, tasks and team workload — shaped around how your organization actually works.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex items-start gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-indigo-300 ring-1 ring-inset ring-white/10">
                  <Icon name={h.icon} className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{h.title}</span>
                  <span className="block text-sm text-slate-400">{h.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-12 text-xs text-slate-500">© {CURRENT_YEAR} FlowDesk PM</p>
      </aside>

      {/* Form column */}
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-6 lg:bg-white">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="h-9 w-9" />
            <span className="text-lg font-bold tracking-tight text-slate-900">FlowDesk PM</span>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
