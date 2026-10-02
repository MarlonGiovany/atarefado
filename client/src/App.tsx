import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import type { ReactNode } from 'react'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { BoardsPage } from './pages/BoardsPage'
import { BoardByIdPage, BoardBySlugPage } from './pages/BoardRoutes'
import { AccountPage } from './pages/AccountPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { PrivacyPage } from './pages/PrivacyPage'
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
          {/* Reachable signed in or out: the e-mail link must always work */}
          <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route path="/" element={<Protected><BoardsPage /></Protected>} />
          <Route path="/quadros/:slug" element={<Protected><BoardBySlugPage /></Protected>} />
          {/* Old addresses keep working and are moved to /quadros/<slug> */}
          <Route path="/boards/:boardId" element={<Protected><BoardByIdPage /></Protected>} />
          <Route path="/conta" element={<Protected><AccountPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
