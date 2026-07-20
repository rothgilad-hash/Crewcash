import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency, getCategoryIcon, getEurAmount, getCollectedAmount } from '../lib/calculations'
import { motion } from 'framer-motion'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export default function Report() {
  const { t } = useTranslation()
  const { participants, expenses, kittyRefunds, kittyCollections, lang } = useApp()
  const isHe = lang === 'he'
  const balances = calculateBalances(expenses, participants)

  const getRefunds = (pid) => kittyRefunds.filter(r => r.participant_id === pid)
  const getKittyPaidBack = (pid) => {
    const fromTable = getRefunds(pid).reduce((s, r) => s + r.amount, 0)
    const p = participants.find(x => x.id === pid)
    return fromTable > 0 ? fromTable : (p?.kitty_paid_back || 0)
  }

  const runningExpenses = expenses.filter(e => !e.is_yacht_cost)
  const totalExpenses = runningExpenses.reduce((s, e) => s + getEurAmount(e), 0)
  const yachtTotal = expenses.filter(e => e.is_yacht_cost).reduce((s, e) => s + getEurAmount(e), 0)

  const lateJoiners = participants.filter(p => p.joined_late)
  const hasLateJoiners = lateJoiners.length > 0

  return (
    <div className="p-4 space-y-4">

      {/* Summary header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 text-base mb-1">{isHe ? 'סיכום הטיול' : 'Trip Summary'}</h3>
        <p className="text-3xl font-black text-gray-900">{formatCurrency(totalExpenses, 'EUR')}</p>
        <p className="text-gray-400 text-sm mt-1">
          {runningExpenses.length} {isHe ? 'הוצאות' : 'expenses'} · {participants.length} {isHe ? 'משתתפים' : 'participants'}
        </p>
      </div>

      {/* Per-person breakdown */}
      {participants.map((p, i) => {
        const b = balances[p.id] || { owes: 0, paid: 0 }
        const collected = getCollectedAmount(kittyCollections, p.id, p)
        const myCollections = kittyCollections.filter(c => c.participant_id === p.id)
        const personalPaid = b.paid || 0
        const kittyPaidBack = getKittyPaidBack(p.id)
        const refunds = getRefunds(p.id)
        const remaining = Math.round((b.owes - collected - personalPaid + kittyPaidBack) * 100) / 100
        // Kitty owes only if no collection yet (collection already absorbs personal credit)
        const kittyOwes = remaining < -0.5 && personalPaid > 0 && collected === 0

        const personalExpenses = expenses.filter(e => e.paid_by === p.id && !e.is_yacht_cost)

        // Running share before any yacht adjustments
        const runningShare = Math.round((totalExpenses / participants.length) * 100) / 100

        // Late joiner reduction for this person
        const existing = participants.filter(x => !x.joined_late)
        const oldParts = existing.reduce((sum, x) => sum + (x.is_gil ? 2 : 1), 0)
        const newParts = participants.reduce((sum, x) => sum + (x.is_gil ? 2 : 1), 0)
        const myParts = p.is_gil ? 2 : 1
        const yachtReduction = (hasLateJoiners && !p.joined_late && oldParts > 0 && newParts > 0)
          ? Math.round(yachtTotal * myParts * (1 / oldParts - 1 / newParts) * 100) / 100
          : 0

        const categoryBreakdown = runningExpenses.reduce((acc, e) => {
          const share = getEurAmount(e) / participants.length
          acc[e.category] = (acc[e.category] || 0) + share
          return acc
        }, {})

        const lateJoinerNames = lateJoiners.map(x => x.name).join(', ')

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
                <p className="font-bold text-gray-900">{p.name}{p.is_gil ? ' ⭐' : ''}{p.joined_late ? ' ⏰' : ''}</p>
                <p className={`text-sm font-semibold ${remaining > 0.5 ? 'text-red-500' : kittyOwes ? 'text-emerald-500' : 'text-gray-400'}`}>
                  {remaining > 0.5
                    ? `${isHe ? 'חייב לקופה' : 'Owes kitty'} ${formatCurrency(remaining, 'EUR')}`
                    : kittyOwes
                    ? `${isHe ? 'הקופה חייבת לו' : 'Kitty owes'} ${formatCurrency(Math.abs(remaining), 'EUR')}`
                    : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                </p>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="border-t border-gray-100 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-400 mb-2">{isHe ? 'חלקו בהוצאות השוטפות' : 'Share of running expenses'}</p>
              {Object.entries(categoryBreakdown).sort((a, c) => c[1] - a[1]).map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{getCategoryIcon(cat)} {t('cat_' + cat)}</span>
                  <span className="text-sm font-semibold text-gray-800">{formatCurrency(amt, 'EUR')}</span>
                </div>
              ))}

              {/* Subtotal running share */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                <span className="text-sm text-gray-500">{isHe ? 'סה״כ' : 'Subtotal'}</span>
                <span className="text-sm font-bold text-gray-800">{formatCurrency(runningShare, 'EUR')}</span>
              </div>

              {/* Late joiner reduction */}
              {yachtReduction > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-600">
                    ⏰ {isHe ? `הפחתה (${lateJoinerNames} הצטרף מאוחר)` : `Reduction (${lateJoinerNames} joined late)`}
                  </span>
                  <span className="text-sm font-bold text-emerald-600">−{formatCurrency(yachtReduction, 'EUR')}</span>
                </div>
              )}

              {/* Net */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                <span className="text-sm font-bold text-gray-700">{isHe ? 'לתשלום לקופה' : 'Net owed to kitty'}</span>
                <span className="text-sm font-black text-gray-900">{formatCurrency(b.owes, 'EUR')}</span>
              </div>
            </div>

            {/* Personal payments */}
            {personalExpenses.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 mb-2">{isHe ? 'שילם מכיסו' : 'Paid personally'}</p>
                {personalExpenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-0.5 gap-2">
                    <span className="text-sm text-gray-600 flex-1 min-w-0 truncate">
                      {getCategoryIcon(e.category)} {e.notes || e.description}
                    </span>
                    <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">
                      {formatCurrency(e.amount, e.currency)}
                      {e.currency !== 'EUR' && e.eur_rate && (
                        <span className="text-xs text-blue-400 block">
                          ≈ {formatCurrency(getEurAmount(e), 'EUR')}
                          <span className="text-gray-300 font-normal"> · {new Date(e.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
                  <span className="text-sm text-gray-500">{isHe ? 'סה״כ מכיסו' : 'Total personal'}</span>
                  <span className="text-sm font-bold text-emerald-600">{formatCurrency(personalExpenses.reduce((s,e) => s + getEurAmount(e), 0), 'EUR')}</span>
                </div>
              </div>
            )}

            {/* Collections per round */}
            {myCollections.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 mb-2">{isHe ? 'גיוסים לקופה' : 'Collections'}</p>
                {myCollections.map(c => (
                  <div key={c.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">💰 {c.round_name}</span>
                    <span className="text-sm font-semibold text-blue-600">{formatCurrency(c.amount, 'EUR')}</span>
                  </div>
                ))}
                {myCollections.length > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
                    <span className="text-sm text-gray-400">{isHe ? 'סה״כ גויס' : 'Total collected'}</span>
                    <span className="text-sm font-bold text-blue-600">{formatCurrency(collected, 'EUR')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Kitty refunds */}
            {refunds.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                <p className="text-xs font-semibold text-gray-400">{isHe ? 'החזרים מהקופה' : 'Kitty refunds'}</p>
                {refunds.map((r, ri) => (
                  <div key={r.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {isHe ? `החזר ${ri + 1}` : `Refund ${ri + 1}`}
                        {r.created_at && (
                          <span className="text-gray-400 text-xs ms-2">
                            {new Date(r.created_at).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(r.amount, 'EUR')}</span>
                    </div>
                    {r.signature && (
                      <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
                        <img src={r.signature} alt="signature" className="w-full max-h-20 object-contain" />
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <span className="text-sm font-bold text-gray-700">{isHe ? 'יתרה סופית' : 'Final balance'}</span>
                  <span className={`text-sm font-black ${remaining > 0.5 ? 'text-red-500' : kittyOwes ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {remaining > 0.5 ? formatCurrency(remaining, 'EUR') : kittyOwes ? `−${formatCurrency(Math.abs(remaining), 'EUR')}` : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
