import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { errorMessage } from '../api/ApiError'
import { onRealtime } from '../realtime/socket'
import type { Bug } from '../types'

// Loads the bugs the logged-in person may see and keeps them fresh with realtime updates.
export function useBugs() {
  const [bugs, setBugs] = useState<Bug[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    api
      .listBugs()
      .then((list) => {
        setBugs(list)
        setError('')
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
    const offBugs = onRealtime('bugs:changed', reload)
    // Bugs disappear with their project, and visibility follows assigned tasks.
    const offProjects = onRealtime('projects:changed', reload)
    return () => {
      offBugs()
      offProjects()
    }
  }, [reload])

  return { bugs, loading, error, reload }
}
