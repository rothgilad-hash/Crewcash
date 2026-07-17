import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Plus, Trash2, CheckSquare2, Square, FileSpreadsheet, ExternalLink, ChevronDown, ChevronUp, ShoppingCart, Users, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'

const CATS = [
  { key: 'drinks',      he: '🥤 שתייה',      en: '🥤 Drinks' },
  { key: 'alcohol',     he: '🍷 אלכוהול',    en: '🍷 Alcohol' },
  { key: 'fruit',       he: '🍎 פירות',       en: '🍎 Fruit' },
  { key: 'vegetables',  he: '🥦 ירקות',       en: '🥦 Vegetables' },
  { key: 'pantry',      he: '🫙 קשות',        en: '🫙 Pantry' },
  { key: 'dairy',       he: '🧀 חלבי',        en: '🧀 Dairy' },
  { key: 'deli',        he: '🥩 בשרי',        en: '🥩 Deli' },
  { key: 'disposables', he: '🥡 חד פעמי',    en: '🥡 Disposables' },
  { key: 'cleaning',    he: '🧹 ניקיון',      en: '🧹 Cleaning' },
  { key: 'hygiene',     he: '🧴 היגיינה',     en: '🧴 Hygiene' },
  { key: 'snacks',      he: '🍿 חטיפים',      en: '🍿 Snacks' },
  { key: 'other',       he: '📦 אחר',         en: '📦 Other' },
]

const CAT_MAP = {
  'שתייה': 'drinks', 'שתיה': 'drinks', 'drinks': 'drinks',
  'אלכוהול': 'alcohol', 'alcohol': 'alcohol',
  'פירות': 'fruit', 'fruit': 'fruit',
  'ירקות': 'vegetables', 'vegetables': 'vegetables',
  'קשות': 'pantry', 'pantry': 'pantry', 'אוכל': 'pantry', 'food': 'pantry',
  'חלבי': 'dairy', 'dairy': 'dairy',
  'בשרי': 'deli', 'דלי': 'deli', 'deli': 'deli',
  'חד פעמי': 'disposables', 'disposables': 'disposables',
  'ניקיון': 'cleaning', 'cleaning': 'cleaning',
  'היגיינה': 'hygiene', 'hygiene': 'hygiene',
  'חטיפים': 'snacks', 'snacks': 'snacks',
  'אחר': 'other', 'other': 'other',
}

// Keyword-based auto-categorization for Excel imports without category column
const KEYWORD_CATS = {
  drinks:      ['מים','זירו','סודה','מיץ','קולה','ספרייט','אייסטי','רד בול','אנרגי'],
  alcohol:     ['בירה','רדלר','יין','אפרול','פרוסקו','אוזו','ויסקי','וודקה','טקילה','ספריץ','קמפרי','ג\'ין','רום','בייליס','לימונצ\'לו'],
  fruit:       ['אגס','לימון','אבטיח','מלון','תפוח','בננ','אננס','ענב','תות','אפרסק','שזיף','מנגו','קיווי','פירות'],
  vegetables:  ['בצל','עגבני','מלפפון','פלפל','גזר','קישוא','חציל','שום','כרוב','חסה','עגבניות','ירק'],
  pantry:      ['לחם','טונה','עלי גפן','מיונז','גרנולה','מלפפונים חמוצים','זיתים','מוטי','אורז','פסטה','ממרח','דייסה','קמח','מלח','סוכר','שמן','דבש','רוטב','גריסים','קוסקוס','חומוס','טחינה','סרדינים','קפה','תה','שוקולד'],
  dairy:       ['יוגרט','גאודה','גבינ','חלב','ביצ','חמאה','נס קפה','פילדפליה','ציזיקי','שמנת','קוטג','לבנה'],
  deli:        ['סלמי','סלמון','נקניק','שניצל','גיקה','פסטרמה','חזה עוף','קבב','המבורגר','נקניקי'],
  disposables: ['צלחת','כוס','מגש','אלומיניום','חד פעמי','קש','מפית','כפית','מזלג','סכין'],
  cleaning:    ['נייר טואלט','סקווצ','שקית זבל','סבון כלים','סמרטוט','אטבי','כביסה','ספוג','אקונומיקה','נייר מגבת'],
  hygiene:     ['שמפו','סבון','משחת שיניים','קרם הגנה','דאודורנט','גילוח','קרם','טמפון','פד'],
  snacks:      ['תפוצ','קפריס','עוגי','בייגל','פצפוצ','אגוז','בוטנ','חטיף','ביסלי','במבה'],
}

