import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError, tokenStore, UNAUTHORIZED_EVENT } from '../lib/api'
import type { User } from '../lib/types'
import { AuthContext } from './useAuth'

type AuthResponse = { token: string; user: User }
type SessionStatus = 'checking' | 'ready' | 'offline'

const RETRY_DELAY_MS = 5000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<SessionStatus>(() =>
    tokenStore.get() ? 'checking' : 'ready',
  )
  const [attempt, setAttempt] = useState(0)

  // Restore the session from a saved token. Only a 401 ends the session (api() clears
  // the token then); any other failure keeps the token and retries, so a server that's
  // briefly down doesn't log anyone out.
  useEffect(() => {
    if (!tokenStore.get()) return
    let active = true
    api<{ user: User }>('/auth/me').then(
      ({ user }) => {
        if (!active) return
        setUser(user)
        setStatus('ready')
      },
      (err) => {
        if (!active) return
        setStatus(err instanceof ApiError && err.status === 401 ? 'ready' : 'offline')
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

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const handleAuth = useCallback(({ token, user }: AuthResponse) => {
    tokenStore.set(token)
    setUser(user)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      handleAuth(await api<AuthResponse>('/auth/login', 'POST', { email, password }))
    },
    [handleAuth],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      handleAuth(
        await api<AuthResponse>('/auth/register', 'POST', { name, email, password }),
      )
    },
    [handleAuth],
  )

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setStatus('ready')
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: status === 'checking',
        offline: status === 'offline',
        retry,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
