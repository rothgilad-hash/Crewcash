import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency, getCategoryIcon, getCollectedAmount, getEurAmount } from '../lib/calculations'
import { Copy, Check, AlertCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { t } = useTranslation()
  const { trip, participants, expenses, kittyRefunds, kittyCollections, shoppingItems, isAdmin, lang } = useApp()
  const [copied, setCopied] = useState(false)
  const isHe = lang === 'he'

  const totalExpenses = expenses.reduce((s, e) => s + getEurAmount(e), 0)
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

  const yachtTotal = expenses.filter(e => e.is_yacht_cost).reduce((s, e) => s + getEurAmount(e), 0)
  const otherTotal = expenses.filter(e => !e.is_yacht_cost).reduce((s, e) => s + getEurAmount(e), 0)

  const navigate = useNavigate()
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [expandedCat, setExpandedCat] = useState(null)
  const uncheckedItems = shoppingItems.filter(i => !i.checked)

  const totalCollected = participants.reduce((s, p) => s + getCollectedAmount(kittyCollections, p.id, p), 0)
  const cashSpent = expenses.filter(e => e.is_cash || (e.is_estimate && e.actual_amount != null)).reduce((s, e) => {
    if (e.is_paid) return s + (e.is_estimate && e.actual_amount != null ? e.actual_amount : e.amount)
    if (e.is_estimate && !e.is_finalized && e.actual_amount != null) return s + e.actual_amount
    return s
  }, 0)
  const kittyRefundsTotal = kittyRefunds.reduce((s, r) => s + r.amount, 0)
  const cashBalance = totalCollected - cashSpent - kittyRefundsTotal
  const cashPct = totalCollected > 0 ? cashBalance / totalCollected : null
  const kittyPct = totalCollected > 0 ? cashBalance / totalCollected : 0
  const cashAlert = cashPct !== null && cashPct <= 0.25 ? 'critical' : cashPct !== null && cashPct <= 0.5 ? 'warning' : null

  const otherExpenses = expenses.filter(e => !e.is_yacht_cost)
  const paidExpenses = otherExpenses.filter(e => !e.is_cash || e.is_paid)
  const unpaidExpenses = otherExpenses.filter(e => e.is_cash && !e.is_paid)
  const paidTotal = paidExpenses.reduce((s, e) => s + getEurAmount(e), 0)
  const unpaidTotal = unpaidExpenses.reduce((s, e) => s + getEurAmount(e), 0)

  const makeCatBreakdown = (list) => list.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = { total: 0, subs: {} }
    acc[e.category].total += getEurAmount(e)
    const sub = e.sub_category || '__none__'
    acc[e.category].subs[sub] = (acc[e.category].subs[sub] || 0) + getEurAmount(e)
    return acc
  }, {})

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
            <button
              onClick={() => setShowBreakdown(v => !v)}
              className="bg-white/15 rounded-2xl p-3.5 text-left w-full active:bg-white/25 transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className="text-blue-200 text-xs">🧾 {isHe ? 'הוצאות נוספות' : 'Other Expenses'}</p>
                {showBreakdown ? <ChevronUp size={14} className="text-blue-200" /> : <ChevronDown size={14} className="text-blue-200" />}
              </div>
              <p className="font-bold text-lg mt-1">{formatCurrency(otherTotal, 'EUR')}</p>
            </button>
          </div>

          {/* Paid / Unpaid breakdown */}
          <AnimatePresence>
            {showBreakdown && otherExpenses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3 space-y-2"
              >
                {/* Paid */}
                {paidExpenses.length > 0 && (
                  <div>
                    <p className="text-blue-200 text-xs font-semibold mb-1 px-1">✅ {isHe ? 'שולמו' : 'Paid'} · {formatCurrency(paidTotal, 'EUR')}</p>
                    <div className="space-y-1">
                      {Object.entries(makeCatBreakdown(paidExpenses)).sort((a, b) => b[1].total - a[1].total).reverse().map(([cat, { total, subs }]) => {
                        const key = 'paid_' + cat
                        const hasSubs = Object.keys(subs).some(s => s !== '__none__')
                        const isOpen = expandedCat === key
                        return (
                          <div key={cat}>
                            <button onClick={() => hasSubs && setExpandedCat(isOpen ? null : key)}
                              className={`w-full flex items-center justify-between bg-white/10 rounded-xl px-3 py-2 ${hasSubs ? 'active:bg-white/20' : ''}`}>
                              <span className="text-blue-100 text-sm">{getCategoryIcon(cat)} {t('cat_' + cat)}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-white font-semibold text-sm">{formatCurrency(total, 'EUR')}</span>
                                {hasSubs && (isOpen ? <ChevronUp size={12} className="text-blue-200" /> : <ChevronDown size={12} className="text-blue-200" />)}
                              </div>
                            </button>
                            {isOpen && (
                              <div className="mt-0.5 ms-3 space-y-0.5">
                                {Object.entries(subs).filter(([s]) => s !== '__none__').sort((a, b) => b[1] - a[1]).map(([sub, amt]) => (
                                  <div key={sub} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5">
                                    <span className="text-blue-200 text-xs">{t('subcat_' + sub) || sub}</span>
                                    <span className="text-blue-100 text-xs font-semibold">{formatCurrency(amt, 'EUR')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Unpaid */}
                {unpaidExpenses.length > 0 && (
                  <div>
                    <p className="text-blue-200 text-xs font-semibold mb-1 px-1">⏳ {isHe ? 'טרם שולמו' : 'Unpaid'} · {formatCurrency(unpaidTotal, 'EUR')}</p>
                    <div className="space-y-1">
                      {Object.entries(makeCatBreakdown(unpaidExpenses)).sort((a, b) => b[1].total - a[1].total).map(([cat, { total, subs }]) => {
                        const key = 'unpaid_' + cat
                        const hasSubs = Object.keys(subs).some(s => s !== '__none__')
                        const isOpen = expandedCat === key
                        return (
                          <div key={cat}>
                            <button onClick={() => hasSubs && setExpandedCat(isOpen ? null : key)}
                              className={`w-full flex items-center justify-between bg-amber-400/20 rounded-xl px-3 py-2 ${hasSubs ? 'active:bg-amber-400/30' : ''}`}>
                              <span className="text-blue-100 text-sm">{getCategoryIcon(cat)} {t('cat_' + cat)}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-200 font-semibold text-sm">{formatCurrency(total, 'EUR')}</span>
                                {hasSubs && (isOpen ? <ChevronUp size={12} className="text-amber-200" /> : <ChevronDown size={12} className="text-amber-200" />)}
                              </div>
                            </button>
                            {isOpen && (
                              <div className="mt-0.5 ms-3 space-y-0.5">
                                {Object.entries(subs).filter(([s]) => s !== '__none__').sort((a, b) => b[1] - a[1]).map(([sub, amt]) => (
                                  <div key={sub} className="flex items-center justify-between bg-amber-400/10 rounded-lg px-3 py-1.5">
                                    <span className="text-amber-200 text-xs">{t('subcat_' + sub) || sub}</span>
                                    <span className="text-amber-100 text-xs font-semibold">{formatCurrency(amt, 'EUR')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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

      {/* Cash balance card */}
      {totalCollected > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          onClick={() => navigate('/cash')}
          className={`rounded-3xl p-4 shadow-sm border cursor-pointer active:opacity-80 transition-opacity ${
            cashAlert === 'critical' ? 'bg-red-50 border-red-200' :
            cashAlert === 'warning' ? 'bg-amber-50 border-amber-200' :
            'bg-white border-gray-100'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400">💵 {isHe ? 'יתרת קופת מזומנים' : 'Cash Balance'}</p>
            {cashAlert && <AlertTriangle size={16} className={cashAlert === 'critical' ? 'text-red-500' : 'text-amber-500'} />}
          </div>
          <p className={`text-2xl font-black ${cashAlert === 'critical' ? 'text-red-600' : cashAlert === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>
            {formatCurrency(cashBalance, 'EUR')}
          </p>
          {cashPct !== null && (
            <>
              <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all ${cashAlert === 'critical' ? 'bg-red-500' : cashAlert === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.max(0, Math.min(100, cashPct * 100))}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{Math.round(cashPct * 100)}% {isHe ? 'נשאר' : 'remaining'}</p>
            </>
          )}
        </motion.div>
      )}

      {/* Shopping remaining indicator */}
      {uncheckedItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          onClick={() => navigate('/shopping')}
          className="rounded-3xl p-4 shadow-sm border border-orange-200 bg-orange-50 cursor-pointer active:opacity-80 transition-opacity"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛒</span>
              <div>
                <p className="text-xs font-semibold text-orange-400">{isHe ? 'נותר לרכישה' : 'Items remaining'}</p>
                <p className="text-lg font-black text-orange-700">{uncheckedItems.length} {isHe ? 'פריטים' : 'items'}</p>
              </div>
            </div>
            <span className="text-orange-300 text-lg">›</span>
          </div>
        </motion.div>
      )}



      {/* Invite link */}
      {isAdmin && trip && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-0.5">{t('inviteLink')}</h3>
          <p className="text-gray-400 text-sm mb-4">
            {t('tripCode')}: <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-lg">{trip.invite_token}</span>
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
