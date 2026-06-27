import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { getLeaderboard, formatCurrency } from '../lib/calculations'
import { motion } from 'framer-motion'

const AWARDS = [
  {
    key: 'generous',
    titleHe: '🏆 הכי נדיב',
    titleEn: '🏆 Most Generous',
    descHe: 'שילם הכי הרבה',
    descEn: 'Paid the most',
    fn: (stats) => stats.sort((a, b) => b.totalPaid - a.totalPaid)[0],
    val: (s) => formatCurrency(s.totalPaid, 'EUR'),
    color: 'from-amber-400 to-orange-500',
    emoji: '🏆'
  },
  {
    key: 'drinker',
    titleHe: '🍷 שותה האלכוהול',
    titleEn: '🍷 Biggest Drinker',
    descHe: 'הוציא הכי הרבה על אלכוהול',
    descEn: 'Spent most on alcohol',
    fn: (stats) => stats.sort((a, b) => b.alcoholSpend - a.alcoholSpend)[0],
    val: (s) => formatCurrency(s.alcoholSpend, 'EUR'),
    color: 'from-purple-400 to-pink-500',
    emoji: '🍷'
  },
  {
    key: 'food',
    titleHe: '🍽️ מבקר המסעדות',
    titleEn: '🍽️ Food Critic',
    descHe: 'הוציא הכי הרבה על אוכל',
    descEn: 'Spent most on food',
    fn: (stats) => stats.sort((a, b) => b.foodSpend - a.foodSpend)[0],
    val: (s) => formatCurrency(s.foodSpend, 'EUR'),
    color: 'from-orange-400 to-red-500',
    emoji: '🍽️'
  },
  {
    key: 'receipts',
    titleHe: '🧾 קולקטור הקבלות',
    titleEn: '🧾 Receipt Collector',
    descHe: 'הכי הרבה תשלומים בודדים',
    descEn: 'Most individual payments',
    fn: (stats) => stats.sort((a, b) => b.expenseCount - a.expenseCount)[0],
    val: (s) => `${s.expenseCount} 🧾`,
    color: 'from-emerald-400 to-teal-500',
    emoji: '🧾'
  },
]

export default function Leaderboard() {
  const { t } = useTranslation()
  const { participants, expenses, lang } = useApp()
  const isHe = lang === 'he'

  const stats = getLeaderboard(expenses, participants)

  if (participants.length === 0 || expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center px-4">
        <span className="text-5xl mb-4">🏆</span>
        <p className="text-gray-400 font-medium">{isHe ? 'אין מספיק נתונים עדיין' : 'Not enough data yet'}</p>
        <p className="text-gray-300 text-sm mt-1">{isHe ? 'הוסף הוצאות כדי לראות את לוח הכבוד' : 'Add expenses to see the rankings'}</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-center py-2">
        <h2 className="text-2xl font-black text-gray-900">{isHe ? '🏆 לוח הכבוד' : '🏆 Hall of Fame'}</h2>
        <p className="text-gray-400 text-sm">{isHe ? `שיוט ${new Date().getFullYear()}` : `${new Date().getFullYear()} Cruise`}</p>
      </div>

      {AWARDS.map((award, i) => {
        const winner = award.fn([...stats])
        if (!winner || award.val(winner) === formatCurrency(0, 'EUR')) return null
        return (
          <motion.div
            key={award.key}
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
            className={`bg-gradient-to-r ${award.color} rounded-3xl p-5 text-white shadow-lg`}
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                {winner.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-xs font-medium mb-0.5">
                  {isHe ? award.titleHe : award.titleEn}
                </p>
                <p className="text-2xl font-black">{winner.name}</p>
                <p className="text-white/70 text-sm">{isHe ? award.descHe : award.descEn}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-black">{award.val(winner)}</p>
              </div>
            </div>
          </motion.div>
        )
      })}

      {/* Full ranking table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{isHe ? 'טבלת תשלומים מלאה' : 'Full payment table'}</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {[...stats].sort((a, b) => b.totalPaid - a.totalPaid).map((s, i) => (
            <div key={s.name} className="flex items-center gap-4 px-5 py-3.5">
              <span className="text-xl w-8 text-center">{['🥇', '🥈', '🥉'][i] || `${i + 1}.`}</span>
              <p className="flex-1 font-semibold text-gray-900">{s.name}</p>
              <p className="font-black text-gray-900">{formatCurrency(s.totalPaid, 'EUR')}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
