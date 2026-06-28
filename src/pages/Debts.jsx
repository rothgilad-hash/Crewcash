import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency } from '../lib/calculations'
import { motion } from 'framer-motion'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export default function Debts() {
  const { t } = useTranslation()
  const { participants, expenses, lang } = useApp()
  const isHe = lang === 'he'

  const balances = calculateBalances(expenses, participants)

  const getRemaining = (p) => {
    const b = balances[p.id] || { owes: 0, paid: 0 }
    const paid = (p.amount_paid || 0) + (b.paid || 0)
    return Math.round((b.owes - paid + (p.kitty_paid_back || 0)) * 100) / 100
  }

  const owesKitty = participants.filter(p => getRemaining(p) > 0.5)
  const kittyOwes = participants.filter(p => getRemaining(p) < -0.5)

  const allSettled = owesKitty.length === 0 && kittyOwes.length === 0

  return (
    <div className="p-4 space-y-4">

      {allSettled ? (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <span className="text-5xl mb-3">✅</span>
          <p className="font-bold text-gray-800 text-lg">{t('noDebts')}</p>
        </div>
      ) : (
        <>
          {/* Owe the kitty */}
          {owesKitty.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 text-base">
                {isHe ? 'חייבים לקופה' : 'Owe the kitty'}
              </h3>
              <div className="space-y-3">
                {owesKitty.map((p, i) => {
                  const remaining = getRemaining(p)
                  const idx = participants.indexOf(p)
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 bg-red-50 rounded-2xl p-3.5"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                        <p className="text-xs text-gray-400">{isHe ? 'חייב לקופה' : 'owes the kitty'}</p>
                      </div>
                      <p className="font-black text-red-500 text-lg">{formatCurrency(remaining, 'EUR')}</p>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Kitty owes */}
          {kittyOwes.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 text-base">
                {isHe ? 'הקופה חייבת' : 'Kitty owes'}
              </h3>
              <div className="space-y-3">
                {kittyOwes.map((p, i) => {
                  const remaining = getRemaining(p)
                  const idx = participants.indexOf(p)
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 bg-emerald-50 rounded-2xl p-3.5"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                        <p className="text-xs text-gray-400">{isHe ? 'הקופה חייבת לו' : 'kitty owes them'}</p>
                      </div>
                      <p className="font-black text-emerald-500 text-lg">{formatCurrency(Math.abs(remaining), 'EUR')}</p>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
