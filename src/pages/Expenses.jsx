import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { formatCurrency, getCategoryIcon } from '../lib/calculations'
import AddExpenseModal from '../components/AddExpenseModal'
import { Plus, Banknote } from 'lucide-react'
import { motion } from 'framer-motion'

const CATEGORIES = ['all', 'yacht', 'fuel', 'food', 'supermarket', 'alcohol', 'transport', 'activities', 'gear', 'insurance', 'other']

export default function Expenses() {
  const { t } = useTranslation()
  const { expenses, participants, isAdmin, lang } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const isHe = lang === 'he'

  const filtered = filter === 'all' ? expenses : expenses.filter(e => e.category === filter)
  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const getParticipantName = (id) => participants.find(p => p.id === id)?.name || '—'

  const openEdit = (exp) => {
    if (!isAdmin) return
    setSelected(exp); setModalOpen(true)
  }
  const openAdd = () => {
    setSelected(null); setModalOpen(true)
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 130px)' }}>

      {/* Horizontal filter scroll */}
      <div className="bg-white border-b border-gray-100 sticky top-14 z-30">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-4 py-3 w-max">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  filter === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                }`}
              >
                {cat !== 'all' && <span className="text-base">{getCategoryIcon(cat)}</span>}
                {cat === 'all' ? (isHe ? 'הכל' : 'All') : t('cat_' + cat)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 p-4 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-6xl mb-4">🧾</span>
            <p className="text-gray-400 font-semibold text-lg">{t('noExpenses')}</p>
            {isAdmin && <p className="text-gray-300 text-sm mt-1">{t('addFirst')}</p>}
          </div>
        ) : (
          filtered.map((exp, i) => (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              onClick={() => openEdit(exp)}
              className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3.5 ${
                isAdmin ? 'active:bg-gray-50 active:border-blue-100' : ''
              } transition-colors`}
            >
              {/* Category icon */}
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0">
                {getCategoryIcon(exp.category)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="font-semibold text-gray-900 truncate text-[15px]">{exp.description}</p>
                  {exp.is_yacht_cost && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">×2</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="truncate">{getParticipantName(exp.paid_by)}</span>
                  <span>·</span>
                  <span>{t('cat_' + exp.category)}</span>
                  {exp.is_cash && <Banknote size={13} className="text-gray-300 flex-shrink-0" />}
                </div>
              </div>

              {/* Amount */}
              <div className={`text-right flex-shrink-0 ${isHe ? 'text-left' : 'text-right'}`}>
                <p className="font-bold text-gray-900 text-[15px]">{formatCurrency(exp.amount, exp.currency)}</p>
                <p className="text-xs text-gray-400">{exp.currency}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Total bar */}
      {filtered.length > 0 && (
        <div className="bg-white border-t border-gray-100 px-5 py-4 flex justify-between items-center">
          <span className="text-gray-500 font-medium">{t('total')} ({filtered.length})</span>
          <span className="text-2xl font-black text-gray-900">{formatCurrency(total, 'EUR')}</span>
        </div>
      )}

      {/* FAB */}
      {isAdmin && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={openAdd}
          className="fixed bottom-24 right-5 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-300 flex items-center justify-center active:scale-90 transition-transform z-30"
        >
          <Plus size={28} />
        </motion.button>
      )}

      <AddExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} expense={selected} />
    </div>
  )
}
