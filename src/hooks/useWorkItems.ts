import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { errorMessage } from '../api/ApiError'
import { useAuth } from '../context/authContext'
import { onRealtime } from '../realtime/socket'
import type { WorkItem } from '../types'

// Loads work items and keeps them fresh with realtime updates.
// Managers get every task; employees only get tasks assigned to them.
export function useWorkItems() {
  const { session, isManager } = useAuth()
  const [allItems, setAllItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    api
      .listWorkItems()
      .then((items) => {
        setAllItems(items)
        setError('')
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
    return onRealtime('workItems:changed', reload)
  }, [reload])

  const items = isManager ? allItems : allItems.filter((item) => item.assigneeId === session?.user.id)
  return { items, allItems, loading, error, reload }
}
