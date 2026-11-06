import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { errorMessage } from '../api/ApiError'
import AuthLayout from '../components/layout/AuthLayout'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import { Alert, Spinner } from '../components/ui/Display'
import { TextField } from '../components/ui/Fields'
import Icon from '../components/ui/Icon'
import { useAuth } from '../context/authContext'
import type { DemoAccount } from '../types'
import { cn } from '../utils/format'

const roleTone: Record<string, string> = {
  owner: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  admin: 'bg-violet-50 text-violet-700 ring-violet-200',
  manager: 'bg-sky-50 text-sky-700 ring-sky-200',
  member: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<DemoAccount[]>([])
  const [quickEmail, setQuickEmail] = useState<string | null>(null)

  // One-click logins for each role. The backend only lists them outside production.
  useEffect(() => {
    api
      .demoAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]))
  }, [])

  async function signIn(credentials: { email: string; password: string }) {
    setError('')
    try {
      await login(credentials)
      navigate('/app')
    } catch (e) {
      setError(errorMessage(e))
      setLoading(false)
      setQuickEmail(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    await signIn({ email, password })
  }

  async function quickLogin(account: DemoAccount) {
    setEmail(account.email)
    setPassword(account.password)
    setQuickEmail(account.email)
    await signIn({ email: account.email, password: account.password })
  }

  const busy = loading || quickEmail !== null

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your workspace">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@company.com" />
        <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={loading} disabled={busy} className="w-full">
          Log in
        </Button>
      </form>

      {accounts.length > 0 && (
        <section className="mt-8" aria-labelledby="quick-login">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <h2 id="quick-login" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Quick login by role
            </h2>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {accounts.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => quickLogin(account)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-card transition',
                    'hover:border-indigo-300 hover:shadow-md focus-visible:border-indigo-400 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-indigo-100',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    quickEmail === account.email && 'border-indigo-400 ring-3 ring-indigo-100',
                  )}
                  aria-label={`Log in as ${account.fullName}, ${account.roleName}`}
                >
                  <Avatar name={account.fullName} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-slate-900">{account.fullName}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-px text-[11px] font-semibold ring-1 ring-inset',
                          roleTone[account.role] ?? 'bg-slate-100 text-slate-600 ring-slate-200',
                        )}
                      >
                        {account.roleName}
                      </span>
                      <span className="truncate text-xs text-slate-500">{account.email}</span>
                    </span>
                  </span>
                  {quickEmail === account.email ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-xs text-slate-400">Seeded accounts for trying each role. Hidden in production.</p>
        </section>
      )}

      <p className="mt-6 text-center text-sm text-slate-600">
        No account yet?{' '}
        <Link to="/register" className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
