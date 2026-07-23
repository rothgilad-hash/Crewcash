import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, Trash2, Globe, Copy, Check, Pencil, RotateCcw, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import Modal from '../components/Modal'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { trip, setTrip, isAdmin, lang, changeLang, leaveTrip, setParticipants, setExpenses, setShoppingItems } = useApp()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

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

  const handleReset = async () => {
    const confirmMsg = isHe
      ? 'איפוס יימחק את כל ההוצאות, המשתתפים וההחזרים. פרטי השיוט יישמרו. להמשיך?'
      : 'Reset will delete all expenses, participants and refunds. Trip details will be kept. Continue?'
    if (!window.confirm(confirmMsg)) return
    const secondConfirm = isHe ? 'אתה בטוח לגמרי? אי אפשר לשחזר!' : 'Are you absolutely sure? This cannot be undone!'
    if (!window.confirm(secondConfirm)) return

    await Promise.all([
      supabase.from('expenses').delete().eq('trip_id', trip.id),
      supabase.from('participants').delete().eq('trip_id', trip.id),
      supabase.from('shopping_items').delete().eq('trip_id', trip.id),
    ])
    setExpenses([])
    setParticipants([])
    setShoppingItems([])
    navigate('/')
  }

  const handleDelete = async () => {
    if (!window.confirm(lang === 'he' ? 'האם אתה בטוח? פעולה זו בלתי הפיכה!' : 'Are you sure? This is irreversible!')) return
    await supabase.from('trips').delete().eq('id', trip.id)
    leaveTrip()
    navigate('/landing')
  }

  const forceUpdate = async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    window.location.reload(true)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(trip?.invite_token?.toUpperCase() || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openEdit = () => {
    setForm({
      name: trip.name || '',
      year: trip.year || '',
      destination: trip.destination || '',
      country: trip.country || '',
      region_name: trip.region_name || '',
      departure_area: trip.departure_area || '',
      start_date: trip.start_date || '',
    })
    setEditOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const { data } = await supabase.from('trips').update(form).eq('id', trip.id).select().single()
    if (data) setTrip(data)
    setSaving(false)
    setEditOpen(false)
  }

  const isHe = lang === 'he'

  const Field = ({ label, value }) => value ? (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="font-semibold text-gray-900 text-sm">{value}</span>
    </div>
  ) : null

  return (
    <div className="p-4 space-y-4">
      {/* Trip info */}
      {trip && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-gray-900">{t('tripSettings')}</h3>
            {isAdmin && (
              <button onClick={openEdit} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                <Pencil size={16} />
              </button>
            )}
          </div>
          <div className="space-y-0">
            <Field label={isHe ? 'שם הסירה' : 'Boat Name'} value={trip.name} />
            <Field label={isHe ? 'שנה' : 'Year'} value={trip.year} />
            <Field label={isHe ? 'יעד' : 'Destination'} value={trip.destination} />
            <Field label={isHe ? 'מדינה' : 'Country'} value={trip.country} />
            <Field label={isHe ? 'שם האזור' : 'Region'} value={trip.region_name} />
            <Field label={isHe ? 'אזור יציאה' : 'Departure Area'} value={trip.departure_area} />
            <Field label={isHe ? 'תאריך יציאה' : 'Departure Date'} value={trip.start_date} />
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-400 text-sm">{t('tripCode')}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-gray-900 text-sm">{trip.invite_token?.toUpperCase()}</span>
                <button onClick={copyCode} className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                  {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                </button>
              </div>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400 text-sm">{isHe ? 'סוג גישה' : 'Access type'}</span>
              <span className={`font-semibold text-sm ${isAdmin ? 'text-blue-600' : 'text-gray-500'}`}>
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
          <button onClick={() => toggleLang('he')}
            className={`flex-1 py-3 rounded-2xl font-semibold transition-all ${lang === 'he' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            🇮🇱 עברית
          </button>
          <button onClick={() => toggleLang('en')}
            className={`flex-1 py-3 rounded-2xl font-semibold transition-all ${lang === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            🇬🇧 English
          </button>
        </div>
      </motion.div>

      {/* About */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 text-center">
        <div className="text-4xl mb-2">⛵</div>
        <p className="font-black text-gray-900">CrewCash</p>
        <p className="text-gray-400 text-sm">v1.0.0</p>
      </motion.div>

      {/* Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <div className="space-y-3">
          <button onClick={forceUpdate}
            className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
            <RefreshCw size={18} />
            <span className="font-medium">{isHe ? 'עדכן אפליקציה' : 'Update App'}</span>
          </button>
          <button onClick={handleLeave}
            className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
            <LogOut size={18} className="text-gray-500" />
            <span className="font-medium">{t('leaveTrip')}</span>
          </button>
          {isAdmin && (
            <button onClick={handleReset}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors">
              <RotateCcw size={18} />
              <span className="font-medium">{isHe ? 'איפוס נתונים' : 'Reset Data'}</span>
            </button>
          )}
          {isAdmin && (
            <button onClick={handleDelete}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 size={18} />
              <span className="font-medium">{t('deleteTrip')}</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={isHe ? 'עריכת פרטי שיוט' : 'Edit Trip Details'}>
        <div className="space-y-3">
          {[
            { key: 'name', label: isHe ? 'שם הסירה' : 'Boat Name' },
            { key: 'year', label: isHe ? 'שנה' : 'Year', type: 'number' },
            { key: 'destination', label: isHe ? 'יעד' : 'Destination' },
            { key: 'country', label: isHe ? 'מדינה' : 'Country' },
            { key: 'region_name', label: isHe ? 'שם האזור' : 'Region' },
            { key: 'departure_area', label: isHe ? 'אזור יציאה' : 'Departure Area' },
            { key: 'start_date', label: isHe ? 'תאריך יציאה' : 'Departure Date', type: 'date' },
          ].map(({ key, label, type = 'text' }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
              <input
                type={type}
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
                value={form[key] || ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditOpen(false)}
              className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold">
              {t('cancel')}
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3.5 rounded-2xl bg-blue-600 text-white font-bold disabled:opacity-40">
              {saving ? '...' : t('save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
