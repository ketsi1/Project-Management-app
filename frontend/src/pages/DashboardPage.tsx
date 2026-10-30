import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { errorMessage } from '../api/ApiError'
import EmployeeDashboard from '../components/dashboard/EmployeeDashboard'
import ManagerDashboard from '../components/dashboard/ManagerDashboard'
import Button from '../components/ui/Button'
import { EmptyState, LoadingState } from '../components/ui/Display'
import { useAuth } from '../context/authContext'
import { onRealtime } from '../realtime/socket'
import type { WorkItem } from '../types'

// Primary landing hub: renders Manager Executive Hub or Employee Workstation based on active role view.
export default function DashboardPage() {
  const { activeViewMode } = useAuth()
  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api
      .listWorkItems()
      .then(setItems)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    return onRealtime('workItems:changed', load)
  }, [load])

  if (loading) return <LoadingState label="Loading workspace…" />

  if (error) {
    return (
      <div className="surface">
        <EmptyState
          icon="alert"
          title="Failed to load work items"
          description={error}
          action={
            <Button variant="secondary" onClick={load}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  return activeViewMode === 'manager' ? (
    <ManagerDashboard items={items} onItemUpdated={load} />
  ) : (
    <EmployeeDashboard items={items} onItemUpdated={load} />
  )
}

