import { createContext, useContext } from 'react'
import type { User } from '../lib/types'

/** A Google sign-in that matched an existing password account: confirm its password to link. */
export type GoogleLinkRequest = { email: string; linkToken: string }

export type AuthContextValue = {
  user: User | null
  loading: boolean
  /** The session couldn't be checked because the API is unreachable */
  offline: boolean
  retry: () => void
  login: (email: string, password: string) => Promise<void>
  /** Signs in with Google's ID token; returns a link request if the account needs its password */
  loginWithGoogle: (credential: string) => Promise<GoogleLinkRequest | null>
  confirmGoogleLink: (linkToken: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  /** Reloads the user (e.g. after creating a password) */
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
  logoutEverywhere: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
