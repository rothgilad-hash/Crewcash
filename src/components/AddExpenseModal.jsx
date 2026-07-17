import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { getCategoryIcon } from '../lib/calculations'
import Modal from './Modal'

const CATEGORIES = ['yacht', 'fuel', 'food', 'supermarket', 'alcohol', 'transport', 'activities', 'gear', 'accommodation', 'health', 'insurance', 'yacht_services', 'other']

const SUPERMARKET_ITEMS = [
  { he: 'שישיית מים',     en: 'Water (6-pack)' },
  { he: 'שישיית זירו',   en: 'Zero soda' },
  { he: 'לחם',            en: 'Bread' },
  { he: 'טונה',           en: 'Tuna cans' },
  { he: 'זיתים',          en: 'Olives' },
  { he: 'עגבניות',        en: 'Tomatoes' },
  { he: 'מלפפונים',       en: 'Cucumbers' },
  { he: 'אבטיח',          en: 'Watermelon' },
  { he: 'ביצים',          en: 'Eggs' },
  { he: 'גאודה',          en: 'Gouda' },
  { he: 'גבינת פטה',     en: 'Feta cheese' },
  { he: 'יוגרטים',        en: 'Yogurts' },
  { he: 'חלב',            en: 'Milk' },
  { he: 'חמאה',           en: 'Butter' },
  { he: 'סלמי',           en: 'Salami' },
  { he: 'סלמון מעושן',   en: 'Smoked salmon' },
  { he: 'נייר טואלט',    en: 'Toilet paper' },
  { he: 'סבון כלים',      en: 'Dish soap' },
  { he: 'שקיות זבל',     en: 'Garbage bags' },
  { he: 'קרם הגנה',      en: 'Sunscreen' },
  { he: 'משחת שיניים',   en: 'Toothpaste' },
  { he: "תפוצ'יפס",      en: 'Chips' },
  { he: 'עוגיות',         en: 'Cookies' },
]

const ALCOHOL_ITEMS = [
  { he: 'יין לבן',  en: 'White wine' },
  { he: 'יין אדום', en: 'Red wine' },
  { he: 'פרוסקו',   en: 'Prosecco' },
  { he: 'אפרול',    en: 'Aperol' },
  { he: 'טקילה',    en: 'Tequila' },
  { he: 'בירה',     en: 'Beer' },
  { he: 'ויסקי',    en: 'Whisky' },
  { he: 'וודקה',    en: 'Vodka' },
  { he: 'רדלר',     en: 'Radler' },
  { he: 'אוזו',     en: 'Ouzo' },
]

const SUBCATEGORIES = {
  insurance: ['insurance_main', 'insurance_deductible'],
  transport: ['transport_taxi_il', 'transport_taxi_abroad', 'transport_car_rental'],
  gear: ['gear_defibrillator'],
  yacht_services: ['yacht_services_cleaning', 'yacht_services_dinghy', 'yacht_services_sup'],
  other: ['other_shirts', 'other_gifts', 'other_misc'],
}
const CURRENCIES = ['ILS', 'EUR', 'USD']

const defaultForm = {
  description: '', amount: '', currency: 'EUR', category: '',
  sub_category: '', paid_by: '', is_yacht_cost: false, is_cash: false, notes: '',
  planned_date: '', is_paid: false
}

