import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency } from '../lib/calculations'
import { Copy, Check, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

const CAT_EMOJI = { yacht: '⛵', fuel: '⛽', food: '🍽️', supermarket: '🛒', alcohol: '🍷', transport: '🚕', activities: '🏊', gear: '🎒', other: '💰' }

export default function Dashboard() {
  const { t } = useTranslation()
  const { trip, participants, expenses, isAdmin, lang } = useApp()
  const [copied, setCopied] = useState(false)
  const isHe = lang === 'he'

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const balances = calculateBalances(expenses, participants)

  const inviteUrl = `${window.location.origin}/join/${trip?.invite_token}`
  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const tripDays = trip?.start_date && trip?.end_date
    ? Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000)
    : null

  const yachtTotal = expenses.filter(e => e.is_yacht_cost).reduce((s, e) => s + e.amount, 0)
  const otherTotal = expenses.filter(e => !e.is_yacht_cost).reduce((s, e) => s + e.amount, 0)

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

  return (
    <div className="p-4 space-y-4">

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 text-white shadow-lg shadow-blue-200 relative overflow-hidden"
      >
        {/* BG decoration */}
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex justify-between items-start mb-5">
            <div>
              <p className="text-blue-200 text-sm font-medium">{trip?.name} {trip?.year}</p>
              <p className="text-5xl font-black mt-1 tracking-tight">{formatCurrency(totalExpenses, 'EUR')}</p>
              <p className="text-blue-200 text-sm mt-1.5">
                {participants.length} {isHe ? 'משתתפים' : 'participants'}
                {tripDays && ` · ${tripDays} ${t('days')}`}
                {trip?.destination && ` · ${trip.destination}`}
              </p>
            </div>
            <span className="text-5xl drop-shadow">⛵</span>
          </div>

          {/* Split */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 rounded-2xl p-3.5">
              <p className="text-blue-200 text-xs mb-1">⛵ {isHe ? 'יאכטה' : 'Yacht'}</p>
              <p className="font-bold text-lg">{formatCurrency(yachtTotal, 'EUR')}</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3.5">
              <p className="text-blue-200 text-xs mb-1">🧾 {isHe ? 'הוצאות נוספות' : 'Other Expenses'}</p>
              <p className="font-bold text-lg">{formatCurrency(otherTotal, 'EUR')}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Empty state */}
      {participants.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
          <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 text-sm font-medium">
            {isHe ? 'הוסף משתתפים ב"אנשים" כדי להתחיל לחשב!' : 'Add participants in "People" to start calculating!'}
          </p>
        </motion.div>
      )}

      {/* Balances per person */}
      {participants.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4 text-base">{isHe ? 'יתרה לאדם' : 'Balance per person'}</h3>
          <div className="space-y-3.5">
            {participants.map((p, i) => {
              const b = balances[p.id] || { paid: 0, owes: 0, net: 0 }
              const isPos = b.net >= 0
              const maxAbs = Math.max(...participants.map(x => Math.abs((balances[x.id] || {}).net || 0)), 1)
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-semibold text-gray-900 text-sm">
                        {p.name} {p.is_gil ? '⭐' : ''}
                      </span>
                      <span className={`text-sm font-bold ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isPos ? '+' : ''}{formatCurrency(b.net, 'EUR')}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${isPos ? 'bg-emerald-400' : 'bg-red-400'}`}
                        style={{ width: `${(Math.abs(b.net) / maxAbs) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}


      {/* Invite link */}
      {isAdmin && trip && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-0.5">{t('inviteLink')}</h3>
          <p className="text-gray-400 text-sm mb-4">
            {t('tripCode')}: <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-lg">{trip.invite_token?.toUpperCase()}</span>
          </p>
          <button
            onClick={copyLink}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-semibold transition-all active:scale-[0.98] ${
              copied
                ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
                : 'border-dashed border-blue-200 text-blue-600 bg-blue-50'
            }`}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? t('linkCopied') : t('copyLink')}
          </button>
        </motion.div>
      )}
    </div>
  )
}
