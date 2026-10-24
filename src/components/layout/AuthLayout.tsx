import type { ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

// The centred white card used by the login and registration pages.
export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-lg font-bold text-blue-700">PM Tool</p>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