export default function AddExpenseModal({ open, onClose, expense = null }) {
  const { t, i18n } = useTranslation()
  const { trip, participants, lang, reloadExpenses } = useApp()
  const isHe = lang === 'he'
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [cartItems, setCartItems] = useState({})
  const [eurRate, setEurRate] = useState(null) // EUR per 1 unit of selected currency
  const autoFilledDesc = useRef(false)

  // Fetch EUR rate when currency changes
  useEffect(() => {
    if (form.currency === 'EUR') { setEurRate(1); return }
    fetch(`https://api.frankfurter.app/latest?from=${form.currency}&to=EUR`)
      .then(r => r.json())
      .then(d => setEurRate(d.rates?.EUR || null))
      .catch(() => setEurRate(null))
  }, [form.currency])

  useEffect(() => {
    if (expense) {
      setForm({ ...defaultForm, ...expense, amount: expense.amount?.toString() || '', paid_by: expense.paid_by || '' })
      autoFilledDesc.current = true
    } else {
      setForm(defaultForm)
      autoFilledDesc.current = false
    }
    setCartItems({})
  }, [expense, open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleCartItem = (name) => {
    setCartItems(prev => {
      const next = { ...prev }
      if (next[name]) delete next[name]
      else next[name] = '1'
      // auto-fill notes
      const list = Object.entries(next).map(([n, q]) => `${n} x${q}`).join(', ')
      setForm(f => ({ ...f, notes: list }))
      return next
    })
  }

  const setCartQty = (name, qty) => {
    setCartItems(prev => {
      const next = { ...prev, [name]: qty }
      const list = Object.entries(next).map(([n, q]) => `${n} x${q}`).join(', ')
      setForm(f => ({ ...f, notes: list }))
      return next
    })
  }

  const selectAlcohol = (item) => {
    const name = isHe ? item.he : item.en
    autoFilledDesc.current = true
    setForm(f => ({ ...f, description: name }))
  }

  const selectCategory = (cat) => {
    setForm(f => {
      const desc = (!f.description || autoFilledDesc.current) ? t('cat_' + cat) : f.description
      autoFilledDesc.current = true
      const subs = SUBCATEGORIES[cat]
      return { ...f, category: cat, sub_category: subs ? subs[0] : '', description: desc }
    })
  }

  const handleSave = async () => {
    if (!form.category || !form.amount) return
    const desc = form.description || t('cat_' + form.category)
    setSaving(true)
    const payload = {
      trip_id: trip.id,
      description: desc,
      amount: parseFloat(form.amount),
      currency: form.currency,
      eur_rate: eurRate || 1,
      category: form.category,
      sub_category: form.sub_category || null,
      paid_by: form.paid_by || null,
      is_yacht_cost: form.is_yacht_cost,
      is_cash: form.is_cash,
      notes: form.notes,
      planned_date: form.planned_date || null,
      is_paid: form.is_paid
    }
    let error
    if (expense?.id) {
      ({ error } = await supabase.from('expenses').update(payload).eq('id', expense.id))
    } else {
      ({ error } = await supabase.from('expenses').insert(payload))
    }
    setSaving(false)
    if (error) {
      alert('שגיאה: ' + error.message)
      return
    }
    reloadExpenses(trip.id)
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

        {/* 1. Category */}
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

        {/* 2. Sub-category */}
        {SUBCATEGORIES[form.category] && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('subCategory')}</label>
            <div className="flex flex-wrap gap-2">
              {SUBCATEGORIES[form.category].map(sub => (
                <button
                  key={sub}
                  onClick={() => set('sub_category', sub)}
                  className={`px-4 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95 ${
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

        {/* Supermarket items */}
        {form.category === 'supermarket' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">🛒 {isHe ? 'מוצרים שנקנו' : 'Items purchased'}</label>
            <div className="max-h-52 overflow-y-auto border-2 border-gray-100 rounded-2xl divide-y divide-gray-50">
              {SUPERMARKET_ITEMS.map(item => {
                const name = isHe ? item.he : item.en
                const selected = !!cartItems[name]
                return (
                  <div key={name} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${selected ? 'bg-blue-50' : ''}`}>
                    <button onClick={() => toggleCartItem(name)}
                      className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {selected && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                    <span className="flex-1 text-sm text-gray-800">{name}</span>
                    {selected && (
                      <input
                        type="text" value={cartItems[name]}
                        onChange={e => setCartQty(name, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-400"
                        placeholder="כמות"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Alcohol type */}
        {form.category === 'alcohol' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">🍷 {isHe ? 'סוג אלכוהול' : 'Alcohol type'}</label>
            <div className="flex flex-wrap gap-2">
              {ALCOHOL_ITEMS.map(item => {
                const name = isHe ? item.he : item.en
                const selected = form.description === name
                return (
                  <button key={name} onClick={() => selectAlcohol(item)}
                    className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                      selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'
                    }`}>
                    {name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 3. Amount + Currency */}
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

        {/* EUR conversion preview */}
        {form.currency !== 'EUR' && form.amount && eurRate && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm text-blue-500">{isHe ? 'שווה ערך ביורו' : 'EUR equivalent'}</span>
            <span className="text-sm font-bold text-blue-700">
              ≈ €{(parseFloat(form.amount) * eurRate).toFixed(2)}
              <span className="text-xs font-normal text-blue-400 mr-1"> (1 {form.currency} = €{eurRate.toFixed(4)})</span>
            </span>
          </div>
        )}

        {/* 4. Toggles */}
        <div className="space-y-1">
          {hasGil && form.category === 'yacht' && (
            <label className="flex items-center justify-between py-3.5 px-4 bg-blue-50 rounded-2xl cursor-pointer active:bg-blue-100 transition-colors">
              <span className="text-sm font-medium text-gray-800">⛵ {t('isYachtCost')}</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={form.is_yacht_cost} onChange={e => set('is_yacht_cost', e.target.checked)} />
                <div className={`w-11 h-6 rounded-full transition-colors ${form.is_yacht_cost ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_yacht_cost ? 'translate-x-5' : ''}`} />
              </div>
            </label>
          )}
          <label className="flex items-center justify-between py-3.5 px-4 bg-gray-50 rounded-2xl cursor-pointer active:bg-gray-100 transition-colors">
            <span className="text-sm font-medium text-gray-800">💵 {t('isCash')}</span>
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.is_cash} onChange={e => set('is_cash', e.target.checked)} />
              <div className={`w-11 h-6 rounded-full transition-colors ${form.is_cash ? 'bg-blue-600' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_cash ? 'translate-x-5' : ''}`} />
            </div>
          </label>
        </div>

        {/* 5. Paid by (personal payment) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            👤 {isHe ? 'שולם ע״י (אם מישהו שילם מכיסו)' : 'Paid personally by (optional)'}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => set('paid_by', '')}
              className={`px-4 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                !form.paid_by ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500'
              }`}
            >
              {isHe ? 'הקופה' : 'Kitty'}
            </button>
            {participants.map(p => (
              <button
                key={p.id}
                onClick={() => set('paid_by', p.id)}
                className={`px-4 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                  form.paid_by === p.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* 6. Planned date */}
        {form.is_cash && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📅 {isHe ? 'תאריך משוער לתשלום' : 'Planned payment date'}
            </label>
            <input
              type="date"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-blue-500 text-gray-900 bg-white transition-colors"
              value={form.planned_date}
              onChange={e => set('planned_date', e.target.value)}
            />
          </div>
        )}

        {/* 7. Notes */}
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
            disabled={saving || !form.category || !form.amount}
            className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 transition-colors disabled:opacity-40"
          >
            {saving ? '...' : t('save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
