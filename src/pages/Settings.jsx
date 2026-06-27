import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, Trash2, Globe, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { trip, isAdmin, lang, changeLang, leaveTrip } = useApp()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const toggleLang = (l) => {
    i18n.changeLanguage(l)
    changeLang(l)
    document.documentElement.dir = l === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = l
  }

  const handleLeave = () => {
    leaveTrip()
    navigate('/landing')
  }

  const handleDelete = async () => {
    if (!window.confirm(lang === 'he' ? 'האם אתה בטוח? פעולה זו בלתי הפיכה!' : 'Are you sure? This is irreversible!')) return
    await supabase.from('trips').delete().eq('id', trip.id)
    leaveTrip()
    navigate('/landing')
  }

  const copyCode = () => {
    navigator.clipboard.writeText(trip?.invite_token?.toUpperCase() || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isHe = lang === 'he'

  return (
    <div className="p-4 space-y-4">
      {/* Trip info */}
      {trip && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-3">{t('tripSettings')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{isHe ? 'שם' : 'Name'}</span>
              <span className="font-semibold text-gray-900">{trip.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('tripYear')}</span>
              <span className="font-semibold text-gray-900">{trip.year}</span>
            </div>
            {trip.destination && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t('destination')}</span>
                <span className="font-semibold text-gray-900">{trip.destination}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
              <span className="text-gray-500">{t('tripCode')}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-gray-900">{trip.invite_token?.toUpperCase()}</span>
                <button onClick={copyCode} className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                  {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{isHe ? 'סוג גישה' : 'Access type'}</span>
              <span className={`font-semibold ${isAdmin ? 'text-blue-600' : 'text-gray-500'}`}>
                {isAdmin ? t('adminAccess') : t('readOnlyAccess')}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Language */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={18} className="text-gray-500" />
          <h3 className="font-bold text-gray-900">{t('language')}</h3>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => toggleLang('he')}
            className={`flex-1 py-3 rounded-2xl font-semibold transition-all ${lang === 'he' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            🇮🇱 עברית
          </button>
          <button
            onClick={() => toggleLang('en')}
            className={`flex-1 py-3 rounded-2xl font-semibold transition-all ${lang === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            🇬🇧 English
          </button>
        </div>
      </motion.div>

      {/* About */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 text-center">
        <div className="text-4xl mb-2">⛵</div>
        <p className="font-black text-gray-900">CrewCash</p>
        <p className="text-gray-400 text-sm">v1.0.0 · {isHe ? 'עשוי עם ❤️ לשיוט' : 'Made with ❤️ for sailing'}</p>
      </motion.div>

      {/* Danger zone */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-red-500 mb-3">{t('dangerZone')}</h3>
        <div className="space-y-3">
          <button
            onClick={handleLeave}
            className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <LogOut size={18} className="text-gray-500" />
            <span className="font-medium">{t('leaveTrip')}</span>
          </button>
          {isAdmin && (
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={18} />
              <span className="font-medium">{t('deleteTrip')}</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
