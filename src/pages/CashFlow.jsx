import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/calculations'
import { CheckCircle2, Circle, AlertTriangle, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'
import { motion } from 'framer-motion'

export default function CashFlow() {
  const { t } = useTranslation()
  const { participants, expenses, kittyRefunds, isAdmin, lang } = useApp()
  const [showPaid, setShowPaid] = useState(false)
  const isHe = lang === 'he'

  const totalCollected = participants.reduce((s, p) => s + (p.amount_paid || 0), 0)
  const cashSpent = expenses.filter(e => e.is_cash && e.is_paid).reduce((s, e) => s + e.amount, 0)
  const kittyRefundsFromTable = kittyRefunds.reduce((s, r) => s + r.amount, 0)
  const kittyRefundsLegacy = participants.reduce((s, p) => {
    const hasNewRefunds = kittyRefunds.some(r => r.participant_id === p.id)
    return s + (hasNewRefunds ? 0 : (p.kitty_paid_back || 0))
  }, 0)
  const kittyRefundsTotal = kittyRefundsFromTable + kittyRefundsLegacy
  const cashBalance = totalCollected - cashSpent - kittyRefundsTotal
  const pct = totalCollected > 0 ? cashBalance / totalCollected : 1

  const paidCash = expenses.filter(e => e.is_cash && e.is_paid)

  const unpaidCash = expenses
    .filter(e => e.is_cash && !e.is_paid)
    .sort((a, b) => {
      if (!a.planned_date && !b.planned_date) return 0
      if (!a.planned_date) return 1
      if (!b.planned_date) return -1
      return a.planned_date.localeCompare(b.planned_date)
    })

  const totalUpcoming = unpaidCash.reduce((s, e) => s + e.amount, 0)

  // Group by date
  const byDate = {}
  unpaidCash.forEach(e => {
    const key = e.planned_date || '__nodate__'
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(e)
  })

  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const tomorrowTotal = (byDate[tomorrow] || []).reduce((s, e) => s + e.amount, 0)

  const togglePaid = async (exp) => {
    await supabase.from('expenses').update({ is_paid: !exp.is_paid }).eq('id', exp.id)
  }

  const alertLevel = pct <= 0.25 ? 'critical' : pct <= 0.5 ? 'warning' : null

  const formatDateLabel = (dateStr) => {
    if (dateStr === '__nodate__') return isHe ? 'ללא תאריך' : 'No date'
    const d = new Date(dateStr)
    if (dateStr === today) return isHe ? 'היום' : 'Today'
    if (dateStr === tomorrow) return isHe ? 'מחר' : 'Tomorrow'
    return d.toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div className="p-4 space-y-4">

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-5 shadow-sm border ${
          alertLevel === 'critical' ? 'bg-red-50 border-red-200' :
          alertLevel === 'warning' ? 'bg-amber-50 border-amber-200' :
          'bg-white border-gray-100'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className={`text-xs font-semibold mb-1 ${alertLevel === 'critical' ? 'text-red-400' : alertLevel === 'warning' ? 'text-amber-400' : 'text-gray-400'}`}>
              💵 {isHe ? 'יתרת קופת מזומנים' : 'Cash Balance'}
            </p>
            <p className={`text-4xl font-black ${alertLevel === 'critical' ? 'text-red-600' : alertLevel === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>
              {formatCurrency(cashBalance, 'EUR')}
            </p>
          </div>
          {alertLevel && (
            <div className={`p-2 rounded-xl ${alertLevel === 'critical' ? 'bg-red-100' : 'bg-amber-100'}`}>
              <AlertTriangle size={20} className={alertLevel === 'critical' ? 'text-red-500' : 'text-amber-500'} />
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all ${
              alertLevel === 'critical' ? 'bg-red-500' :
              alertLevel === 'warning' ? 'bg-amber-400' :
              'bg-emerald-400'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">
          {Math.round(pct * 100)}% {isHe ? 'נשאר מתוך' : 'remaining of'} {formatCurrency(totalCollected, 'EUR')}
        </p>

        {alertLevel === 'critical' && (
          <p className="text-sm font-semibold text-red-600 mt-2">
            ⚠️ {isHe ? 'נשאר פחות מרבע מהקופה!' : 'Less than 25% of kitty remaining!'}
          </p>
        )}
        {alertLevel === 'warning' && (
          <p className="text-sm font-semibold text-amber-600 mt-2">
            ⚠️ {isHe ? 'נשאר פחות מחצי מהקופה' : 'Less than 50% of kitty remaining'}
          </p>
        )}

        {/* Breakdown */}
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{isHe ? 'נאסף' : 'Collected'}</p>
            <p className="text-sm font-bold text-gray-800">{formatCurrency(totalCollected, 'EUR')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{isHe ? 'שולם' : 'Spent'}</p>
            <p className="text-sm font-bold text-red-500">−{formatCurrency(cashSpent, 'EUR')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{isHe ? 'הוחזר' : 'Refunded'}</p>
            <p className="text-sm font-bold text-blue-500">−{formatCurrency(kittyRefundsTotal, 'EUR')}</p>
          </div>
        </div>
      </motion.div>

      {/* Tomorrow tip */}
      {tomorrowTotal > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3"
        >
          <TrendingDown size={20} className="text-blue-500 flex-shrink-0" />
          <p className="text-blue-700 text-sm font-medium">
            {isHe
              ? `מומלץ לשמור למחר: ${formatCurrency(tomorrowTotal, 'EUR')}`
              : `Keep for tomorrow: ${formatCurrency(tomorrowTotal, 'EUR')}`}
          </p>
        </motion.div>
      )}

      {/* Upcoming cash expenses */}
      {unpaidCash.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-4 flex justify-between items-center border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-base">
              {isHe ? 'הוצאות מזומן לא שולמו' : 'Unpaid cash expenses'}
            </h3>
            <span className="text-sm font-bold text-gray-500">{formatCurrency(totalUpcoming, 'EUR')}</span>
          </div>

          {Object.entries(byDate).map(([dateKey, exps]) => (
            <div key={dateKey}>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-500">{formatDateLabel(dateKey)}</span>
                <span className="text-xs font-semibold text-gray-500">
                  {formatCurrency(exps.reduce((s, e) => s + e.amount, 0), 'EUR')}
                </span>
              </div>
              {exps.map(exp => (
                <div key={exp.id} className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{exp.description}</p>
                    {(exp.sub_category || exp.notes) && (
                      <p className="text-xs text-gray-400 truncate">
                        {exp.sub_category && <span>{t('subcat_' + exp.sub_category)}</span>}
                        {exp.sub_category && exp.notes && ' · '}
                        {exp.notes}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-800 flex-shrink-0">{formatCurrency(exp.amount, exp.currency)}</span>
                  {isAdmin && (
                    <button onClick={() => togglePaid(exp)} className="w-8 h-8 flex items-center justify-center rounded-xl active:bg-gray-100 flex-shrink-0">
                      <Circle size={20} className="text-gray-300" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </motion.div>
      ) : (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center">
          <span className="text-4xl">✅</span>
          <p className="font-semibold text-gray-600 mt-3">
            {isHe ? 'כל הוצאות המזומן שולמו' : 'All cash expenses paid'}
          </p>
        </div>
      )}
      {/* Paid cash expenses (with undo) */}
      {paidCash.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <button
            onClick={() => setShowPaid(v => !v)}
            className="w-full p-4 flex justify-between items-center active:bg-gray-50 transition-colors"
          >
            <span className="font-bold text-gray-900 text-base">
              {isHe ? `שולמו (${paidCash.length})` : `Paid (${paidCash.length})`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-emerald-600">
                {formatCurrency(paidCash.reduce((s, e) => s + e.amount, 0), 'EUR')}
              </span>
              {showPaid ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </div>
          </button>

          {showPaid && paidCash.map(exp => (
            <div key={exp.id} className="px-4 py-3 flex items-center gap-3 border-t border-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-500 truncate">{exp.description}</p>
                {(exp.sub_category || exp.notes) && (
                  <p className="text-xs text-gray-400 truncate">
                    {exp.sub_category && t('subcat_' + exp.sub_category)}
                    {exp.sub_category && exp.notes && ' · '}
                    {exp.notes}
                  </p>
                )}
              </div>
              <span className="text-sm font-bold text-gray-400 flex-shrink-0">{formatCurrency(exp.amount, exp.currency)}</span>
              {isAdmin && (
                <button onClick={() => togglePaid(exp)} className="w-8 h-8 flex items-center justify-center rounded-xl active:bg-gray-100 flex-shrink-0">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                </button>
              )}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
