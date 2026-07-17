import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { formatCurrency, getCategoryIcon, getEurAmount } from '../lib/calculations'
import AddExpenseModal from '../components/AddExpenseModal'
import { Plus, Banknote, CheckCircle2, Circle } from 'lucide-react'
import { motion } from 'framer-motion'

const CATEGORIES = ['all', 'yacht', 'fuel', 'food', 'supermarket', 'alcohol', 'transport', 'activities', 'gear', 'insurance', 'yacht_services', 'other']

export default function Expenses() {
  const { t } = useTranslation()
  const { expenses, participants, isAdmin, lang } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const isHe = lang === 'he'

  const filtered = filter === 'all' ? expenses : expenses.filter(e => e.category === filter)
  const total = filtered.reduce((s, e) => s + getEurAmount(e), 0)

  const openEdit = (exp) => {
    if (!isAdmin) return
    setSelected(exp); setModalOpen(true)
  }
  const openAdd = () => {
    setSelected(null); setModalOpen(true)
  }

  const togglePaid = async (e, exp) => {
    e.stopPropagation()
    await supabase.from('expenses').update({ is_paid: !exp.is_paid }).eq('id', exp.id)
  }

  return (
    <div className="flex" style={{ minHeight: 'calc(100dvh - 130px)' }}>

      {/* Vertical category sidebar */}
      <div className="w-[72px] flex-shrink-0 bg-white border-e border-gray-100 overflow-y-auto sticky top-14 self-start" style={{ maxHeight: 'calc(100dvh - 130px)' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`w-full flex flex-col items-center justify-center gap-1 py-3 px-1 transition-all active:scale-95 border-b border-gray-50 ${
              filter === cat
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-400 active:bg-gray-50'
            }`}
          >
            <span className="text-xl leading-none">
              {cat === 'all' ? '📋' : getCategoryIcon(cat)}
            </span>
            <span className={`text-[9px] font-semibold leading-tight text-center line-clamp-2 ${filter === cat ? 'text-blue-600' : 'text-gray-400'}`}>
              {cat === 'all' ? (isHe ? 'הכל' : 'All') : t('cat_' + cat)}
            </span>
            {filter === cat && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-600 rounded-r-full" />
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Add button */}
        {isAdmin && (
          <div className="p-3 pb-0">
            <button
              onClick={openAdd}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 font-semibold text-sm bg-blue-50 active:bg-blue-100 transition-colors"
            >
              <Plus size={18} />
              {isHe ? 'הוסף הוצאה' : 'Add Expense'}
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 p-3 space-y-2">
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
                className={`rounded-2xl p-3.5 shadow-sm border flex items-center gap-3 transition-colors ${
                  exp.is_cash && exp.is_paid
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-white border-gray-100'
                } ${isAdmin ? 'active:bg-gray-50' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">
                  {getCategoryIcon(exp.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <p className="font-semibold text-gray-900 truncate text-sm">{exp.description}</p>
                    {exp.is_yacht_cost && (
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">×2</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    {exp.sub_category && <span className="flex-shrink-0">{t('subcat_' + exp.sub_category)}</span>}
                    {exp.sub_category && exp.notes && <span className="text-gray-300">·</span>}
                    {exp.notes && <span className="truncate">{exp.notes}</span>}
                    {exp.is_cash && !exp.sub_category && !exp.notes && <Banknote size={11} className="text-gray-300 flex-shrink-0" />}
                    {exp.planned_date && !exp.is_paid && (
                      <span className="flex-shrink-0 text-blue-400">
                        {exp.sub_category || exp.notes ? '·' : ''} {new Date(exp.planned_date).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(exp.amount, exp.currency)}</p>
                    {exp.currency !== 'EUR' && exp.eur_rate && (
                      <p className="text-[10px] text-blue-400 font-semibold">≈ {formatCurrency(getEurAmount(exp), 'EUR')}</p>
                    )}
                    {exp.currency !== 'EUR' && !exp.eur_rate && (
                      <p className="text-[10px] text-gray-400">{exp.currency}</p>
                    )}
                  </div>
                  {isAdmin && exp.is_cash && (
                    <button
                      onClick={(e) => togglePaid(e, exp)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl active:bg-gray-100 transition-colors flex-shrink-0"
                    >
                      {exp.is_paid
                        ? <CheckCircle2 size={20} className="text-emerald-500" />
                        : <Circle size={20} className="text-gray-300" />
                      }
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Total bar */}
        {filtered.length > 0 && (
          <div className="bg-white border-t border-gray-100 px-4 py-3.5 flex justify-between items-center">
            <span className="text-gray-500 font-medium text-sm">{t('total')} ({filtered.length})</span>
            <span className="text-xl font-black text-gray-900">{formatCurrency(total, 'EUR')}</span>
          </div>
        )}
      </div>

      <AddExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} expense={selected} />
    </div>
  )
}
