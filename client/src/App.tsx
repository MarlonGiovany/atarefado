import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { BoardsPage } from './pages/BoardsPage'
import { BoardPage } from './pages/BoardPage'
import { ServerUnavailable } from './components/ServerUnavailable'
import { Spinner } from './components/ui'

function Protected({ children }: { children: ReactNode }) {
  const { user, loading, offline } = useAuth()
  if (loading) return <Spinner fullScreen />
  if (offline) return <ServerUnavailable />
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading, offline } = useAuth()
  if (loading) return <Spinner fullScreen />
  if (offline) return <ServerUnavailable />
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/" element={<Protected><BoardsPage /></Protected>} />
          <Route path="/boards/:boardId" element={<Protected><BoardPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
