import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { Anchor, Users, ArrowRight, ChevronRight } from 'lucide-react'

export default function Landing() {
  const { t, i18n } = useTranslation()
  const { joinTrip, createTrip, lang, changeLang } = useApp()
  const navigate = useNavigate()
  const [mode, setMode] = useState(null)
  const [code, setCode] = useState('')
  const [form, setForm] = useState({ name: '', year: new Date().getFullYear(), destination: '', start_date: '', end_date: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isHe = lang === 'he'

  const toggleLang = () => {
    const next = lang === 'he' ? 'en' : 'he'
    i18n.changeLanguage(next)
    changeLang(next)
    document.documentElement.dir = next === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = next
  }

  const handleJoin = async () => {
    if (!code.trim()) return
    setLoading(true); setError('')
    try {
      await joinTrip(code.trim())
      navigate('/')
    } catch {
      setError(isHe ? 'קוד לא נמצא. נסה שוב.' : 'Code not found. Try again.')
    } finally { setLoading(false) }
  }

  const handleCreate = async () => {
    if (!form.name) return
    setLoading(true); setError('')
    try {
      await createTrip(form)
      navigate('/')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div
      className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-blue-50 via-white to-sky-50 flex flex-col"
      dir={isHe ? 'rtl' : 'ltr'}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Lang toggle */}
      <div className="flex justify-end p-4">
        <button
          onClick={toggleLang}
          className="text-sm font-bold text-gray-500 px-4 py-2 rounded-xl hover:bg-white transition-colors min-h-[44px]"
        >
          {lang === 'he' ? 'EN' : 'עב'}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-4">

        {/* Hero */}
        {!mode && (
          <>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              className="text-center mb-10"
            >
              <div className="text-8xl mb-4 drop-shadow-lg">⛵</div>
              <h1 className="text-5xl font-black text-gray-900 tracking-tight">CrewCash</h1>
              <p className="text-gray-400 mt-3 text-lg font-medium">{t('tagline')}</p>
            </motion.div>

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="w-full max-w-sm space-y-4"
            >
              {/* Create */}
              <button
                onClick={() => setMode('create')}
                className="w-full flex items-center gap-4 bg-blue-600 text-white rounded-3xl p-5 shadow-xl shadow-blue-200 active:scale-[0.97] transition-transform"
              >
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Anchor size={24} />
                </div>
                <div className={`flex-1 ${isHe ? 'text-right' : 'text-left'}`}>
                  <p className="font-bold text-lg">{t('createTrip')}</p>
                  <p className="text-blue-200 text-sm mt-0.5">
                    {isHe ? 'צור שיוט חדש עם גישת מנהל' : 'Start a new trip as admin'}
                  </p>
                </div>
                <ChevronRight size={20} className={`opacity-60 flex-shrink-0 ${isHe ? 'rotate-180' : ''}`} />
              </button>

              {/* Join */}
              <button
                onClick={() => setMode('join')}
                className="w-full flex items-center gap-4 bg-white text-gray-900 rounded-3xl p-5 shadow-sm border-2 border-gray-100 active:scale-[0.97] transition-transform"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Users size={24} className="text-blue-500" />
                </div>
                <div className={`flex-1 ${isHe ? 'text-right' : 'text-left'}`}>
                  <p className="font-bold text-lg">{t('joinTrip')}</p>
                  <p className="text-gray-400 text-sm mt-0.5">
                    {isHe ? 'הצטרף עם קוד שקיבלת' : 'Join with an invite code'}
                  </p>
                </div>
                <ChevronRight size={20} className={`text-gray-300 flex-shrink-0 ${isHe ? 'rotate-180' : ''}`} />
              </button>
            </motion.div>
          </>
        )}

        {/* Join form */}
        {mode === 'join' && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm space-y-5">
            <div className="text-center">
              <p className="text-4xl mb-2">🔑</p>
              <h2 className="text-2xl font-black text-gray-900">{t('joinTrip')}</h2>
              <p className="text-gray-400 text-sm mt-1">{isHe ? 'הכנס את הקוד שקיבלת מהכלכלן' : 'Enter the code from your trip admin'}</p>
            </div>
            <input
              className="w-full border-2 border-gray-200 rounded-2xl px-5 py-5 text-center text-3xl font-mono tracking-widest focus:outline-none focus:border-blue-500 uppercase bg-white"
              placeholder="ABCD1234"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-600 text-sm text-center font-medium">
                {error}
              </div>
            )}
            <button
              onClick={handleJoin}
              disabled={loading || !code.trim()}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg active:bg-blue-700 transition-colors disabled:opacity-40"
            >
              {loading ? '...' : t('join')}
            </button>
            <button onClick={() => setMode(null)} className="w-full py-3 text-gray-400 font-medium">
              ← {t('back')}
            </button>
          </motion.div>
        )}

        {/* Create form */}
        {mode === 'create' && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm space-y-4">
            <div className="text-center">
              <p className="text-4xl mb-2">⛵</p>
              <h2 className="text-2xl font-black text-gray-900">{t('createTrip')}</h2>
            </div>
            <div className="space-y-3">
              <input
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white placeholder-gray-300"
                placeholder={`${t('tripName')} *`}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <div className="flex gap-3">
                <input
                  className="w-28 border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                  placeholder={t('tripYear')}
                  type="number"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                />
                <input
                  className="flex-1 border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white placeholder-gray-300"
                  placeholder={t('destination')}
                  value={form.destination}
                  onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 font-medium px-1 mb-1 block">{t('startDate')}</label>
                  <input type="date" className="w-full border-2 border-gray-200 rounded-2xl px-3 py-3.5 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                    value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 font-medium px-1 mb-1 block">{t('endDate')}</label>
                  <input type="date" className="w-full border-2 border-gray-200 rounded-2xl px-3 py-3.5 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                    value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-600 text-sm text-center font-medium">
                {error}
              </div>
            )}
            <button
              onClick={handleCreate}
              disabled={loading || !form.name}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg active:bg-blue-700 transition-colors disabled:opacity-40"
            >
              {loading ? '...' : t('create')} 🚀
            </button>
            <button onClick={() => setMode(null)} className="w-full py-3 text-gray-400 font-medium">
              ← {t('back')}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
