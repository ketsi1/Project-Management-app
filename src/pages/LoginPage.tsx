import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { errorMessage } from '../api/ApiError'
import AuthLayout from '../components/layout/AuthLayout'
import Button from '../components/ui/Button'
import { Alert } from '../components/ui/Display'
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
