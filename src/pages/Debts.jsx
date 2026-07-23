import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency, getCollectedAmount, getCollectionDebt, getCollectionOverpayment, getEurAmount, getExpenseDate, getLastCollectionDate, getPostCollectionNet } from '../lib/calculations'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import SignaturePad from '../components/SignaturePad'
import { motion } from 'framer-motion'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export default function Debts() {
  const { t } = useTranslation()
  const { participants, expenses, kittyRefunds, kittyCollections, isAdmin, lang, reloadRefunds, reloadCollections } = useApp()
  const isHe = lang === 'he'

  const [refundOpen, setRefundOpen] = useState(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [sigOpen, setSigOpen] = useState(false)
  const [sigTarget, setSigTarget] = useState(null)

  const [receivedOpen, setReceivedOpen] = useState(null)
  const [receivedAmount, setReceivedAmount] = useState('')
  const [receivedReason, setReceivedReason] = useState('יתרת גיוס')
  const [receivedDate, setReceivedDate] = useState('')

  const balances = calculateBalances(expenses, participants)

  const getKittyPaidBack = (pid) => {
    const fromTable = kittyRefunds.filter(r => r.participant_id === pid).reduce((s, r) => s + r.amount, 0)
    const p = participants.find(x => x.id === pid)
    return fromTable > 0 ? fromTable : (p?.kitty_paid_back || 0)
  }

  const getPrePersonalNet = (p) => {
    const lastDate = getLastCollectionDate(kittyCollections, p.id)
    const N = participants.length
    return expenses
      .filter(e => e.paid_by === p.id && !e.is_yacht_cost && (!lastDate || getExpenseDate(e) <= lastDate))
      .reduce((s, e) => s + getEurAmount(e) * (N - 1) / N, 0)
  }

  const getRemaining = (p) => {
    const hasCollections = kittyCollections.some(c => c.participant_id === p.id)
    if (hasCollections) {
      return Math.round(getCollectionDebt(kittyCollections, p.id) * 100) / 100
    }
    const b = balances[p.id] || { owes: 0, paid: 0 }
    const prePersonalNet = getPrePersonalNet(p)
    return Math.round((b.owes - prePersonalNet + getKittyPaidBack(p.id)) * 100) / 100
  }

  const getCollDebt = (p) => Math.round(getCollectionDebt(kittyCollections, p.id) * 100) / 100
  const getKittyOwedAmount = (p) => {
    const overpay = getCollectionOverpayment(kittyCollections, p.id)
    const lastDate = getLastCollectionDate(kittyCollections, p.id)
    const postNet = getPostCollectionNet(expenses, p.id, lastDate, participants.length)
    const refunded = getKittyPaidBack(p.id)
    return Math.round((overpay + postNet - refunded) * 100) / 100
  }

  const owesKitty = participants.filter(p => getRemaining(p) > 0.5)
  const kittyOwes = participants.filter(p => getKittyOwedAmount(p) > 0.5)

  const allSettled = owesKitty.length === 0 && kittyOwes.length === 0

  const openReceived = (p) => {
    setReceivedAmount(String(Math.abs(getRemaining(p))))
    setReceivedReason('יתרת גיוס')
    setReceivedDate(new Date().toISOString().slice(0, 10))
    setReceivedOpen(p)
  }

  const handleSaveReceived = async () => {
    if (!receivedOpen) return
    let remaining = parseFloat(receivedAmount) || 0
    setSaving(true)
    const shortfallRows = kittyCollections
      .filter(c => c.participant_id === receivedOpen.id && c.target_amount > c.amount)
      .sort((a, b) => (a.collected_at || '').localeCompare(b.collected_at || ''))
    for (const row of shortfallRows) {
      if (remaining <= 0) break
      const gap = row.target_amount - row.amount
      const toAdd = Math.min(gap, remaining)
      await supabase.from('kitty_collections')
        .update({ amount: row.amount + toAdd, round_name: receivedReason })
        .eq('id', row.id)
      remaining -= toAdd
    }
    reloadCollections(participants.map(x => x.id))
    setReceivedOpen(null)
    setReceivedAmount('')
    setSaving(false)
  }

  const openRefund = (p) => {
    setRefundAmount(String(Math.abs(getRemaining(p))))
    setRefundOpen(p)
  }

  const handleSaveRefund = async () => {
    if (!refundOpen) return
    const amt = parseFloat(refundAmount) || 0
    setSaving(true)
    const { data: refund } = await supabase.from('kitty_refunds')
      .insert({ participant_id: refundOpen.id, amount: amt })
      .select().single()
    reloadRefunds(participants.map(x => x.id))
    setRefundAmount('')
    setRefundOpen(null)
    setSaving(false)
    setSigTarget({ refundId: refund?.id, name: refundOpen.name, amount: amt })
    setSigOpen(true)
  }

  const handleSaveSignature = async (dataUrl) => {
    if (!sigTarget?.refundId) return
    await supabase.from('kitty_refunds').update({ signature: dataUrl }).eq('id', sigTarget.refundId)
    reloadRefunds(participants.map(x => x.id))
    setSigOpen(false)
    setSigTarget(null)
  }

  return (
    <div className="p-4 space-y-4">

      {allSettled ? (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <span className="text-5xl mb-3">✅</span>
          <p className="font-bold text-gray-800 text-lg">{t('noDebts')}</p>
        </div>
      ) : (
        <>
          {/* Owe the kitty */}
          {owesKitty.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 text-base">
                {isHe ? 'חייבים לקופה' : 'Owe the kitty'}
              </h3>
              <div className="space-y-3">
                {owesKitty.map((p, i) => {
                  const remaining = getRemaining(p)
                  const collDebt = getCollDebt(p)
                  const idx = participants.indexOf(p)
                  const totalDebt = Math.round(Math.max(remaining, 0) * 100) / 100
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 bg-red-50 rounded-2xl p-3.5"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                        {collDebt > 0.5 && (
                          <p className="text-xs text-red-400">💰 {isHe ? `יתרת גיוס: ${formatCurrency(collDebt, 'EUR')}` : `Collection debt: ${formatCurrency(collDebt, 'EUR')}`}</p>
                        )}
                        {remaining > 0.5 && (
                          <p className="text-xs text-gray-400">{isHe ? 'חייב לקופה' : 'owes the kitty'}</p>
                        )}
                      </div>
                      <p className="font-black text-red-500 text-lg">{formatCurrency(totalDebt, 'EUR')}</p>
                      {isAdmin && (
                        <button
                          onClick={() => openReceived(p)}
                          className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-white border border-red-300 text-red-600 active:bg-red-50 flex-shrink-0"
                        >
                          ✓ {isHe ? 'קיבלתי' : 'Received'}
                        </button>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Kitty owes */}
          {kittyOwes.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 text-base">
                {isHe ? 'הקופה חייבת' : 'Kitty owes'}
              </h3>
              <div className="space-y-3">
                {kittyOwes.map((p, i) => {
                  const idx = participants.indexOf(p)
                  const owedByKitty = getKittyOwedAmount(p)
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 bg-emerald-50 rounded-2xl p-3.5"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                        <p className="text-xs text-gray-400">{isHe ? 'הקופה חייבת לו' : 'Kitty owes them'}</p>
                      </div>
                      <p className="font-black text-emerald-500 text-lg">{formatCurrency(owedByKitty, 'EUR')}</p>
                      {isAdmin && (
                        <button
                          onClick={() => openRefund(p)}
                          className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-white border border-emerald-300 text-emerald-600 active:bg-emerald-50 flex-shrink-0"
                        >
                          ↩ {isHe ? 'החזר' : 'Refund'}
                        </button>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={!!receivedOpen} onClose={() => setReceivedOpen(null)}
        title={isHe ? 'תיעוד קבלת תשלום' : 'Record Payment Received'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isHe ? 'סיבה' : 'Reason'}
            </label>
            <div className="flex gap-2">
              {['יתרת גיוס', 'גיוס שלא שולם'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setReceivedReason(reason)}
                  className={`flex-1 py-3 rounded-2xl text-sm font-semibold border-2 transition-all ${
                    receivedReason === reason
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 bg-white'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isHe ? `סכום שהתקבל מ${receivedOpen?.name} (EUR)` : `Amount received from ${receivedOpen?.name} (EUR)`}
            </label>
            <input type="number" inputMode="decimal"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
              placeholder="0" value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isHe ? 'תאריך קבלת התשלום' : 'Payment date'}
            </label>
            <input type="date"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
              value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setReceivedOpen(null)} className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50">{t('cancel')}</button>
            <button onClick={handleSaveReceived} disabled={saving || !receivedAmount || !receivedDate} className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 disabled:opacity-40">{saving ? '...' : t('save')}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!refundOpen} onClose={() => setRefundOpen(null)}
        title={isHe ? 'החזר מהקופה' : 'Kitty Refund'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isHe ? `סכום ההחזר ל${refundOpen?.name} (EUR)` : `Amount to return to ${refundOpen?.name} (EUR)`}
            </label>
            <input type="number" inputMode="decimal"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
              placeholder="0" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} autoFocus />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setRefundOpen(null)} className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50">{t('cancel')}</button>
            <button onClick={handleSaveRefund} disabled={saving || !refundAmount} className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 disabled:opacity-40">{saving ? '...' : t('save')}</button>
          </div>
        </div>
      </Modal>

      <SignaturePad open={sigOpen} onClose={() => { setSigOpen(false); setSigTarget(null) }}
        onSave={handleSaveSignature} personName={sigTarget?.name || ''} amount={sigTarget?.amount || 0} lang={lang} />
    </div>
  )
}
