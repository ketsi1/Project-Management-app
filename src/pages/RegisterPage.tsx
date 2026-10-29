import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../api/ApiError'
import AuthLayout from '../components/layout/AuthLayout'
import Button from '../components/ui/Button'
import { Alert } from '../components/ui/Display'
import { TextField } from '../components/ui/Fields'
import Icon from '../components/ui/Icon'
import { useAuth } from '../context/authContext'

// Sign-up creates an employee account in an existing organization. It does not log in:
// the account stays pending (no view at all) until a manager approves it.
export default function RegisterPage() {
  const { register } = useAuth()
  const [fullName, setFullName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [doneMessage, setDoneMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fullName || !organizationName || !email || !password) {
      setError('Please fill in every field.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await register({ fullName, organizationName, email, password })
      setDoneMessage(result.message)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  if (doneMessage) {
    return (
      <AuthLayout title="Account created" subtitle="Waiting for approval">
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{doneMessage}</p>
        </div>
        <Link
          to="/login"
          className="mt-6 block text-center text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
        >
          Back to log in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create an account" subtitle="A manager will approve it before you can log in">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Full name" value={fullName} onChange={setFullName} autoComplete="name" />
        <TextField
          label="Organization to join"
          value={organizationName}
          onChange={setOrganizationName}
          autoComplete="organization"
          placeholder="Exact name, e.g. Acme Corp"
        />
        <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@company.com" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
          <TextField label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
        </div>
        <p className="text-xs text-slate-500">Use at least 8 characters.</p>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
