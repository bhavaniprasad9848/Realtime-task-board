import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '../types'
import { api, tokenStore } from './api'
import { connectSocket, disconnectSocket } from './socket'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // Only show a loading state if there's a saved token to check.
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()))

  const startSession = useCallback((token: string, u: User) => {
    tokenStore.set(token)
    connectSocket(token)
    setUser(u)
  }, [])

  // On page load, restore the session from the saved token.
  useEffect(() => {
    const token = tokenStore.get()
    if (!token) return
    api
      .me()
      .then(({ user: u }) => startSession(token, u))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [startSession])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const { token, user: u } = await api.login(email, password)
        startSession(token, u)
      },
      register: async (name, email, password) => {
        const { token, user: u } = await api.register(name, email, password)
        startSession(token, u)
      },
      logout: () => {
        tokenStore.clear()
        disconnectSocket()
        setUser(null)
      },
    }),
    [user, loading, startSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
