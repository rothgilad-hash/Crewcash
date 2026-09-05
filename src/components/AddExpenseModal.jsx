import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { getCategoryIcon } from '../lib/calculations'
import Modal from './Modal'

const CATEGORIES = ['yacht', 'fuel', 'food', 'supermarket', 'alcohol', 'transport', 'activities', 'gear', 'accommodation', 'health', 'insurance', 'yacht_services', 'other']


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
  insurance: ['insurance_main', 'insurance_deductible', 'insurance_rental_car'],
  transport: ['transport_taxi_il', 'transport_taxi_abroad', 'transport_car_rental'],
  fuel: ['fuel_yacht', 'fuel_car_rental'],
  gear: ['gear_defibrillator'],
  yacht_services: ['yacht_services_cleaning', 'yacht_services_dinghy', 'yacht_services_sup', 'yacht_services_repairs', 'yacht_services_mooring'],
  other: ['other_shirts', 'other_gifts', 'other_misc'],
}
const CURRENCIES = ['ILS', 'EUR', 'USD']

const ITEM_KEYWORD_CATS = {
  drinks:      ['מים','זירו','סודה','מיץ','קולה','ספרייט'],
  alcohol:     ['בירה','רדלר','יין','אפרול','ויסקי','וודקה','טקילה'],
  fruit:       ['אגס','לימון','אבטיח','מלון','תפוח','בננ','פירות'],
  vegetables:  ['בצל','עגבני','מלפפון','פלפל','גזר','ירק'],
  pantry:      ['לחם','טונה','מיונז','זיתים','אורז','פסטה','מלח','שמן','קפה','תה','שוקולד'],
  dairy:       ['יוגרט','גבינ','חלב','ביצ','חמאה','שמנת','קוטג','לבנה'],
  deli:        ['סלמי','סלמון','נקניק','שניצל','פסטרמה','עוף','קבב'],
  disposables: ['צלחת','כוס','מגש','אלומיניום','חד פעמי','קש','מפית'],
  cleaning:    ['נייר טואלט','שקית זבל','סבון כלים','ספוג','אקונומיקה'],
  hygiene:     ['שמפו','סבון','משחת שיניים','קרם הגנה','דאודורנט'],
  snacks:      ['תפוצ','קפריס','עוגי','בייגל','פצפוצ','חטיף','ביסלי','במבה'],
}

function autoDetectItemCat(name) {
  const n = name.toLowerCase()
  for (const [cat, kws] of Object.entries(ITEM_KEYWORD_CATS)) {
    if (kws.some(kw => n.includes(kw.toLowerCase()))) return cat
  }
  return 'other'
}

const defaultForm = {
  description: '', amount: '', currency: 'EUR', category: '',
  sub_category: '', paid_by: '', is_yacht_cost: false, is_cash: false, notes: '',
  planned_date: '', is_paid: false, is_unexpected: false, is_estimate: false,
  actual_amount: '', is_finalized: false
}

