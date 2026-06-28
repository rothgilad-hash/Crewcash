import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency } from '../lib/calculations'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Plus, Star, Trash2, Pencil } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export default function Participants() {
  const { t } = useTranslation()
  const { trip, participants, expenses, isAdmin, lang } = useApp()
  const [addOpen, setAddOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(null)
  const [form, setForm] = useState({ name: '', is_gil: false, joined_late: false })
  const [payAmount, setPayAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const isHe = lang === 'he'

  const balances = calculateBalances(expenses, participants)

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('participants').insert({
      trip_id: trip.id,
      name: form.name.trim(),
      is_gil: form.is_gil,
      joined_late: form.joined_late,
      amount_paid: 0
    })
    setForm({ name: '', is_gil: false, joined_late: false })
    setAddOpen(false)
    setSaving(false)
  }

  const handleDelete = async (id, name) => {
    const msg = isHe ? `למחוק את ${name}?` : `Delete ${name}?`
    if (!window.confirm(msg)) return
    await supabase.from('participants').delete().eq('id', id)
  }

  const openPay = (p) => {
    setPayOpen(p.id)
    setPayAmount((p.amount_paid || 0).toString())
  }

  const handleSavePayment = async () => {
    if (!payOpen) return
    setSaving(true)
    await supabase.from('participants').update({ amount_paid: parseFloat(payAmount) || 0 }).eq('id', payOpen)
    setPayAmount('')
    setPayOpen(null)
    setSaving(false)
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
            const b = balances[p.id] || { owes: 0 }
            const paid = p.amount_paid || 0
            const remaining = Math.round((b.owes - paid) * 100) / 100
            const kittyOwes = remaining < -0.5
            const settled = !kittyOwes && remaining <= 0.5
            const color = COLORS[i % COLORS.length]

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
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
                      <p className="text-sm text-gray-400 mt-0.5">
                        {isHe ? `שילם ${formatCurrency(paid, 'EUR')}` : `Paid ${formatCurrency(paid, 'EUR')}`}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-red-500 mt-0.5">
                        {isHe ? 'נשאר לשלם' : 'Remaining'} {formatCurrency(remaining, 'EUR')}
                        {paid > 0 && (
                          <span className="text-gray-400 font-normal text-xs ms-1.5">
                            ({isHe ? `שילם ${formatCurrency(paid, 'EUR')}` : `paid ${formatCurrency(paid, 'EUR')}`})
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isAdmin && !kittyOwes && (
                      <button
                        onClick={() => openPay(p)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-colors bg-blue-50 border border-blue-200 text-blue-600 active:bg-blue-100"
                      >
                        <Pencil size={12} />
                        {settled ? (isHe ? 'ערוך' : 'Edit') : (isHe ? '+ תשלום' : '+ Pay')}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 active:text-red-400 active:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      )}

      {isAdmin && (
        <div className="pb-2">
          <button
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 font-semibold text-sm bg-blue-50 active:bg-blue-100 transition-colors"
          >
            <Plus size={18} />
            {isHe ? 'הוסף משתתף' : 'Add Participant'}
          </button>
        </div>
      )}

      {/* Add participant modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addParticipant')}>
        <div className="space-y-4">
          <input
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white placeholder-gray-300"
            placeholder={`${t('participantName')} *`}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <label className="flex items-center justify-between py-4 px-4 bg-amber-50 border border-amber-200 rounded-2xl cursor-pointer active:bg-amber-100 transition-colors">
            <div>
              <p className="font-semibold text-gray-800 text-sm">⭐ {t('isGil')}</p>
              <p className="text-gray-400 text-xs mt-0.5">{isHe ? 'ישלם פי 2 על עלות היאכטה' : 'Pays 2x for yacht cost'}</p>
            </div>
            <div className="relative ms-3 flex-shrink-0">
              <input type="checkbox" className="sr-only" checked={form.is_gil}
                onChange={e => setForm(f => ({ ...f, is_gil: e.target.checked }))} />
              <div className={`w-11 h-6 rounded-full transition-colors ${form.is_gil ? 'bg-amber-400' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_gil ? 'translate-x-5' : ''}`} />
            </div>
          </label>
          <label className="flex items-center justify-between py-4 px-4 bg-orange-50 border border-orange-200 rounded-2xl cursor-pointer active:bg-orange-100 transition-colors">
            <div>
              <p className="font-semibold text-gray-800 text-sm">⏰ {isHe ? 'הצטרף מאוחר' : 'Late joiner'}</p>
              <p className="text-gray-400 text-xs mt-0.5">{isHe ? 'חייב גם חלקו ביאכטה דרך הקופה' : 'Owes yacht share through economist'}</p>
            </div>
            <div className="relative ms-3 flex-shrink-0">
              <input type="checkbox" className="sr-only" checked={form.joined_late}
                onChange={e => setForm(f => ({ ...f, joined_late: e.target.checked }))} />
              <div className={`w-11 h-6 rounded-full transition-colors ${form.joined_late ? 'bg-orange-400' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.joined_late ? 'translate-x-5' : ''}`} />
            </div>
          </label>
          <div className="flex gap-3">
            <button onClick={() => setAddOpen(false)}
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

      {/* Payment modal */}
      <Modal open={!!payOpen} onClose={() => setPayOpen(null)} title={isHe ? 'עדכון תשלום' : 'Update Payment'}>
        <div className="space-y-4">
          {payOpen && (() => {
            const p = participants.find(x => x.id === payOpen)
            const b = balances[payOpen] || { owes: 0 }
            const remaining = Math.round(((b.owes || 0) - (p?.amount_paid || 0)) * 100) / 100
            return (
              <div className="bg-gray-50 rounded-2xl px-4 py-3">
                <p className="text-sm text-gray-500">{p?.name}</p>
                <p className="text-base font-bold text-red-500">
                  {isHe ? 'נשאר לשלם' : 'Remaining'}: {formatCurrency(Math.max(remaining, 0), 'EUR')}
                </p>
              </div>
            )
          })()}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isHe ? 'סה"כ שילם עד עכשיו (EUR)' : 'Total paid so far (EUR)'}
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
              placeholder="0"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setPayOpen(null)}
              className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50">
              {t('cancel')}
            </button>
            <button onClick={handleSavePayment} disabled={saving}
              className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 disabled:opacity-40">
              {saving ? '...' : t('save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
