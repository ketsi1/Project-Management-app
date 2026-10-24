import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { usingMockApi } from '../api'
import { errorMessage } from '../api/ApiError'
import AuthLayout from '../components/layout/AuthLayout'
import Button from '../components/ui/Button'
import { TextField } from '../components/ui/Fields'
import { useAuth } from '../context/authContext'

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

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your workspace">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        No account yet?{' '}
        <Link to="/register" className="font-medium text-blue-600 hover:underline">
          Create one
        </Link>
      </p>

      {usingMockApi && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Demo mode: data is saved in this browser only. Create an account first, then log in with it.
        </p>
      )}
    </AuthLayout>
  )
}