export default function AddExpenseModal({ open, onClose, expense = null }) {
  const { t, i18n } = useTranslation()
  const { trip, participants, lang, reloadExpenses } = useApp()
  const isHe = lang === 'he'
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [cartItems, setCartItems] = useState({})
  const [customItemInput, setCustomItemInput] = useState('')
  const [customItems, setCustomItems] = useState([])
  const [excludedIds, setExcludedIds] = useState([])
  const [eurRate, setEurRate] = useState(null)
  const [installments, setInstallments] = useState([])
  const [instForm, setInstForm] = useState({ amount: '', note: '', date: new Date().toISOString().split('T')[0] })
  const [savingInst, setSavingInst] = useState(false)
  const autoFilledDesc = useRef(false)

  // Fetch EUR rate when currency changes
  useEffect(() => {
    if (form.currency === 'EUR') { setEurRate(1); return }
    const cur = form.currency.toLowerCase()
    fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${cur}.json`)
      .then(r => r.json())
      .then(d => setEurRate(d[cur]?.eur || null))
      .catch(() => setEurRate(null))
  }, [form.currency])

  useEffect(() => {
    if (expense) {
      setForm({ ...defaultForm, ...expense, amount: expense.amount?.toString() || '', actual_amount: expense.actual_amount?.toString() || '', paid_by: expense.paid_by || '' })
      setExcludedIds((expense.excluded_ids || []).filter(id => participants.some(p => p.id === id)))
      setInstallments(expense.installments || [])
      autoFilledDesc.current = true
    } else {
      setForm(defaultForm)
      setExcludedIds([])
      setInstallments([])
      autoFilledDesc.current = false
    }
    setInstForm({ amount: '', note: '', date: new Date().toISOString().split('T')[0] })
    setCartItems({})
    setCustomItems([])
    setCustomItemInput('')
  }, [expense, open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const syncExpenseItems = async (expenseId, allInstallments) => {
    const itemMap = {}
    allInstallments.forEach(inst => {
      ;(inst.items || []).forEach(({ name, qty }) => {
        if (!itemMap[name]) itemMap[name] = { qty: 0, category: autoDetectItemCat(name) }
        itemMap[name].qty += parseFloat(qty) || 1
      })
    })
    await supabase.from('expense_items').delete().eq('expense_id', expenseId)
    const rows = Object.entries(itemMap).map(([name, { qty, category }]) => ({
      expense_id: expenseId, trip_id: trip.id, name, quantity: String(qty), category,
    }))
    if (rows.length) await supabase.from('expense_items').insert(rows)
  }

  const addInstallment = async () => {
    const amt = parseFloat(instForm.amount)
    if (!amt || !expense?.id) return
    setSavingInst(true)
    const instItems = Object.entries(cartItems).map(([name, qty]) => ({ name, qty }))
    const newItem = {
      amount: amt,
      note: instForm.note.trim(),
      date: instForm.date || new Date().toISOString().split('T')[0],
      items: instItems,
    }
    const newList = [...installments, newItem]
    const total = newList.reduce((s, i) => s + i.amount, 0)
    const { error: instErr } = await supabase.from('expenses').update({ installments: newList, actual_amount: total, is_estimate: true }).eq('id', expense.id)
    if (instErr) { alert('שגיאת שמירה: ' + instErr.message); setSavingInst(false); return }
    await syncExpenseItems(expense.id, newList)
    setInstallments(newList)
    setInstForm({ amount: '', note: '', date: new Date().toISOString().split('T')[0] })
    setCartItems({})
    reloadExpenses(trip.id)
    setSavingInst(false)
  }

  const removeInstallment = async (idx) => {
    if (!expense?.id) return
    const newList = installments.filter((_, i) => i !== idx)
    const total = newList.reduce((s, i) => s + i.amount, 0)
    await supabase.from('expenses').update({
      installments: newList,
      actual_amount: newList.length > 0 ? total : null,
      ...(newList.length === 0 ? { notes: null, planned_date: null } : {}),
    }).eq('id', expense.id)
    await syncExpenseItems(expense.id, newList)
    setInstallments(newList)
    setInstForm({ amount: '', note: '', date: new Date().toISOString().split('T')[0] })
    setCartItems({})
    setForm(f => ({ ...f, notes: '' }))
    reloadExpenses(trip.id)
  }

  const finalizeInstallments = async () => {
    if (!expense?.id) return
    const total = installments.reduce((s, i) => s + i.amount, 0)
    await supabase.from('expenses').update({ is_finalized: true, actual_amount: total || null, is_paid: true }).eq('id', expense.id)
    reloadExpenses(trip.id)
    onClose()
  }

  const toggleCartItem = (name) => {
    setCartItems(prev => {
      const next = { ...prev }
      if (next[name]) delete next[name]
      else next[name] = '1'
      return next
    })
  }

  const setCartQty = (name, qty) => {
    setCartItems(prev => {
      const next = { ...prev, [name]: qty }
      return next
    })
  }

  const addCustomItem = () => {
    const name = customItemInput.trim()
    if (!name) return
    if (!customItems.includes(name)) setCustomItems(prev => [...prev, name])
    toggleCartItem(name)
    setCustomItemInput('')
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

    // Always fetch fresh rate on save to avoid race conditions
    let finalEurRate = 1
    if (form.currency !== 'EUR') {
      try {
        const cur = form.currency.toLowerCase()
        const resp = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${cur}.json`)
        const data = await resp.json()
        finalEurRate = data[cur]?.eur || eurRate || 1
      } catch (err) {
        console.error('EUR rate fetch failed:', err)
        finalEurRate = eurRate || 1
      }
    }

    const payload = {
      trip_id: trip.id,
      description: desc,
      amount: parseFloat(form.amount),
      currency: form.currency,
      eur_rate: finalEurRate,
      category: form.category,
      sub_category: form.sub_category || null,
      paid_by: form.paid_by || null,
      is_yacht_cost: form.is_yacht_cost,
      is_cash: form.is_cash,
      notes: form.notes,
      planned_date: form.planned_date || null,
      is_paid: form.is_paid,
      is_unexpected: form.is_unexpected,
      is_estimate: form.is_estimate,
      actual_amount: form.is_estimate
        ? (installments.length > 0
            ? installments.reduce((s, i) => s + i.amount, 0)
            : (form.actual_amount ? parseFloat(form.actual_amount) : null))
        : null,
      is_finalized: form.is_finalized,
      excluded_ids: excludedIds.length > 0 ? excludedIds : null
    }
    let error, expenseId
    if (expense?.id) {
      ({ error } = await supabase.from('expenses').update(payload).eq('id', expense.id))
      expenseId = expense.id
    } else {
      const { data: inserted, error: insErr } = await supabase.from('expenses').insert(payload).select('id').single()
      error = insErr
      expenseId = inserted?.id
    }
    setSaving(false)
    if (error) {
      alert('שגיאה: ' + error.message)
      return
    }
    // Save supermarket cart items
    if (form.category === 'supermarket' && expenseId && Object.keys(cartItems).length > 0) {
      const items = Object.entries(cartItems).map(([name, quantity]) => ({
        expense_id: expenseId,
        trip_id: trip.id,
        name,
        quantity,
        category: autoDetectItemCat(name),
      }))
      await supabase.from('expense_items').delete().eq('expense_id', expenseId)
      await supabase.from('expense_items').insert(items)
    }
    reloadExpenses(trip.id)
    onClose()
  }

  const handleDelete = async () => {
    if (!expense?.id) return
    if (!window.confirm(t('confirmDelete'))) return
    await supabase.from('expenses').delete().eq('id', expense.id)
    reloadExpenses(trip.id)
    setForm(defaultForm)
    setCartItems({})
    setCustomItems([])
    setCustomItemInput('')
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🛒 {isHe
                ? (form.is_estimate && expense?.id && !form.is_finalized ? 'מוצרים שנקנו בתשלום זה' : 'מוצרים שנקנו')
                : (form.is_estimate && expense?.id && !form.is_finalized ? 'Items for this purchase' : 'Items purchased')}
            </label>
            {/* Custom items */}
            <div className="border-2 border-gray-100 rounded-2xl divide-y divide-gray-50">
            {customItems.map(name => {
              const selected = !!cartItems[name]
              return (
                <div key={name} className={`flex items-center gap-3 px-3 py-2.5 transition-colors border-t border-gray-100 ${selected ? 'bg-blue-50' : ''}`}>
                  <button onClick={() => toggleCartItem(name)}
                    className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                    {selected && <span className="text-white text-xs font-bold">✓</span>}
                  </button>
                  <span className="flex-1 text-sm text-gray-800">{name}</span>
                  {selected && (
                    <input type="text" value={cartItems[name]}
                      onChange={e => setCartQty(name, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-400"
                      placeholder="כמות" />
                  )}
                </div>
              )
            })}
            </div>
            {/* Free-text input */}
            <div className="flex gap-2 mt-2">
              <input
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
                placeholder={isHe ? '+ הוסף מוצר אחר...' : '+ Add other item...'}
                value={customItemInput}
                onChange={e => setCustomItemInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomItem()}
              />
              <button onClick={addCustomItem} disabled={!customItemInput.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold active:bg-blue-700 disabled:opacity-30">
                +
              </button>
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
          <label className="flex items-center justify-between py-3.5 px-4 bg-orange-50 rounded-2xl cursor-pointer active:bg-orange-100 transition-colors">
            <span className="text-sm font-medium text-gray-800">⚡ {isHe ? 'הוצאה לא צפויה' : 'Unexpected expense'}</span>
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.is_unexpected} onChange={e => set('is_unexpected', e.target.checked)} />
              <div className={`w-11 h-6 rounded-full transition-colors ${form.is_unexpected ? 'bg-orange-500' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_unexpected ? 'translate-x-5' : ''}`} />
            </div>
          </label>
          <label className="flex items-center justify-between py-3.5 px-4 bg-amber-50 rounded-2xl cursor-pointer active:bg-amber-100 transition-colors">
            <span className="text-sm font-medium text-gray-800">〜 {isHe ? 'הוצאה משוערת' : 'Estimated expense'}</span>
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.is_estimate} onChange={e => set('is_estimate', e.target.checked)} />
              <div className={`w-11 h-6 rounded-full transition-colors ${form.is_estimate ? 'bg-amber-500' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_estimate ? 'translate-x-5' : ''}`} />
            </div>
          </label>
        </div>

        {/* Installments — only when editing an estimate */}
        {form.is_estimate && expense?.id && !form.is_finalized && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">
                🧾 {isHe ? 'קניות בפועל' : 'Actual purchases'}
              </label>
              {installments.length > 0 && form.amount && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  installments.reduce((s, i) => s + i.amount, 0) > parseFloat(form.amount)
                    ? 'bg-red-100 text-red-600'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  €{installments.reduce((s, i) => s + i.amount, 0).toFixed(0)} / €{parseFloat(form.amount).toFixed(0)}
                </span>
              )}
            </div>

            {installments.length > 0 && (
              <div className="border border-amber-100 rounded-2xl divide-y divide-amber-50 overflow-hidden">
                {installments.map((inst, i) => (
                  <div key={i} className="px-3 py-2.5 bg-amber-50 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-amber-700">€{inst.amount}</span>
                      {inst.note && <span className="flex-1 text-xs text-gray-500 truncate">{inst.note}</span>}
                      {!inst.note && <span className="flex-1" />}
                      <span className="text-xs text-gray-400">{inst.date}</span>
                      <button onClick={() => removeInstallment(i)} className="text-red-300 active:text-red-500 p-1">✕</button>
                    </div>
                    {inst.items?.length > 0 && (
                      <div className="flex flex-wrap gap-1 ps-1">
                        {inst.items.map((it, j) => (
                          <span key={j} className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                            {it.name}{it.qty && it.qty !== '1' ? ` ×${it.qty}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-amber-100">
                  <span className="text-xs font-semibold text-amber-700">{isHe ? 'סה״כ עד כה' : 'Total so far'}</span>
                  <span className="text-sm font-black text-amber-800">
                    €{installments.reduce((s, i) => s + i.amount, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                className="w-20 border-2 border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 bg-white text-center font-bold"
                placeholder="€"
                value={instForm.amount}
                onChange={e => setInstForm(f => ({ ...f, amount: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addInstallment()}
              />
              <input
                type="date"
                className="w-32 border-2 border-gray-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:border-gray-400 bg-white"
                value={instForm.date}
                onChange={e => setInstForm(f => ({ ...f, date: e.target.value }))}
              />
              <input
                className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 bg-white"
                placeholder={isHe ? 'הערה' : 'Note'}
                value={instForm.note}
                onChange={e => setInstForm(f => ({ ...f, note: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addInstallment()}
              />
              <button
                onClick={addInstallment}
                disabled={!instForm.amount || savingInst}
                className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold active:bg-amber-600 disabled:opacity-40"
              >
                {savingInst ? '...' : '+'}
              </button>
            </div>

            {installments.length > 0 && (
              <button
                onClick={finalizeInstallments}
                className="w-full py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold active:bg-emerald-700"
              >
                ✅ {isHe ? 'סיים — הקניות הסתיימו' : 'Finalize — purchases complete'}
              </button>
            )}
          </div>
        )}

        {/* Finalized badge */}
        {form.is_estimate && form.is_finalized && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-700">✅ {isHe ? 'הוסדר סופית' : 'Finalized'}</span>
            <span className="text-sm font-black text-emerald-800">€{parseFloat(form.actual_amount || 0).toFixed(2)}</span>
          </div>
        )}

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

        {/* 6. Excluded participants */}
        {participants.length > 1 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🚫 {isHe ? 'לא משתתפים בהוצאה זו' : 'Not sharing this expense'}
            </label>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => {
                const excluded = excludedIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => setExcludedIds(prev =>
                      excluded ? prev.filter(id => id !== p.id) : [...prev, p.id]
                    )}
                    className={`px-4 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95 ${
                      excluded ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    {excluded ? '🚫 ' : ''}{p.name}
                  </button>
                )
              })}
            </div>
            {excludedIds.length > 0 && (
              <p className="text-xs text-red-400 mt-1">
                {isHe
                  ? `מחולק בין ${participants.length - excludedIds.length} מתוך ${participants.length} משתתפים`
                  : `Split among ${participants.length - excludedIds.length} of ${participants.length} participants`}
              </p>
            )}
          </div>
        )}

        {/* 7. Planned date */}
        {form.is_cash && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📅 {isHe ? 'תאריך ההוצאה' : 'Expense date'}
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                className="flex-1 border-2 border-gray-200 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-blue-500 text-gray-900 bg-white transition-colors"
                value={form.planned_date}
                onChange={e => set('planned_date', e.target.value)}
              />
              {form.planned_date && (
                <button onClick={() => set('planned_date', '')}
                  className="text-gray-400 active:text-gray-600 px-2 py-1 text-lg">✕</button>
              )}
            </div>
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
