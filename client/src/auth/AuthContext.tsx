import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError, UNAUTHORIZED_EVENT } from '../lib/api'
import type { User } from '../lib/types'
import { AuthContext } from './useAuth'
import type { GoogleLinkRequest } from './useAuth'

type AuthResponse = { user: User }
type SessionStatus = 'checking' | 'ready' | 'offline'

const RETRY_DELAY_MS = 5000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<SessionStatus>('checking')
  const [attempt, setAttempt] = useState(0)

  // The session cookie is HttpOnly, so ask the API who we are. 401 means signed out;
  // any other failure means the API is unreachable: keep trying instead of logging out.
  useEffect(() => {
    let active = true
    api<AuthResponse>('/auth/me').then(
      ({ user }) => {
        if (!active) return
        setUser(user)
        setStatus('ready')
      },
      (err) => {
        if (!active) return
        if (err instanceof ApiError && err.status === 401) {
          setUser(null)
          setStatus('ready')
        } else {
          setStatus('offline')
        }
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  useEffect(() => {
    if (status !== 'offline') return
    const timer = setTimeout(() => setAttempt((n) => n + 1), RETRY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [status, attempt])

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const refreshUser = useCallback(async () => {
    const { user } = await api<AuthResponse>('/auth/me')
    setUser(user)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      await api<AuthResponse>('/auth/login', 'POST', { email, password })
      await refreshUser()
    },
    [refreshUser],
  )

  const loginWithGoogle = useCallback(
    async (credential: string): Promise<GoogleLinkRequest | null> => {
      try {
        await api<AuthResponse>('/auth/google', 'POST', { credential })
      } catch (err) {
        const data = err instanceof ApiError ? err.data : undefined
        if (data?.code === 'google_link_required') {
          return { email: String(data.email), linkToken: String(data.linkToken) }
        }
        throw err
      }
      await refreshUser()
      return null
    },
    [refreshUser],
  )

  const confirmGoogleLink = useCallback(
    async (linkToken: string, password: string) => {
      await api<AuthResponse>('/auth/google/link', 'POST', { linkToken, password })
      await refreshUser()
    },
    [refreshUser],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await api<AuthResponse>('/auth/register', 'POST', { name, email, password })
      await refreshUser()
    },
    [refreshUser],
  )

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', 'POST')
    } finally {
      setUser(null)
      setStatus('ready')
    }
  }, [])

  const logoutEverywhere = useCallback(async () => {
    await api('/auth/logout-all', 'POST')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: status === 'checking',
        offline: status === 'offline',
        retry,
        login,
        loginWithGoogle,
        confirmGoogleLink,
        register,
        refreshUser,
        logout,
        logoutEverywhere,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