function autoDetectCat(name) {
  const n = name.toLowerCase()
  for (const [cat, kws] of Object.entries(KEYWORD_CATS)) {
    if (kws.some(kw => n.includes(kw.toLowerCase()))) return cat
  }
  return 'other'
}

export default function Shopping() {
  const { t } = useTranslation()
  const { trip, participants, shoppingItems, isAdmin, lang, reloadShoppingItems, reloadExpenses } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', quantity: '', category: 'other' })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showYachtness, setShowYachtness] = useState(false)
  const [previewItems, setPreviewItems] = useState(null)
  const [collapsedCats, setCollapsedCats] = useState(() => new Set(CATS.map(c => c.key)))
  const [costModal, setCostModal] = useState({ open: false, source: 'shopping', amount: '', is_cash: true })
  const [savingCost, setSavingCost] = useState(false)
  const [supermarketTeam, setSupermarketTeam] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`crewcash_superteam_${trip?.id}`) || '[]')) }
    catch { return new Set() }
  })
  const [showTeamPanel, setShowTeamPanel] = useState(false)
  const [copiedPid, setCopiedPid] = useState(null)
  const [showRemaining, setShowRemaining] = useState(false)
  const fileRef = useRef(null)
  const isHe = lang === 'he'

  const toggleCat = (key) => setCollapsedCats(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const toggleItem = async (item) => {
    await supabase.from('shopping_items').update({ checked: !item.checked }).eq('id', item.id)
    reloadShoppingItems(trip.id)
  }
  const deleteItem = async (id) => {
    await supabase.from('shopping_items').delete().eq('id', id)
    reloadShoppingItems(trip.id)
  }

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('shopping_items').insert({ trip_id: trip.id, ...form })
    reloadShoppingItems(trip.id)
    setForm({ name: '', quantity: '', category: 'other' })
    setModalOpen(false)
    setSaving(false)
  }

  const clearChecked = async () => {
    const ids = shoppingItems.filter(i => i.checked).map(i => i.id)
    if (ids.length) {
      await supabase.from('shopping_items').delete().in('id', ids)
      reloadShoppingItems(trip.id)
    }
  }

  const handleExcelFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).filter(r => r.some(c => c))

      const first = rows[0]?.map(c => String(c || '').trim())
      const firstLower = first?.map(c => c.toLowerCase())
      const NAME_HEADERS = ['name','שם','פריט','item','מוצר','product']
      const QTY_HEADERS  = ['quantity','כמות','qty','amount']
      const CAT_HEADERS  = ['category','קטגוריה','cat','קט']

      const hasHeader = firstLower?.some(c => [...NAME_HEADERS,...QTY_HEADERS].includes(c))
      const dataRows = hasHeader ? rows.slice(1) : rows

      const findIdx = (headers) => {
        if (!hasHeader) return -1
        const i = firstLower.findIndex(c => headers.includes(c))
        return i
      }
      const nameIdx = findIdx(NAME_HEADERS) !== -1 ? findIdx(NAME_HEADERS) : 0
      const qtyIdx  = findIdx(QTY_HEADERS)  !== -1 ? findIdx(QTY_HEADERS)  : 1
      const catIdx  = findIdx(CAT_HEADERS)

      const parsed = dataRows
        .filter(r => r[nameIdx] && String(r[nameIdx]).trim())
        .map(r => {
          const name = String(r[nameIdx] || '').trim()
          const rawCat = catIdx >= 0 ? String(r[catIdx] || '').trim() : ''
          const category = CAT_MAP[rawCat] || autoDetectCat(name)
          return {
            name,
            quantity: String(r[qtyIdx] ?? '').trim(),
            category,
          }
        })

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
    reloadShoppingItems(trip.id)
    setPreviewItems(null)
    setImporting(false)
  }

  const openCostModal = (source) => {
    setCostModal({ open: true, source, amount: '', is_cash: true })
  }

  const saveCostExpense = async () => {
    const amt = parseFloat(costModal.amount)
    if (!amt || amt <= 0) return
    setSavingCost(true)

    const isYachtness = costModal.source === 'yachtness'
    const gilPart = participants.find(p => p.is_gil)

    const { error } = await supabase.from('expenses').insert({
      trip_id: trip.id,
      description: isYachtness
        ? (isHe ? 'הזמנת Yachtness' : 'Yachtness Order')
        : (isHe ? 'קניות ראשוניות' : 'Initial Shopping'),
      amount: amt,
      currency: 'EUR',
      category: isYachtness ? 'yacht_services' : 'supermarket',
      is_cash: costModal.is_cash,
      is_paid: true,
      is_yacht_cost: false,
      paid_by: gilPart?.id || null,
    })

    if (!error) {
      reloadExpenses(trip.id)
      setCostModal({ open: false, source: 'shopping', amount: '', is_cash: true })
    } else {
      alert(error.message)
    }
    setSavingCost(false)
  }

  const toggleTeamMember = (pid) => {
    setSupermarketTeam(prev => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      localStorage.setItem(`crewcash_superteam_${trip.id}`, JSON.stringify([...next]))
      return next
    })
  }

  const unchecked = shoppingItems.filter(i => !i.checked)
  const checked = shoppingItems.filter(i => i.checked)
  const grouped = CATS.map(cat => ({ ...cat, items: unchecked.filter(i => i.category === cat.key) })).filter(g => g.items.length > 0)
  const uncat = unchecked.filter(i => !CATS.find(c => c.key === i.category))

  // Supermarket team assignments — greedy by item count for fairness
  const gilId = participants.find(p => p.is_gil)?.id
  const teamList = [...supermarketTeam]
  const sortedTeam = gilId && teamList.includes(gilId)
    ? [gilId, ...teamList.filter(id => id !== gilId)]
    : teamList
  // Sort categories largest-first so greedy works well
  const activeCatsWithCount = CATS
    .filter(c => unchecked.some(i => i.category === c.key))
    .map(c => ({ key: c.key, count: unchecked.filter(i => i.category === c.key).length }))
    .sort((a, b) => b.count - a.count)
  const activeCatKeys = activeCatsWithCount.map(c => c.key)
  const catAssignments = {}
  const teamLoad = {} // pid -> total item count assigned
  if (sortedTeam.length > 0) {
    sortedTeam.forEach(id => { catAssignments[id] = []; teamLoad[id] = 0 })
    activeCatsWithCount.forEach(({ key, count }) => {
      // Give this category to whoever has fewest items so far
      const minPid = sortedTeam.reduce((best, pid) =>
        teamLoad[pid] < teamLoad[best] ? pid : best
      , sortedTeam[0])
      catAssignments[minPid].push(key)
      teamLoad[minPid] += count
    })
  }

  const buildCopyText = (pid) => {
    const p = participants.find(x => x.id === pid)
    const cats = catAssignments[pid] || []
    const sections = cats.map(key => {
      const cat = CATS.find(c => c.key === key)
      const items = unchecked.filter(i => i.category === key)
      const itemLines = items.map(i => `  • ${i.name}${i.quantity ? ' (' + i.quantity + ')' : ''}`).join('\n')
      return `${cat?.he || key}:\n${itemLines}`
    })
    return `${p?.name}, הקטגוריות שלך בקניות 🛒\n\n${sections.join('\n\n')}`
  }

  const copyAssignment = (pid) => {
    navigator.clipboard.writeText(buildCopyText(pid))
    setCopiedPid(pid)
    setTimeout(() => setCopiedPid(null), 2000)
  }

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

      {/* Supermarket team button */}
      {isAdmin && participants.length > 0 && (
        <button
          onClick={() => setShowTeamPanel(v => !v)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 font-semibold text-sm active:bg-gray-50 shadow-sm"
        >
          <Users size={16} className="text-purple-500" />
          {isHe ? 'צוות סופר' : 'Shopping Team'}
          {supermarketTeam.size > 0 && (
            <span className="bg-purple-100 text-purple-600 text-xs font-bold px-2 py-0.5 rounded-full">{supermarketTeam.size}</span>
          )}
          {showTeamPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}

      {/* Team panel */}
      <AnimatePresence>
        {showTeamPanel && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
              <p className="text-xs font-semibold text-gray-500">{isHe ? 'סמן מי יוצא לקנות:' : 'Mark who is shopping:'}</p>
              <div className="flex flex-wrap gap-2">
                {participants.map(p => (
                  <button key={p.id} onClick={() => toggleTeamMember(p.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                      supermarketTeam.has(p.id)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}>
                    {p.name}{p.is_gil ? ' ⭐' : ''}
                  </button>
                ))}
              </div>
              {sortedTeam.length > 0 && activeCatKeys.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500">{isHe ? 'חלוקת קטגוריות:' : 'Category assignments:'}</p>
                  {sortedTeam.map(pid => {
                    const p = participants.find(x => x.id === pid)
                    const cats = catAssignments[pid] || []
                    return (
                      <div key={pid} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 mb-1">{p?.name}{p?.is_gil ? ' ⭐' : ''}</p>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {cats.map(key => CATS.find(c => c.key === key)?.he || key).join(' · ')}
                          </p>
                        </div>
                        <button onClick={() => copyAssignment(pid)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
                            copiedPid === pid ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-100 text-purple-600 active:bg-purple-200'
                          }`}>
                          {copiedPid === pid ? <Check size={12} /> : <Copy size={12} />}
                          {copiedPid === pid ? (isHe ? 'הועתק' : 'Copied') : (isHe ? 'העתק' : 'Copy')}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enter shopping cost button */}
      {isAdmin && shoppingItems.length > 0 && (
        <button
          onClick={() => openCostModal('shopping')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-sm active:bg-emerald-700 shadow-sm"
        >
          <ShoppingCart size={16} />
          {isHe ? 'הזן עלות קניות' : 'Enter Shopping Cost'}
        </button>
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
              {isAdmin && (
                <button
                  onClick={() => openCostModal('yachtness')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm active:bg-emerald-700"
                >
                  <ShoppingCart size={15} />
                  {isHe ? 'הזן עלות הזמנה' : 'Enter Order Cost'}
                </button>
              )}
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
              <div key={i} className="flex justify-between items-center text-sm py-1 px-2 rounded-lg hover:bg-gray-50">
                <span className="text-gray-800 font-medium">{item.name}</span>
                <div className="flex items-center gap-2">
                  {item.quantity && <span className="text-gray-400">{item.quantity}</span>}
                  <span className="text-xs text-gray-300">{CATS.find(c => c.key === item.category)?.[isHe ? 'he' : 'en'] || item.category}</span>
                </div>
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

      {/* Cost expense modal */}
      <Modal
        open={costModal.open}
        onClose={() => setCostModal(m => ({ ...m, open: false }))}
        title={costModal.source === 'yachtness'
          ? (isHe ? 'עלות הזמנת Yachtness' : 'Yachtness Order Cost')
          : (isHe ? 'עלות קניות' : 'Shopping Cost')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {costModal.source === 'yachtness'
              ? (isHe ? 'הזן את סכום ההזמנה. יירשם כהוצאה בקטגוריה "שירותי יאכטה".' : 'Enter the order total. Will be recorded as a "Yacht Services" expense.')
              : (isHe ? 'הזן את הסכום הסופי ששולם. יירשם כהוצאה בקטגוריה "סופרמרקט".' : 'Enter the total paid. Will be recorded as a "Supermarket" expense.')}
          </p>
          <div className="relative">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">€</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 pr-10 focus:outline-none focus:border-blue-500 text-gray-900 bg-white text-lg font-bold"
              value={costModal.amount}
              onChange={e => setCostModal(m => ({ ...m, amount: e.target.value }))}
              autoFocus
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setCostModal(m => ({ ...m, is_cash: !m.is_cash }))}
              className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${costModal.is_cash ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${costModal.is_cash ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {isHe ? 'שולם במזומן מהקופה' : 'Paid in cash from kitty'}
            </span>
          </label>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setCostModal(m => ({ ...m, open: false }))}
              className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50">
              {t('cancel')}
            </button>
            <button onClick={saveCostExpense} disabled={savingCost || !costModal.amount}
              className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-bold active:bg-emerald-700 disabled:opacity-40">
              {savingCost ? '...' : (isHe ? 'שמור הוצאה' : 'Save Expense')}
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

      {/* Grouped unchecked — collapsible categories */}
      {grouped.map(group => (
        <div key={group.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => toggleCat(group.key)}
            className="w-full px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between active:bg-gray-100"
          >
            <p className="font-bold text-gray-700 text-sm">{isHe ? group.he : group.en}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{group.items.length}</span>
              {collapsedCats.has(group.key) ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
            </div>
          </button>
          <AnimatePresence>
            {!collapsedCats.has(group.key) && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Uncategorized */}
      {uncat.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <p className="font-bold text-gray-700 text-sm">📦 {isHe ? 'אחר' : 'Other'}</p>
            <span className="text-xs text-gray-400">{uncat.length}</span>
          </div>
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

      {/* נותר לרכישה — flat view of all unchecked */}
      {unchecked.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
          <button
            onClick={() => setShowRemaining(v => !v)}
            className="w-full px-4 py-3 bg-orange-50 flex items-center justify-between active:bg-orange-100"
          >
            <p className="font-bold text-orange-700 text-sm">📋 {isHe ? 'נותר לרכישה' : 'Remaining'}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-orange-500">{unchecked.length}</span>
              {showRemaining ? <ChevronUp size={14} className="text-orange-400" /> : <ChevronDown size={14} className="text-orange-400" />}
            </div>
          </button>
          <AnimatePresence>
            {showRemaining && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {unchecked.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{item.name}</p>
                        {item.quantity && <p className="text-xs text-gray-400">{item.quantity}</p>}
                      </div>
                      <span className="text-xs text-gray-300">
                        {CATS.find(c => c.key === item.category)?.[isHe ? 'he' : 'en'] || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
