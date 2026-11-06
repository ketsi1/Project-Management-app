import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api } from '../api'
import { errorMessage } from '../api/ApiError'
import AuthLayout from '../components/layout/AuthLayout'
import Button from '../components/ui/Button'
import { Alert } from '../components/ui/Display'
import { TextField } from '../components/ui/Fields'
import { useAuth } from '../context/authContext'

// Where an invitation link lands: the invited person chooses a password and is logged in.
export default function AcceptInvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { startSession } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 8) return setError('Choose a password of at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setError('')
    setLoading(true)
    try {
      startSession(await api.acceptInvite(token, password))
      navigate('/app')
    } catch (e) {
      setError(errorMessage(e))
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Invitation link needed" subtitle="Open the link you were sent to set your password.">
        <Alert>This page needs the full invitation link. Ask the person who invited you to send it again.</Alert>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Back to log in
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Join your team" subtitle="Choose a password to activate your account.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
        <TextField label="Repeat password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={loading} className="w-full">
          Activate account
        </Button>
      </form>
    </AuthLayout>
  )
}
