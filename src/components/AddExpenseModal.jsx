import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { getCategoryIcon } from '../lib/calculations'
import Modal from './Modal'

const CATEGORIES = ['yacht', 'fuel', 'food', 'supermarket', 'alcohol', 'transport', 'activities', 'gear', 'accommodation', 'health', 'insurance', 'other']
const INSURANCE_SUBCATEGORIES = ['insurance_main', 'insurance_deductible']
const CURRENCIES = ['ILS', 'EUR', 'USD']

const defaultForm = {
  description: '', amount: '', currency: 'EUR', category: 'other',
  sub_category: '', paid_by: '', is_yacht_cost: false, is_cash: false, notes: ''
}

export default function AddExpenseModal({ open, onClose, expense = null }) {
  const { t } = useTranslation()
  const { trip, participants } = useApp()
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const autoFilledDesc = useRef(false)

  useEffect(() => {
    if (expense) {
      setForm({ ...defaultForm, ...expense, amount: expense.amount?.toString() || '', paid_by: expense.paid_by || '' })
      autoFilledDesc.current = false
    } else {
      setForm(defaultForm)
      autoFilledDesc.current = false
    }
  }, [expense, open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selectCategory = (cat) => {
    setForm(f => {
      const desc = (!f.description || autoFilledDesc.current) ? t('cat_' + cat) : f.description
      autoFilledDesc.current = true
      return { ...f, category: cat, sub_category: cat === 'insurance' ? 'insurance_main' : '', description: desc }
    })
  }

  const handleSave = async () => {
    if (!form.description || !form.amount) return
    setSaving(true)
    const payload = {
      trip_id: trip.id,
      description: form.description,
      amount: parseFloat(form.amount),
      currency: form.currency,
      category: form.category,
      sub_category: form.sub_category || null,
      paid_by: form.paid_by || null,
      is_yacht_cost: form.is_yacht_cost,
      is_cash: form.is_cash,
      notes: form.notes
    }
    if (expense?.id) {
      await supabase.from('expenses').update(payload).eq('id', expense.id)
    } else {
      await supabase.from('expenses').insert(payload)
    }
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!expense?.id) return
    if (!window.confirm(t('confirmDelete'))) return
    await supabase.from('expenses').delete().eq('id', expense.id)
    onClose()
  }

  const hasGil = participants.some(p => p.is_gil)

  return (
    <Modal open={open} onClose={onClose} title={expense ? t('editExpense') : t('addExpense')}>
      <div className="space-y-5">

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('description')} *</label>
          <input
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-blue-500 text-gray-900 bg-white transition-colors"
            placeholder={t('description')}
            value={form.description}
            onChange={e => { autoFilledDesc.current = false; set('description', e.target.value) }}
          />
        </div>

        {/* Amount + Currency */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('amount')} *</label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-blue-500 text-gray-900 bg-white transition-colors"
              placeholder="0"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
            />
          </div>
          <div className="w-28">
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('currency')}</label>
            <select
              className="w-full border-2 border-gray-200 rounded-2xl px-3 py-3.5 focus:outline-none focus:border-blue-500 text-gray-900 bg-white transition-colors"
              value={form.currency}
              onChange={e => set('currency', e.target.value)}
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('category')}</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => selectCategory(cat)}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all active:scale-95 ${
                  form.category === cat
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white active:bg-gray-50'
                }`}
              >
                <span className="text-2xl">{getCategoryIcon(cat)}</span>
                <span className="text-xs text-gray-600 font-medium leading-tight text-center">{t('cat_' + cat)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Insurance sub-category */}
        {form.category === 'insurance' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('subCategory')}</label>
            <div className="flex gap-3">
              {INSURANCE_SUBCATEGORIES.map(sub => (
                <button
                  key={sub}
                  onClick={() => set('sub_category', sub)}
                  className={`flex-1 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                    form.sub_category === sub
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  {t('subcat_' + sub)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Paid by */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('paidBy')}</label>
          <select
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-blue-500 text-gray-900 bg-white transition-colors"
            value={form.paid_by}
            onChange={e => set('paid_by', e.target.value)}
          >
            <option value="">— {t('paidBy')} —</option>
            {participants.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.is_gil ? ' ⭐' : ''}</option>
            ))}
          </select>
        </div>

        {/* Toggles */}
        <div className="space-y-1">
          {hasGil && (
            <label className="flex items-center justify-between py-3.5 px-4 bg-blue-50 rounded-2xl cursor-pointer active:bg-blue-100 transition-colors">
              <span className="text-sm font-medium text-gray-800">⛵ {t('isYachtCost')}</span>
              <div className="relative">
                <input type="checkbox" className="sr-only peer" checked={form.is_yacht_cost} onChange={e => set('is_yacht_cost', e.target.checked)} />
                <div className={`w-11 h-6 rounded-full transition-colors ${form.is_yacht_cost ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_yacht_cost ? 'translate-x-5' : ''}`} />
              </div>
            </label>
          )}
          <label className="flex items-center justify-between py-3.5 px-4 bg-gray-50 rounded-2xl cursor-pointer active:bg-gray-100 transition-colors">
            <span className="text-sm font-medium text-gray-800">💵 {t('isCash')}</span>
            <div className="relative">
              <input type="checkbox" className="sr-only peer" checked={form.is_cash} onChange={e => set('is_cash', e.target.checked)} />
              <div className={`w-11 h-6 rounded-full transition-colors ${form.is_cash ? 'bg-blue-600' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_cash ? 'translate-x-5' : ''}`} />
            </div>
          </label>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('notes')}</label>
          <input
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-blue-500 text-gray-900 bg-white transition-colors"
            placeholder={t('notes')}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          {expense?.id && (
            <button
              onClick={handleDelete}
              className="px-5 py-4 rounded-2xl border-2 border-red-200 text-red-500 font-semibold active:bg-red-50 transition-colors"
            >
              {t('delete')}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.description || !form.amount}
            className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 transition-colors disabled:opacity-40"
          >
            {saving ? '...' : t('save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
