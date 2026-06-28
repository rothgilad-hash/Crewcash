import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency, getCategoryIcon } from '../lib/calculations'
import { motion } from 'framer-motion'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export default function Report() {
  const { participants, expenses, lang } = useApp()
  const isHe = lang === 'he'
  const balances = calculateBalances(expenses, participants)

  const totalExpenses = expenses.filter(e => !e.is_yacht_cost).reduce((s, e) => s + e.amount, 0)

  return (
    <div className="p-4 space-y-4">

      {/* Summary header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 text-base mb-1">{isHe ? 'סיכום הטיול' : 'Trip Summary'}</h3>
        <p className="text-3xl font-black text-gray-900">{formatCurrency(totalExpenses, 'EUR')}</p>
        <p className="text-gray-400 text-sm mt-1">
          {isHe ? `${expenses.filter(e=>!e.is_yacht_cost).length} הוצאות · ${participants.length} משתתפים` : `${expenses.filter(e=>!e.is_yacht_cost).length} expenses · ${participants.length} participants`}
        </p>
      </div>

      {/* Per-person breakdown */}
      {participants.map((p, i) => {
        const b = balances[p.id] || { owes: 0, paid: 0 }
        const cashPaid = p.amount_paid || 0
        const personalPaid = b.paid || 0
        const remaining = Math.round((b.owes - cashPaid - personalPaid) * 100) / 100

        const personalExpenses = expenses.filter(e => e.paid_by === p.id)

        const categoryBreakdown = expenses
          .filter(e => !e.is_yacht_cost)
          .reduce((acc, e) => {
            const share = e.amount / participants.length
            acc[e.category] = (acc[e.category] || 0) + share
            return acc
          }, {})

        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
          >
            {/* Person header */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                {p.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{p.name}{p.is_gil ? ' ⭐' : ''}</p>
                <p className={`text-sm font-semibold ${remaining > 0.5 ? 'text-red-500' : remaining < -0.5 ? 'text-emerald-500' : 'text-gray-400'}`}>
                  {remaining > 0.5
                    ? `${isHe ? 'חייב לקופה' : 'Owes'} ${formatCurrency(remaining, 'EUR')}`
                    : remaining < -0.5
                    ? `${isHe ? 'הקופה חייבת' : 'Kitty owes'} ${formatCurrency(Math.abs(remaining), 'EUR')}`
                    : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{isHe ? 'חלק בהוצאות' : 'Share'}</p>
                <p className="font-bold text-gray-900">{formatCurrency(b.owes, 'EUR')}</p>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="border-t border-gray-50 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-400 mb-2">{isHe ? 'פירוט לפי קטגוריה' : 'By category'}</p>
              {Object.entries(categoryBreakdown).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{getCategoryIcon(cat)} {isHe ? cat : cat}</span>
                  <span className="text-sm font-semibold text-gray-800">{formatCurrency(amt, 'EUR')}</span>
                </div>
              ))}
            </div>

            {/* Personal payments */}
            {personalExpenses.length > 0 && (
              <div className="border-t border-gray-50 px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 mb-2">{isHe ? 'שילם מכיסו' : 'Paid personally'}</p>
                {personalExpenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-0.5">
                    <span className="text-sm text-gray-600">{getCategoryIcon(e.category)} {e.description}</span>
                    <span className="text-sm font-semibold text-emerald-600">+{formatCurrency(e.amount, 'EUR')}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Cash paid to economist */}
            {cashPaid > 0 && (
              <div className="border-t border-gray-50 px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-500">{isHe ? 'שילם לקופה במזומן' : 'Paid to kitty'}</span>
                <span className="text-sm font-semibold text-blue-600">{formatCurrency(cashPaid, 'EUR')}</span>
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
