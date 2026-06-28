import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Plus, Trash2, CheckSquare2, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const CATS = [
  { key: 'drinks',   he: '🥤 שתייה',    en: '🥤 Drinks' },
  { key: 'food',     he: '🥗 אוכל',     en: '🥗 Food' },
  { key: 'dairy',    he: '🧀 חלבי',     en: '🧀 Dairy' },
  { key: 'deli',     he: '🥩 דלי',      en: '🥩 Deli' },
  { key: 'cleaning', he: '🧹 ניקיון',   en: '🧹 Cleaning' },
  { key: 'hygiene',  he: '🧴 היגיינה',  en: '🧴 Hygiene' },
  { key: 'snacks',   he: '🍿 חטיפים',   en: '🍿 Snacks' },
  { key: 'other',    he: '📦 אחר',      en: '📦 Other' },
]

const DEFAULT_ITEMS = [
  { name: 'שישיה מים', nameEn: 'Water (6-pack)', quantity: '8', category: 'drinks' },
  { name: 'שישיית זירו', nameEn: 'Zero soda', quantity: '1', category: 'drinks' },
  { name: 'בקבוק יין לבן', nameEn: 'White wine', quantity: '5', category: 'drinks' },
  { name: 'אפרול', nameEn: 'Aperol', quantity: '2', category: 'drinks' },
  { name: 'פרוסקו', nameEn: 'Prosecco', quantity: '2', category: 'drinks' },
  { name: 'לחם', nameEn: 'Bread', quantity: '4', category: 'food' },
  { name: 'טונה', nameEn: 'Tuna cans', quantity: '12', category: 'food' },
  { name: 'זיתים', nameEn: 'Olives', quantity: '2', category: 'food' },
  { name: 'עגבניות', nameEn: 'Tomatoes', quantity: '2 kg', category: 'food' },
  { name: 'מלפפונים', nameEn: 'Cucumbers', quantity: '1 kg', category: 'food' },
  { name: 'אבטיח', nameEn: 'Watermelon', quantity: '1', category: 'food' },
  { name: 'ביצים', nameEn: 'Eggs', quantity: '50', category: 'food' },
  { name: 'גאודה', nameEn: 'Gouda cheese', quantity: '1 kg', category: 'dairy' },
  { name: 'גבינת פטה', nameEn: 'Feta cheese', quantity: '2', category: 'dairy' },
  { name: 'יוגרטים', nameEn: 'Yogurts', quantity: '20', category: 'dairy' },
  { name: 'חלב', nameEn: 'Milk', quantity: '1', category: 'dairy' },
  { name: 'חמאה', nameEn: 'Butter', quantity: '1', category: 'dairy' },
  { name: 'סלמי', nameEn: 'Salami', quantity: '1 kg', category: 'deli' },
  { name: 'סלמון מעושן', nameEn: 'Smoked salmon', quantity: '200g', category: 'deli' },
  { name: 'חבילת נייר טואלט', nameEn: 'Toilet paper', quantity: '18', category: 'cleaning' },
  { name: 'סבון כלים', nameEn: 'Dish soap', quantity: '1', category: 'cleaning' },
  { name: 'שקית זבל', nameEn: 'Garbage bags', quantity: '1', category: 'cleaning' },
  { name: 'קרם הגנה', nameEn: 'Sunscreen', quantity: '4', category: 'hygiene' },
  { name: 'משחת שיניים', nameEn: 'Toothpaste', quantity: '2', category: 'hygiene' },
  { name: 'תפוצ\'יפס', nameEn: 'Chips', quantity: '4', category: 'snacks' },
  { name: 'עוגיות', nameEn: 'Cookies', quantity: '1 pack', category: 'snacks' },
]

