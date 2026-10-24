import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { errorMessage } from '../api/ApiError'
import AuthLayout from '../components/layout/AuthLayout'
import Button from '../components/ui/Button'
import { TextField } from '../components/ui/Fields'
import { useAuth } from '../context/authContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      await register({ fullName, organizationName, email, password })
      navigate('/app')
    } catch (e) {
      setError(errorMessage(e))
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create your workspace" subtitle="Set up your organization in a minute">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Full name" value={fullName} onChange={setFullName} autoComplete="name" />
        <TextField label="Organization name" value={organizationName} onChange={setOrganizationName} autoComplete="organization" />
        <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
        <TextField label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
