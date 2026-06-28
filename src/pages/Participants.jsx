import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency } from '../lib/calculations'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Plus, Star, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export default function Participants() {
  const { t } = useTranslation()
  const { trip, participants, expenses, isAdmin, lang } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', is_gil: false, joined_late: false })
  const [saving, setSaving] = useState(false)
  const isHe = lang === 'he'

  const balances = calculateBalances(expenses, participants)

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('participants').insert({ trip_id: trip.id, name: form.name.trim(), is_gil: form.is_gil, joined_late: form.joined_late })
    setForm({ name: '', is_gil: false, joined_late: false })
    setModalOpen(false)
    setSaving(false)
  }

  const handleDelete = async (id, name) => {
    const msg = isHe ? `למחוק את ${name}?` : `Delete ${name}?`
    if (!window.confirm(msg)) return
    await supabase.from('participants').delete().eq('id', id)
  }

  const togglePaid = async (id, current) => {
    await supabase.from('participants').update({ has_paid_economist: !current }).eq('id', id)
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
            const b = balances[p.id] || { paid: 0, owes: 0, net: 0 }
            const isPos = b.net >= 0
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
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {p.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <p className="font-bold text-gray-900 text-base">{p.name}</p>
                      {p.is_gil && <Star size={15} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                      {p.joined_late && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">⏰ {isHe ? 'מאוחר' : 'late'}</span>}
                    </div>
                    <div className="flex gap-3 text-sm">
                      <div className="bg-emerald-50 rounded-xl px-2.5 py-1">
                        <span className="text-emerald-600 font-semibold">{formatCurrency(b.paid, 'EUR')}</span>
                        <span className="text-gray-400 text-xs ms-1">{isHe ? 'שילם' : 'paid'}</span>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-2.5 py-1">
                        <span className="text-gray-700 font-semibold">{formatCurrency(b.owes, 'EUR')}</span>
                        <span className="text-gray-400 text-xs ms-1">{isHe ? 'חייב' : 'owes'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net + actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className={`text-lg font-black ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isPos ? '+' : ''}{formatCurrency(b.net, 'EUR')}
                    </p>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <button
                          onClick={() => togglePaid(p.id, p.has_paid_economist)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors ${
                            p.has_paid_economist
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-gray-100 text-gray-400 active:bg-gray-200'
                          }`}
                        >
                          {p.has_paid_economist
                            ? <><CheckCircle2 size={13} /> {isHe ? 'שילם' : 'Paid'}</>
                            : <><Circle size={13} /> {isHe ? 'טרם שילם' : 'Pending'}</>
                          }
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
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('addParticipant')}>
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
