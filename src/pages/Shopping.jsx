import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Plus, Trash2, CheckSquare2, Square, FileSpreadsheet, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'

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

const CAT_MAP = {
  'שתייה': 'drinks', 'drinks': 'drinks',
  'אוכל': 'food', 'food': 'food',
  'חלבי': 'dairy', 'dairy': 'dairy',
  'דלי': 'deli', 'deli': 'deli',
  'ניקיון': 'cleaning', 'cleaning': 'cleaning',
  'היגיינה': 'hygiene', 'hygiene': 'hygiene',
  'חטיפים': 'snacks', 'snacks': 'snacks',
  'אחר': 'other', 'other': 'other',
}

export default function Shopping() {
  const { t } = useTranslation()
  const { trip, shoppingItems, isAdmin, lang } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', quantity: '', category: 'other' })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showYachtness, setShowYachtness] = useState(false)
  const [previewItems, setPreviewItems] = useState(null)
  const fileRef = useRef(null)
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

  const clearChecked = async () => {
    const ids = shoppingItems.filter(i => i.checked).map(i => i.id)
    if (ids.length) await supabase.from('shopping_items').delete().in('id', ids)
  }

  const handleExcelFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).filter(r => r.some(c => c))

      // detect header row
      const first = rows[0]?.map(c => String(c || '').toLowerCase().trim())
      const hasHeader = first?.some(c => ['name', 'שם', 'פריט', 'item', 'quantity', 'כמות', 'category', 'קטגוריה'].includes(c))

      const dataRows = hasHeader ? rows.slice(1) : rows
      const nameIdx = hasHeader ? (first.findIndex(c => ['name','שם','פריט','item'].includes(c)) || 0) : 0
      const qtyIdx  = hasHeader ? (first.findIndex(c => ['quantity','כמות','qty'].includes(c)))       : 1
      const catIdx  = hasHeader ? (first.findIndex(c => ['category','קטגוריה','cat'].includes(c)))    : 2

      const parsed = dataRows
        .filter(r => r[nameIdx])
        .map(r => ({
          name: String(r[nameIdx] || '').trim(),
          quantity: String(r[qtyIdx >= 0 ? qtyIdx : 1] || '').trim(),
          category: CAT_MAP[String(r[catIdx >= 0 ? catIdx : 2] || '').trim()] || 'other',
        }))

      setPreviewItems(parsed)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const confirmImport = async () => {
    if (!previewItems?.length) return
    setImporting(true)
    await supabase.from('shopping_items').insert(
      previewItems.map(item => ({ trip_id: trip.id, ...item, checked: false }))
    )
    setPreviewItems(null)
    setImporting(false)
  }

  const unchecked = shoppingItems.filter(i => !i.checked)
  const checked = shoppingItems.filter(i => i.checked)
  const grouped = CATS.map(cat => ({ ...cat, items: unchecked.filter(i => i.category === cat.key) })).filter(g => g.items.length > 0)
  const uncat = unchecked.filter(i => !CATS.find(c => c.key === i.category))

  return (
    <div className="p-4 space-y-4">

      {/* Action buttons */}
      {isAdmin && (
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 font-semibold text-sm active:bg-gray-50 shadow-sm"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            {isHe ? 'ייבא מ-Excel' : 'Import Excel'}
          </button>
          <button
            onClick={() => setShowYachtness(v => !v)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 font-semibold text-sm active:bg-gray-50 shadow-sm"
          >
            ⚓ Yachtness
            {showYachtness ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelFile} />
        </div>
      )}

      {/* Yachtness panel */}
      <AnimatePresence>
        {showYachtness && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚓</span>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Yachtness Store</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isHe ? 'חנות יאכטות — משלוח ללפקס מרינה' : 'Yacht supplies — delivery to Lefkas Marina'}
                  </p>
                </div>
              </div>
              <a
                href="https://store.yachtness.com/en/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700"
              >
                <ExternalLink size={15} />
                {isHe ? 'פתח חנות' : 'Open Store'}
              </a>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700 font-medium">
                  {isHe
                    ? 'אחרי ביצוע ההזמנה — קדימה לכרטיסיית ההוצאות והוסף את עלות ההזמנה כהוצאה בקטגוריה "שירותי יאכטה"'
                    : 'After ordering — go to Expenses and add the order total as a "Yacht Services" expense'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Excel preview modal */}
      <Modal open={!!previewItems} onClose={() => setPreviewItems(null)} title={isHe ? 'תצוגה מקדימה' : 'Preview'}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {isHe ? `נמצאו ${previewItems?.length} פריטים. לייבא?` : `Found ${previewItems?.length} items. Import?`}
          </p>
          <div className="max-h-60 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
            {previewItems?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1 px-2 rounded-lg hover:bg-gray-50">
                <span className="text-gray-800 font-medium">{item.name}</span>
                <span className="text-gray-400">{item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setPreviewItems(null)}
              className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50">
              {t('cancel')}
            </button>
            <button onClick={confirmImport} disabled={importing}
              className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 disabled:opacity-40">
              {importing ? '...' : (isHe ? 'ייבא' : 'Import')}
            </button>
          </div>
        </div>
      </Modal>

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

      {/* Empty */}
      {shoppingItems.length === 0 && !previewItems && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-6xl mb-4">🛒</span>
          <p className="text-gray-400 font-semibold">{t('noItems')}</p>
          <p className="text-gray-300 text-sm mt-1">{isHe ? 'ייבא מ-Excel או הוסף ידנית' : 'Import from Excel or add manually'}</p>
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
                <motion.div key={item.id} layout exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 px-4 py-3.5">
                  <button onClick={() => toggleItem(item)}
                    className="text-gray-300 active:text-blue-500 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <Square size={24} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.quantity && <p className="text-sm text-gray-400 mt-0.5">{item.quantity}</p>}
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteItem(item.id)}
                      className="text-gray-200 active:text-red-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0">
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
                {isAdmin && (
                  <button onClick={() => deleteItem(item.id)}
                    className="text-gray-200 active:text-red-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <Trash2 size={16} />
                  </button>
                )}
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

      {/* Add button */}
      {isAdmin && (
        <div className="pb-2">
          <button onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 font-semibold text-sm bg-blue-50 active:bg-blue-100 transition-colors">
            <Plus size={18} />
            {isHe ? 'הוסף פריט' : 'Add Item'}
          </button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('addItem')}>
        <div className="space-y-4">
          <input
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white placeholder-gray-300"
            placeholder={`${t('itemName')} *`} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          <input
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white placeholder-gray-300"
            placeholder={t('quantity')} value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          <select
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
            value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
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
