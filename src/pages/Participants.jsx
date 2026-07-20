import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency, getCollectedAmount } from '../lib/calculations'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Plus, Star, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
const ROUND_NAMES_HE = ['גיוס ראשון', 'גיוס שני', 'גיוס שלישי', 'גיוס רביעי', 'גיוס חמישי']
const ROUND_NAMES_EN = ['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5']

export default function Participants() {
  const { t } = useTranslation()
  const { trip, participants, expenses, kittyRefunds, kittyCollections, isAdmin, lang, reloadCollections } = useApp()
  const [addOpen, setAddOpen] = useState(false)
  const [collectOpen, setCollectOpen] = useState(null)
  const [form, setForm] = useState({ name: '', is_gil: false, joined_late: false })
  const [collectAmount, setCollectAmount] = useState('')
  const [collectRound, setCollectRound] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedPid, setExpandedPid] = useState(null)
  const isHe = lang === 'he'

  const balances = calculateBalances(expenses, participants)

  const getKittyPaidBack = (pid) => {
    const fromTable = kittyRefunds.filter(r => r.participant_id === pid).reduce((s, r) => s + r.amount, 0)
    const p = participants.find(x => x.id === pid)
    return fromTable > 0 ? fromTable : (p?.kitty_paid_back || 0)
  }

  const openCollect = (p) => {
    const existing = kittyCollections.filter(c => c.participant_id === p.id)
    const names = isHe ? ROUND_NAMES_HE : ROUND_NAMES_EN
    const nextName = names[existing.length] || (isHe ? `גיוס ${existing.length + 1}` : `Round ${existing.length + 1}`)
    setCollectRound(nextName)
    setCollectAmount('')
    setCollectOpen(p.id)
  }

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('participants').insert({
      trip_id: trip.id, name: form.name.trim(),
      is_gil: form.is_gil, joined_late: form.joined_late, amount_paid: 0
    })
    setForm({ name: '', is_gil: false, joined_late: false })
    setAddOpen(false)
    setSaving(false)
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(isHe ? `למחוק את ${name}?` : `Delete ${name}?`)) return
    await supabase.from('participants').delete().eq('id', id)
  }

  const handleSaveCollection = async () => {
    const amt = parseFloat(collectAmount)
    if (!amt || !collectOpen) return
    setSaving(true)
    const { error } = await supabase.from('kitty_collections').insert({
      participant_id: collectOpen,
      amount: amt,
      round_name: collectRound.trim() || (isHe ? 'גיוס' : 'Round')
    })
    if (error) {
      alert('שגיאה: ' + error.message)
      setSaving(false)
      return
    }
    reloadCollections(participants.map(x => x.id))
    setCollectOpen(null)
    setCollectAmount('')
    setSaving(false)
  }

  }

  return (
    <div className="p-4 space-y-3">
      {participants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-6xl mb-4">👥</span>
          <p className="text-gray-400 font-semibold text-lg">{t('noParticipants')}</p>
          {isAdmin && <p className="text-gray-300 text-sm mt-1">{isHe ? 'הוסף את חברי הצוות' : 'Add your crew members'}</p>}
        </div>
      ) : (
        <AnimatePresence>
          {participants.map((p, i) => {
            const b = balances[p.id] || { owes: 0, paid: 0 }
            const totalCollected = getCollectedAmount(kittyCollections, p.id, p)
            const kittyPaidBack = getKittyPaidBack(p.id)
            const remaining = Math.round((b.owes - totalCollected - b.paid + kittyPaidBack) * 100) / 100
            // Kitty only owes if person paid personal expenses
            const kittyOwes = remaining < -0.5 && b.paid > 0
            const settled = !kittyOwes && remaining <= 0.5
            const color = COLORS[i % COLORS.length]
            const myCollections = kittyCollections.filter(c => c.participant_id === p.id)
            const isExpanded = expandedPid === p.id

            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ delay: i * 0.04 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Main row */}
                <div className="p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ backgroundColor: color }}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-gray-900 text-base">{p.name}</p>
                      {p.is_gil && <Star size={14} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                      {p.joined_late && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">⏰</span>}
                    </div>
                    {kittyOwes ? (
                      <p className="text-sm font-semibold text-emerald-500 mt-0.5">
                        {isHe ? 'הקופה חייבת לך' : 'Kitty owes you'} {formatCurrency(Math.abs(remaining), 'EUR')}
                      </p>
                    ) : settled ? (
                      <p className="text-sm font-semibold text-emerald-500 mt-0.5">{isHe ? 'אין חובות ✓' : 'No debts ✓'}</p>
                    ) : (
                      <p className="text-sm font-semibold text-red-500 mt-0.5">
                        {isHe ? 'נשאר לשלם' : 'Remaining'} {formatCurrency(remaining, 'EUR')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isAdmin && (
                      <button onClick={() => openCollect(p)}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-600 active:bg-blue-100">
                        💰 {isHe ? 'גיוס' : 'Collect'}
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleDelete(p.id, p.name)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 active:text-red-400 active:bg-red-50">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Collections breakdown (collapsible) */}
                {myCollections.length > 0 && (
                  <>
                    <button
                      onClick={() => setExpandedPid(isExpanded ? null : p.id)}
                      className="w-full flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50 active:bg-gray-100 text-xs text-gray-500 font-semibold"
                    >
                      <span>💰 {isHe ? `סה״כ גויס: ${formatCurrency(totalCollected, 'EUR')}` : `Total collected: ${formatCurrency(totalCollected, 'EUR')}`}</span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 space-y-1 border-t border-gray-100">
                        {myCollections.map(c => (
                          <div key={c.id} className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">{c.round_name}</span>
                            <span className="font-semibold text-gray-800">{formatCurrency(c.amount, 'EUR')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      )}

      {isAdmin && (
        <div className="pb-2">
          <button onClick={() => setAddOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 font-semibold text-sm bg-blue-50 active:bg-blue-100">
            <Plus size={18} />{isHe ? 'הוסף משתתף' : 'Add Participant'}
          </button>
        </div>
      )}

      {/* Add participant modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addParticipant')}>
        <div className="space-y-4">
          <input className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white placeholder-gray-300"
            placeholder={`${t('participantName')} *`} value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          <label className="flex items-center justify-between py-4 px-4 bg-amber-50 border border-amber-200 rounded-2xl cursor-pointer active:bg-amber-100">
            <div>
              <p className="font-semibold text-gray-800 text-sm">⭐ {t('isGil')}</p>
              <p className="text-gray-400 text-xs mt-0.5">{isHe ? 'ישלם פי 2 על עלות היאכטה' : 'Pays 2x for yacht cost'}</p>
            </div>
            <div className="relative ms-3 flex-shrink-0">
              <input type="checkbox" className="sr-only" checked={form.is_gil} onChange={e => setForm(f => ({ ...f, is_gil: e.target.checked }))} />
              <div className={`w-11 h-6 rounded-full transition-colors ${form.is_gil ? 'bg-amber-400' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_gil ? 'translate-x-5' : ''}`} />
            </div>
          </label>
          <label className="flex items-center justify-between py-4 px-4 bg-orange-50 border border-orange-200 rounded-2xl cursor-pointer active:bg-orange-100">
            <div>
              <p className="font-semibold text-gray-800 text-sm">⏰ {isHe ? 'הצטרף מאוחר' : 'Late joiner'}</p>
              <p className="text-gray-400 text-xs mt-0.5">{isHe ? 'חייב גם חלקו ביאכטה דרך הקופה' : 'Owes yacht share through economist'}</p>
            </div>
            <div className="relative ms-3 flex-shrink-0">
              <input type="checkbox" className="sr-only" checked={form.joined_late} onChange={e => setForm(f => ({ ...f, joined_late: e.target.checked }))} />
              <div className={`w-11 h-6 rounded-full transition-colors ${form.joined_late ? 'bg-orange-400' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.joined_late ? 'translate-x-5' : ''}`} />
            </div>
          </label>
          <div className="flex gap-3">
            <button onClick={() => setAddOpen(false)} className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50">{t('cancel')}</button>
            <button onClick={handleAdd} disabled={saving || !form.name.trim()} className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 disabled:opacity-40">{saving ? '...' : t('save')}</button>
          </div>
        </div>
      </Modal>

      {/* Collect modal */}
      <Modal open={!!collectOpen} onClose={() => setCollectOpen(null)}
        title={isHe ? 'הוסף גיוס' : 'Add Collection'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{isHe ? 'שם הגיוס' : 'Round name'}</label>
            <input
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
              value={collectRound} onChange={e => setCollectRound(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{isHe ? 'סכום (EUR)' : 'Amount (EUR)'}</label>
            <input type="number" inputMode="decimal"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
              placeholder="0" value={collectAmount} onChange={e => setCollectAmount(e.target.value)} autoFocus />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCollectOpen(null)} className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50">{t('cancel')}</button>
            <button onClick={handleSaveCollection} disabled={saving || !collectAmount} className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 disabled:opacity-40">{saving ? '...' : t('save')}</button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
