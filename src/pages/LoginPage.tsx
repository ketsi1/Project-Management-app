import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { usingMockApi } from '../api'
import { errorMessage } from '../api/ApiError'
import AuthLayout from '../components/layout/AuthLayout'
import Button from '../components/ui/Button'
import { Alert } from '../components/ui/Display'
import { TextField } from '../components/ui/Fields'
import Icon, { type IconName } from '../components/ui/Icon'
import { useAuth } from '../context/authContext'
import { cn } from '../utils/format'

const DEMO_ACCOUNTS: Array<{ email: string; name: string; role: string; view: string; icon: IconName; iconClass: string }> = [
  { email: 'alex@acme.com', name: 'Alex Morgan', role: 'Boss / Project Manager', view: 'Manager view', icon: 'briefcase', iconClass: 'bg-indigo-50 text-indigo-600' },
  { email: 'sarah@acme.com', name: 'Sarah Connor', role: 'Lead Developer', view: 'Employee view', icon: 'code', iconClass: 'bg-sky-50 text-sky-600' },
  { email: 'david@acme.com', name: 'David Kim', role: 'Product Designer', view: 'Employee view', icon: 'palette', iconClass: 'bg-violet-50 text-violet-600' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await login({ email, password })
      navigate('/app')
    } catch (e) {
      setError(errorMessage(e))
      setLoading(false)
    }
  }

  async function handleDemoLogin(demoEmail: string) {
    setError('')
    setLoading(true)
    try {
      await login({ email: demoEmail, password: 'password123' })
      navigate('/app')
    } catch (e) {
      setError(errorMessage(e))
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your workspace">
      {/* 1-click demo logins */}
      {usingMockApi && (
        <div className="mb-7">
          <p className="text-[13px] font-medium text-slate-700">Try a demo account</p>
          <div className="stagger mt-2.5 grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin(account.email)}
                className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-card transition-[translate,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-indigo-300 hover:shadow-card-hover active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', account.iconClass)}>
                  <Icon name={account.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{account.name}</span>
                  <span className="block truncate text-xs text-slate-500">{account.role}</span>
                </span>
                <span className="hidden shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-700 sm:inline">
                  {account.view}
                </span>
                <Icon
                  name="arrowRight"
                  className="h-4 w-4 shrink-0 text-slate-300 transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-500"
                />
              </button>
            ))}
          </div>

          <div className="mt-7 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or log in with email
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@company.com" />
        <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={loading} className="w-full">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        No account yet?{' '}
        <Link to="/register" className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