export default function Shopping() {
  const { t } = useTranslation()
  const { trip, shoppingItems, isAdmin, lang } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', quantity: '', category: 'other' })
  const [saving, setSaving] = useState(false)
  const isHe = lang === 'he'

  const toggleItem = (item) => supabase.from('shopping_items').update({ checked: !item.checked }).eq('id', item.id)
  const deleteItem = (id) => supabase.from('shopping_items').delete().eq('id', id)

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('shopping_items').insert({ trip_id: trip.id, ...form })
    setForm({ name: '', quantity: '', category: 'other' })
    setModalOpen(false)
    setSaving(false)
  }

  const importDefaults = async () => {
    const items = DEFAULT_ITEMS.map(item => ({
      trip_id: trip.id,
      name: isHe ? item.name : item.nameEn,
      quantity: item.quantity,
      category: item.category,
      checked: false
    }))
    await supabase.from('shopping_items').insert(items)
  }

  const clearChecked = async () => {
    const ids = shoppingItems.filter(i => i.checked).map(i => i.id)
    if (ids.length) await supabase.from('shopping_items').delete().in('id', ids)
  }

  const unchecked = shoppingItems.filter(i => !i.checked)
  const checked = shoppingItems.filter(i => i.checked)
  const grouped = CATS.map(cat => ({ ...cat, items: unchecked.filter(i => i.category === cat.key) })).filter(g => g.items.length > 0)
  const uncat = unchecked.filter(i => !CATS.find(c => c.key === i.category))

  return (
    <div className="p-4 space-y-4">
      {/* Progress bar */}
      {shoppingItems.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex justify-between text-sm font-medium text-gray-600 mb-2">
            <span>{isHe ? 'נרכשו' : 'Purchased'}</span>
            <span>{checked.length} / {shoppingItems.length}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(checked.length / shoppingItems.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Import defaults */}
      {isAdmin && shoppingItems.length === 0 && (
        <button
          onClick={importDefaults}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 font-semibold active:bg-blue-50 transition-colors"
        >
          📋 {isHe ? 'ייבא רשימת קניות מהשיוט' : 'Import default shopping list'}
        </button>
      )}

      {/* Empty */}
      {shoppingItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-6xl mb-4">🛒</span>
          <p className="text-gray-400 font-semibold">{t('noItems')}</p>
        </div>
      )}

      {/* Grouped unchecked */}
      {grouped.map(group => (
        <div key={group.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <p className="font-bold text-gray-700 text-sm">{isHe ? group.he : group.en}</p>
          </div>
          <div className="divide-y divide-gray-50">
            <AnimatePresence>
              {group.items.map(item => (
                <motion.div
                  key={item.id}
                  layout
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <button
                    onClick={() => toggleItem(item)}
                    className="text-gray-300 active:text-blue-500 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <Square size={24} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.quantity && <p className="text-sm text-gray-400 mt-0.5">{item.quantity}</p>}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-gray-200 active:text-red-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ))}

      {/* Uncategorized */}
      {uncat.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {uncat.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                <button onClick={() => toggleItem(item)}
                  className="text-gray-300 active:text-blue-500 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <Square size={24} />
                </button>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  {item.quantity && <p className="text-sm text-gray-400">{item.quantity}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden opacity-60">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <p className="font-bold text-gray-500 text-sm">✅ {isHe ? 'נרכשו' : 'Purchased'} ({checked.length})</p>
            {isAdmin && (
              <button onClick={clearChecked}
                className="text-xs text-red-400 font-semibold active:text-red-600 min-h-[44px] flex items-center">
                {isHe ? 'נקה' : 'Clear'}
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {checked.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                <button onClick={() => toggleItem(item)}
                  className="text-emerald-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <CheckSquare2 size={24} />
                </button>
                <p className="flex-1 text-gray-400 line-through text-sm">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAB */}
      {isAdmin && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setModalOpen(true)}
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
          className="fixed left-1/2 -translate-x-1/2 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-300 flex items-center justify-center active:scale-90 transition-transform z-30"
        >
          <Plus size={28} />
        </motion.button>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('addItem')}>
        <div className="space-y-4">
          <input
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white placeholder-gray-300"
            placeholder={`${t('itemName')} *`}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <input
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white placeholder-gray-300"
            placeholder={t('quantity')}
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
          />
          <select
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          >
            {CATS.map(c => <option key={c.key} value={c.key}>{isHe ? c.he : c.en}</option>)}
          </select>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50">
              {t('cancel')}
            </button>
            <button onClick={handleAdd} disabled={saving || !form.name.trim()}
              className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 disabled:opacity-40">
              {saving ? '...' : t('save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
