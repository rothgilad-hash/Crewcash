import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useApp } from './context/AppContext'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Participants from './pages/Participants'
import Debts from './pages/Debts'
import Shopping from './pages/Shopping'
import Compare from './pages/Compare'
import Leaderboard from './pages/Leaderboard'
import Settings from './pages/Settings'

function JoinRedirect() {
  const { joinTrip } = useApp()
  const navigate = useNavigate()
  const token = window.location.pathname.split('/join/')[1]

  useEffect(() => {
    if (token) {
      joinTrip(token).then(() => navigate('/')).catch(() => navigate('/landing'))
    }
  }, [token])

  return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
}

function ProtectedApp() {
  const { trip, loading } = useApp()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="text-5xl mb-4">⛵</div>
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!trip) return <Navigate to="/landing" replace />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/participants" element={<Participants />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/shopping" element={<Shopping />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  const { lang } = useApp()

  useEffect(() => {
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  return (
    <Routes>
      <Route path="/landing" element={<Landing />} />
      <Route path="/join/:token" element={<JoinRedirect />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  )
}
