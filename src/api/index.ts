import type { ApiClient } from './ApiClient'
import { httpApi } from './httpApi'
import { mockApi } from './mockApi'

// If VITE_API_URL is set in .env, use the real Express backend.
// Otherwise use the mock backend that stores data in the browser.
export const usingMockApi = !import.meta.env.VITE_API_URL

export const api: ApiClient = usingMockApi ? mockApi : httpApi
