import { Navigate, Route, Routes, Link } from 'react-router-dom'
import { useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import BoardsPage from './pages/BoardsPage'
import BoardPage from './pages/BoardPage'

export default function App() {
  const { user, loading, logout } = useAuth()

  if (loading) return <div className="center muted">Loading…</div>
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">▦ TaskBoard</Link>
        <div className="topbar-right">
          <span className="muted">{user.name}</span>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<BoardsPage />} />
        <Route path="/boards/:boardId" element={<BoardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
