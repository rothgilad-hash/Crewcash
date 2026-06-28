import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Receipt, Users, ArrowLeftRight,
  ShoppingCart, BarChart2, FileText
} from 'lucide-react'

const NAV = [
  { to: '/', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/expenses', icon: Receipt, key: 'expenses' },
  { to: '/participants', icon: Users, key: 'participants' },
  { to: '/debts', icon: ArrowLeftRight, key: 'debts' },
  { to: '/shopping', icon: ShoppingCart, key: 'shopping' },
  { to: '/compare', icon: BarChart2, key: 'compare' },
  { to: '/report', icon: FileText, key: 'report' },
]

export default function Layout({ children }) {
  const { t, i18n } = useTranslation()
  const { trip, isAdmin, lang, changeLang } = useApp()
  const isRTL = lang === 'he'

  const toggleLang = () => {
    const next = lang === 'he' ? 'en' : 'he'
    i18n.changeLanguage(next)
    changeLang(next)
    document.documentElement.dir = next === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = next
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-50 flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⛵</span>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">CrewCash</p>
              {trip && <p className="text-xs text-gray-400 leading-tight truncate max-w-[140px]">{trip.name} {trip.year}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium hidden sm:inline">Admin</span>
            )}
            <button
              onClick={toggleLang}
              className="text-sm font-semibold text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {lang === 'he' ? 'EN' : 'עב'}
            </button>
            <NavLink to="/settings" className={({ isActive }) =>
              `p-2.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`
            }>
              <Settings size={18} />
            </NavLink>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
        <motion.div
          key={useLocation().pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-2xl mx-auto flex">
          {NAV.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors active:bg-gray-50 ${isActive ? 'text-blue-600' : 'text-gray-400'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={21} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className="text-[9px] font-medium leading-tight">{t(key)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
