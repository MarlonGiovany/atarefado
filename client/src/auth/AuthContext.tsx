import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, tokenStore, UNAUTHORIZED_EVENT } from '../lib/api'
import type { User } from '../lib/types'
import { AuthContext } from './useAuth'

type AuthResponse = { token: string; user: User }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStore.get() !== null)

  // Restore the session from a saved token
  useEffect(() => {
    if (!tokenStore.get()) return
    api<{ user: User }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

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
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
