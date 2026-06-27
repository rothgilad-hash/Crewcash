import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, simplifyDebts, formatCurrency } from '../lib/calculations'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Debts() {
  const { t } = useTranslation()
  const { participants, expenses } = useApp()

  const balances = calculateBalances(expenses, participants)
  const transactions = simplifyDebts(balances)

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
  const getColor = (name) => {
    const p = participants.find(x => x.name === name)
    const idx = participants.indexOf(p)
    return COLORS[idx % COLORS.length] || '#6B7280'
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-1">{t('debtsTitle')}</h3>
        <p className="text-gray-400 text-sm mb-4">
          {t('lang') === 'he'
            ? `${transactions.length} העברות מינימליות לסגירת כל החובות`
            : `${transactions.length} minimum transfers to settle all debts`}
        </p>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 size={48} className="text-emerald-400 mb-3" />
            <p className="font-semibold text-gray-700">{t('noDebts')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm"
                  style={{ backgroundColor: getColor(tx.fromName) }}>
                  {tx.fromName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{tx.fromName}</p>
                  <p className="text-xs text-gray-400">{t('owesTo')} {tx.toName}</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-center">
                  <p className="font-black text-lg text-gray-900">{formatCurrency(tx.amount, 'EUR')}</p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm"
                  style={{ backgroundColor: getColor(tx.toName) }}>
                  {tx.toName.charAt(0)}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Individual balances */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-4">{t('balance')}</h3>
        <div className="space-y-3">
          {participants.map((p, i) => {
            const b = balances[p.id] || { net: 0 }
            return (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                    {p.name.charAt(0)}
                  </div>
                  <span className="font-medium text-gray-800">{p.name}</span>
                </div>
                <span className={`font-bold ${b.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {b.net >= 0 ? '+' : ''}{formatCurrency(b.net, 'EUR')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
