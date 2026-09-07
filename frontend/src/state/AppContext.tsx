import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { api, ApiError } from '../api/client'
import type { Me } from '../api/types'

interface Toast {
  text: string
  bad: boolean
}

interface AppState {
  me: Me | null
  loading: boolean
  toast: Toast | null
  login: (email: string, password: string) => Promise<void>
  register: (body: {
    email: string
    handle: string
    display_name: string
    password: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  notify: (text: string, bad?: boolean) => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<Toast | null>(null)

  const notify = useCallback((text: string, bad = false) => {
    setToast({ text, bad })
    window.setTimeout(() => setToast(null), 3600)
  }, [])

  const refreshMe = useCallback(async () => {
    try {
      setMe(await api.get<Me>('/api/auth/me'))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setMe(null)
      else throw error
    }
  }, [])

  useEffect(() => {
    refreshMe().finally(() => setLoading(false))
  }, [refreshMe])

  const value = useMemo<AppState>(
    () => ({
      me,
      loading,
      toast,
      notify,
      refreshMe,
      login: async (email, password) => {
        setMe(await api.post<Me>('/api/auth/login', { email, password }))
      },
      register: async (body) => {
        setMe(await api.post<Me>('/api/auth/register', body))
      },
      logout: async () => {
        await api.post('/api/auth/logout')
        setMe(null)
      },
    }),
    [me, loading, toast, notify, refreshMe],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
  return ctx
}
