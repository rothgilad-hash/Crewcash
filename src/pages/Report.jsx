import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency, getCategoryIcon, getEurAmount, getExpenseDate, getCollectedAmount, getCollectionOverpayment, getLastCollectionDate, getPostCollectionNet } from '../lib/calculations'
import { motion } from 'framer-motion'
import { FileText, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import SignaturePad from '../components/SignaturePad'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export default function Report() {
  const { t } = useTranslation()
  const { participants, expenses, kittyRefunds, kittyCollections, lang, isAdmin, reloadRefunds, reloadCollections, reloadExpenses, trip, setExpenses } = useApp()
  const isHe = lang === 'he'

  const [editRefund, setEditRefund] = useState(null) // { refund, name }
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editRound, setEditRound] = useState(1)
  const [editSaving, setEditSaving] = useState(false)
  const [sigOpen, setSigOpen] = useState(false)
  const [sigTarget, setSigTarget] = useState(null)

  const handleDeleteAll = async () => {
    if (!window.confirm(isHe ? 'למחוק את כל הנתונים? (הוצאות, גיוסים, החזרים)' : 'Delete all data? (expenses, collections, refunds)')) return
    if (!window.confirm(isHe ? 'אתה בטוח לגמרי? פעולה זו בלתי הפיכה!' : 'Are you absolutely sure? This cannot be undone!')) return
    const ids = participants.map(p => p.id)
    await Promise.all([
      supabase.from('expenses').delete().eq('trip_id', trip.id),
      ids.length > 0 ? supabase.from('kitty_collections').delete().in('participant_id', ids) : Promise.resolve(),
      ids.length > 0 ? supabase.from('kitty_refunds').delete().in('participant_id', ids) : Promise.resolve(),
    ])
    setExpenses([])
    reloadCollections(ids)
    reloadRefunds(ids)
  }

  const openEditRefund = (r, name) => {
    setEditRefund({ refund: r, name })
    setEditAmount(String(r.amount))
    setEditDate(r.refund_date || r.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10))
    setEditRound(r.refund_round || 1)
  }

  const handleDeleteRefund = async () => {
    if (!editRefund) return
    setEditSaving(true)
    await supabase.from('kitty_refunds').delete().eq('id', editRefund.refund.id)
    reloadRefunds(participants.map(p => p.id))
    setEditRefund(null)
    setEditSaving(false)
  }

  const handleSaveEditRefund = async () => {
    if (!editRefund) return
    const amt = parseFloat(editAmount) || 0
    setEditSaving(true)
    await supabase.from('kitty_refunds').update({ amount: amt, signature: null, refund_date: editDate || null, refund_round: editRound }).eq('id', editRefund.refund.id)
    reloadRefunds(participants.map(p => p.id))
    setEditRefund(null)
    setEditSaving(false)
    setSigTarget({ refundId: editRefund.refund.id, name: editRefund.name, amount: amt })
    setSigOpen(true)
  }

  const handleSaveSignature = async (dataUrl) => {
    if (!sigTarget?.refundId) return
    await supabase.from('kitty_refunds').update({ signature: dataUrl }).eq('id', sigTarget.refundId)
    reloadRefunds(participants.map(p => p.id))
    setSigOpen(false)
    setSigTarget(null)
  }
  const balances = calculateBalances(expenses, participants)

  const getRefunds = (pid) => kittyRefunds.filter(r => r.participant_id === pid)
  const getKittyPaidBack = (pid) => {
    const fromTable = getRefunds(pid).reduce((s, r) => s + r.amount, 0)
    const p = participants.find(x => x.id === pid)
    return fromTable > 0 ? fromTable : (p?.kitty_paid_back || 0)
  }

  const runningExpenses = expenses.filter(e => !e.is_yacht_cost && !e.is_unexpected)
  const unexpectedExpenses = expenses.filter(e => !e.is_yacht_cost && e.is_unexpected)
  const unexpectedTotal = unexpectedExpenses.reduce((s, e) => s + getEurAmount(e), 0)
  const totalExpenses = runningExpenses.reduce((s, e) => s + getEurAmount(e), 0)
  const yachtTotal = expenses.filter(e => e.is_yacht_cost).reduce((s, e) => s + getEurAmount(e), 0)

  const lateJoiners = participants.filter(p => p.joined_late)
  const hasLateJoiners = lateJoiners.length > 0

  const totalCollected = participants.reduce((s, p) => s + getCollectedAmount(kittyCollections, p.id, p), 0)
  const cashSpent = expenses.filter(e => e.is_cash && e.is_paid).reduce((s, e) => s + getEurAmount(e), 0)
  const kittyRefundsTotal = kittyRefunds.reduce((s, r) => s + r.amount, 0)
  const cashBalance = totalCollected - cashSpent - kittyRefundsTotal
  const kittyPct = totalCollected > 0 ? cashBalance / totalCollected : 0

  const generatePDF = () => {
    const totalCollected = participants.reduce((s, p) => s + getCollectedAmount(kittyCollections, p.id, p), 0)

    // Category breakdown
    const catBreakdown = runningExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + getEurAmount(e)
      return acc
    }, {})

    // Daily breakdown
    const byDay = expenses.reduce((acc, e) => {
      const day = (e.created_at || '').slice(0, 10)
      if (day) acc[day] = (acc[day] || 0) + getEurAmount(e)
      return acc
    }, {})

    const fmt = (n) => `€${Math.round(n).toLocaleString('he-IL')}`

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8"/>
<title>דוח כספי — ${isHe ? 'טיול' : 'Trip'}</title>
<style>
  body { font-family: Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 24px; font-size: 13px; }
  h1 { font-size: 26px; margin-bottom: 4px; color: #1e3a8a; }
  h2 { font-size: 15px; color: #3b82f6; border-bottom: 2px solid #dbeafe; padding-bottom: 4px; margin-top: 28px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #eff6ff; color: #1e40af; font-size: 11px; padding: 6px 10px; text-align: right; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
  .total { font-weight: bold; background: #f8fafc; }
  .green { color: #059669; } .red { color: #dc2626; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
  .card { background: #f8fafc; border-radius: 8px; padding: 12px 16px; }
  .card-label { font-size: 11px; color: #94a3b8; margin-bottom: 2px; }
  .card-value { font-size: 20px; font-weight: 900; color: #1e293b; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
<h1>⛵ CrewCash — דוח כספי</h1>
<p style="color:#64748b; margin:0">${new Date().toLocaleDateString('he-IL', { day:'numeric', month:'long', year:'numeric' })}</p>

<div class="grid2">
  <div class="card"><div class="card-label">סך הוצאות</div><div class="card-value">${fmt(totalExpenses + yachtTotal)}</div></div>
  <div class="card"><div class="card-label">סך גיוסים</div><div class="card-value">${fmt(totalCollected)}</div></div>
  <div class="card"><div class="card-label">יאכטה</div><div class="card-value">${fmt(yachtTotal)}</div></div>
  <div class="card"><div class="card-label">הוצאות שוטפות</div><div class="card-value">${fmt(totalExpenses)}</div></div>
</div>

<h2>📊 פירוט לפי קטגוריה</h2>
<table>
  <tr><th>קטגוריה</th><th>סכום</th><th>אחוז</th></tr>
  ${Object.entries(catBreakdown).sort((a,b)=>b[1]-a[1]).map(([cat,amt]) =>
    `<tr><td>${getCategoryIcon(cat)} ${cat}</td><td>${fmt(amt)}</td><td>${Math.round(amt/totalExpenses*100)}%</td></tr>`
  ).join('')}
  <tr class="total"><td>סה"כ</td><td>${fmt(totalExpenses)}</td><td>100%</td></tr>
</table>

<h2>📅 פירוט יומי (כרונולוגי)</h2>
<table>
  <tr><th>תאריך</th><th>סכום</th></tr>
  ${Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([day,amt]) =>
    `<tr><td>${new Date(day).toLocaleDateString('he-IL',{weekday:'short',day:'numeric',month:'short'})}</td><td>${fmt(amt)}</td></tr>`
  ).join('')}
</table>

<h2>💸 הוצאות מגדולה לקטנה</h2>
<table>
  <tr><th>הוצאה</th><th>קטגוריה</th><th>תאריך</th><th>סכום</th></tr>
  ${[...expenses].sort((a,b)=>getEurAmount(b)-getEurAmount(a)).map(e =>
    `<tr><td>${e.description}</td><td>${e.category}</td><td>${(e.created_at||'').slice(0,10)}</td><td>${fmt(getEurAmount(e))}</td></tr>`
  ).join('')}
</table>

<h2>👥 יתרה לאדם</h2>
<table>
  <tr><th>שם</th><th>חייב לקופה</th><th>גויס</th><th>יתרה</th></tr>
  ${participants.map(p => {
    const b = balances[p.id] || { owes:0 }
    const col = getCollectedAmount(kittyCollections, p.id, p)
    const netToCollect = Math.round(b.owes*100)/100
    const rem = Math.round((netToCollect - col)*100)/100
    return `<tr>
      <td>${p.name}${p.is_gil?' ⭐':''}${p.joined_late?' ⏰':''}</td>
      <td>${fmt(netToCollect)}</td>
      <td>${fmt(col)}</td>
      <td class="${rem>0.5?'red':rem<-0.5?'green':''}">${Math.abs(rem)<=0.5?'✓':rem>0?fmt(rem):`+${fmt(Math.abs(rem))}`}</td>
    </tr>`
  }).join('')}
</table>

<h2>💡 הצעות ייעול</h2>
<ul>
  ${totalExpenses/participants.length > 150 ? '<li>עלות לאדם גבוהה — שקול להפחית הוצאות אלכוהול/פעילויות</li>' : ''}
  <li>ממוצע יומי: ${fmt(totalExpenses / Math.max(Object.keys(byDay).length, 1))} ליום</li>
  <li>עלות לאדם: ${fmt((totalExpenses+yachtTotal)/participants.length)}</li>
</ul>

<script>window.onload = () => window.print()</script>
</body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="p-4 space-y-4">

      {/* PDF export button */}
      <button
        onClick={generatePDF}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700"
      >
        <FileText size={18} />
        {isHe ? 'הורד דוח PDF' : 'Export PDF Report'}
      </button>

      {isAdmin && (expenses.length > 0 || kittyCollections.length > 0 || kittyRefunds.length > 0) && (
        <button
          onClick={handleDeleteAll}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm active:bg-red-50"
        >
          <Trash2 size={16} />
          {isHe ? 'מחק את כל הנתונים' : 'Delete All Data'}
        </button>
      )}

      {/* Summary header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 text-base mb-1">{isHe ? 'סיכום הטיול' : 'Trip Summary'}</h3>
        <p className="text-3xl font-black text-gray-900">{formatCurrency(totalExpenses, 'EUR')}</p>
        <p className="text-gray-400 text-sm mt-1">
          {runningExpenses.length} {isHe ? 'הוצאות' : 'expenses'} · {participants.length} {isHe ? 'משתתפים' : 'participants'}
        </p>
      </div>


      {/* Per-person breakdown */}
      {participants.map((p, i) => {
        const b = balances[p.id] || { owes: 0, paid: 0 }
        const myCollections = kittyCollections.filter(c => c.participant_id === p.id)
        const round1Collections = myCollections.filter(c => !c.round_name?.includes('שני'))
        const round2Collections = myCollections.filter(c => c.round_name?.includes('שני'))
        const kittyPaidBack = getKittyPaidBack(p.id)
        const allRefunds = getRefunds(p.id)
        // Split refunds: after first round-2 collection date → round 2, else round 1
        const refunds = allRefunds.filter(r => (r.refund_round || 1) === 1)
        const round2Refunds = allRefunds.filter(r => r.refund_round === 2)
        const lastDate = getLastCollectionDate(kittyCollections, p.id)
        const N = participants.length

        // Pre-collection personal expenses (exclude unexpected) — kitty refunds FULL amount
        const prePersonal = expenses.filter(e =>
          e.paid_by === p.id && !e.is_yacht_cost && !e.is_unexpected &&
          (!lastDate || getExpenseDate(e) <= lastDate)
        )
        const prePersonalFull = Math.round(
          prePersonal.reduce((s, e) => s + getEurAmount(e), 0) * 100
        ) / 100

        // Unexpected expenses — equal share for 2nd collection; personal payers get (N-1)/N refund
        const unexpectedShare = Math.round(unexpectedTotal / N * 100) / 100
        const unexpectedPersonal = unexpectedExpenses.filter(e => e.paid_by === p.id)
        const unexpectedPersonalNet = Math.round(
          unexpectedPersonal.reduce((s, e) => s + getEurAmount(e) * (N - 1) / N, 0) * 100
        ) / 100
        const unexpectedNet = Math.round(unexpectedShare * 100) / 100

        // Late joiner reduction
        const existing = participants.filter(x => !x.joined_late)
        const oldParts = existing.reduce((sum, x) => sum + (x.is_gil ? 2 : 1), 0)
        const newParts = participants.reduce((sum, x) => sum + (x.is_gil ? 2 : 1), 0)
        const myParts = p.is_gil ? 2 : 1
        const yachtReduction = (hasLateJoiners && !p.joined_late && oldParts > 0 && newParts > 0)
          ? Math.round(yachtTotal * myParts * (1 / oldParts - 1 / newParts) * 100) / 100
          : 0

        const runningShare = Math.round(runningExpenses.reduce((s, e) => {
          const excluded = e.excluded_ids || []
          if (excluded.includes(p.id)) return s
          const active = participants.filter(x => !excluded.includes(x.id)).length
          return s + getEurAmount(e) / (active || N)
        }, 0) * 100) / 100
        const displayOwes = Math.round((b.owes - unexpectedShare) * 100) / 100

        const categoryBreakdown = runningExpenses.reduce((acc, e) => {
          const excluded = e.excluded_ids || []
          if (excluded.includes(p.id)) return acc
          const active = participants.filter(x => !excluded.includes(x.id)).length
          acc[e.category] = (acc[e.category] || 0) + getEurAmount(e) / (active || N)
          return acc
        }, {})

        // Overpay per round
        const round1Overpay = Math.round(
          round1Collections.filter(c => c.amount > (c.target_amount || 0))
            .reduce((s, c) => s + c.amount - (c.target_amount || 0), 0) * 100
        ) / 100
        const round2Overpay = Math.round(
          round2Collections.filter(c => c.amount > (c.target_amount || 0))
            .reduce((s, c) => s + c.amount - (c.target_amount || 0), 0) * 100
        ) / 100

        // Post-collection: kitty owes FULL amount (no offset)
        const postPersonal = lastDate ? expenses.filter(e =>
          e.paid_by === p.id && !e.is_yacht_cost && !e.is_unexpected &&
          getExpenseDate(e) > lastDate
        ) : []
        const postFull = Math.round(postPersonal.reduce((s, e) => s + getEurAmount(e), 0) * 100) / 100
        const kittyOwedAmount = Math.round((round1Overpay + postFull + unexpectedPersonalNet - kittyPaidBack) * 100) / 100
        const kittyOwes = kittyOwedAmount > 0.5

        // netToCollect = full share minus pre-collection personal (100% deduction, not (N-1)/N)
        const netToCollect = Math.round((displayOwes - prePersonalFull) * 100) / 100

        const lateJoinerNames = lateJoiners.map(x => x.name).join(', ')

        // Round 1 kitty owes: overpay + post-personal expenses - refunds already given
        const kittyOwedRound1 = Math.round((round1Overpay + postFull - kittyPaidBack) * 100) / 100
        const kittyOwesRound1 = kittyOwedRound1 > 0.5

        // Round 2 kitty owes: round2 overpay + unexpected personal net
        const kittyOwedRound2 = Math.round((round2Overpay + unexpectedPersonalNet) * 100) / 100
        const kittyOwesRound2 = kittyOwedRound2 > 0.5

        // Chronological debt ledger
        const ledgerEvents = [
          ...myCollections.map(c => ({
            date: c.collected_at || '',
            type: 'collection',
            amount: c.amount,
            label: c.round_name || (isHe ? 'גיוס' : 'Collection'),
          })),
          ...allRefunds.map(r => ({
            date: r.refund_date || (r.created_at || '').slice(0, 10),
            type: 'refund',
            amount: r.amount,
            label: isHe ? 'החזר מהקופה' : 'Kitty refund',
          })),
        ].sort((a, b) => a.date.localeCompare(b.date))
        let runningBalance = netToCollect
        const ledger = ledgerEvents.map(event => {
          if (event.type === 'collection') runningBalance -= event.amount
          else runningBalance += event.amount
          return { ...event, balance: Math.round(runningBalance * 100) / 100 }
        })

        return (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Name header */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                {p.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-base">{p.name}{p.is_gil ? ' ⭐' : ''}{p.joined_late ? ' ⏰' : ''}</p>
              </div>
            </div>

            {/* ── סבב 1 — גיוס ראשון ── */}
            <div className="border-t border-gray-100">
              <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">📋 {isHe ? 'סבב 1 — גיוס ראשון' : 'Round 1'}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Expense breakdown */}
              <div className="px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 mb-1">{isHe ? 'חלק בהוצאות השוטפות' : 'Share of running expenses'}</p>
                {Object.entries(categoryBreakdown).sort((a, c) => c[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{getCategoryIcon(cat)} {t('cat_' + cat)}</span>
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(amt, 'EUR')}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <span className="text-sm text-gray-500">{isHe ? 'סה״כ' : 'Subtotal'}</span>
                  <span className="text-sm font-bold text-gray-800">{formatCurrency(runningShare, 'EUR')}</span>
                </div>
                {yachtReduction > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-emerald-600">⏰ {isHe ? `הפחתה — ${lateJoinerNames} הצטרף מאוחר` : `Reduction — ${lateJoinerNames} joined late`}</span>
                    <span className="text-sm font-bold text-emerald-600">−{formatCurrency(yachtReduction, 'EUR')}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <span className="text-sm font-bold text-gray-700">{isHe ? 'תשלום לקופה' : 'Owed to kitty'}</span>
                  <span className="text-sm font-black text-gray-900">{formatCurrency(displayOwes, 'EUR')}</span>
                </div>
                {prePersonalFull > 0.5 && (
                  <>
                    <div className="pt-0.5">
                      <p className="text-xs font-semibold text-gray-400 mb-1">{isHe ? 'הוציא מכיסו לפני הגיוס' : 'Paid personally before collection'}</p>
                      {prePersonal.map(e => (
                        <div key={e.id} className="flex items-center justify-between py-0.5 gap-2">
                          <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{getCategoryIcon(e.category)} {e.description}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{formatCurrency(getEurAmount(e), 'EUR')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-600">{isHe ? 'הפחתה בגין הוצאה פרטית' : 'Deduction — personal payment'}</span>
                      <span className="text-sm font-bold text-blue-600">−{formatCurrency(prePersonalFull, 'EUR')}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between border-t-2 border-blue-200 pt-2">
                  <span className="text-sm font-black text-gray-800">{isHe ? 'נטו לגיוס' : 'Net to collect'}</span>
                  <span className={`text-base font-black ${netToCollect > 0.5 ? 'text-red-500' : 'text-blue-500'}`}>
                    {netToCollect > 0.5 ? formatCurrency(netToCollect, 'EUR') : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                  </span>
                </div>
              </div>

              {/* Collections for round 1 */}
              {round1Collections.length > 0 && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 mb-1">💰 {isHe ? 'גיוסים' : 'Collections'}</p>
                  {round1Collections.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-600 flex-shrink-0">{c.round_name}{c.collected_at ? ` · ${new Date(c.collected_at).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}` : ''}</span>
                      <span className="text-sm font-semibold text-blue-600">{formatCurrency(c.amount, 'EUR')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Kitty owes round 1 + refunds — shown together whenever kitty owed or refund exists */}
              {(kittyOwesRound1 || refunds.length > 0) && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-emerald-500 mb-1">✅ {isHe ? 'הקופה חייבת לו' : 'Kitty owes'}</p>
                  {round1Overpay > 0.5 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{isHe ? 'שילם יותר מהיעד' : 'Overpaid target'}</span>
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(round1Overpay, 'EUR')}</span>
                    </div>
                  )}
                  {postPersonal.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-400 mt-0.5">{isHe ? 'הוצאות מכיס לאחר הגיוס' : 'Personal expenses after collection'}</p>
                      {postPersonal.map(e => (
                        <div key={e.id} className="flex items-center justify-between py-0.5 gap-2">
                          <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">{getCategoryIcon(e.category)} {e.description}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">{formatCurrency(getEurAmount(e), 'EUR')}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {kittyOwesRound1 && (
                    <div className="flex items-center justify-between border-t border-emerald-200 pt-1">
                      <span className="text-sm font-bold text-emerald-700">{isHe ? 'סה״כ להחזר' : 'Total to refund'}</span>
                      <span className="text-base font-black text-emerald-600">{formatCurrency(kittyOwedRound1, 'EUR')}</span>
                    </div>
                  )}
                  {refunds.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {refunds.map((r, ri) => (
                        <div key={r.id} className="space-y-1" onClick={() => isAdmin && openEditRefund(r, p.name)} style={isAdmin ? { cursor: 'pointer' } : {}}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">💸 {isHe ? `החזר ${ri + 1}` : `Refund ${ri + 1}`}{(r.refund_date || r.created_at) && <span className="text-gray-400 text-xs ms-2">{new Date(r.refund_date || r.created_at).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}</span>}</span>
                            <span className="text-sm font-semibold text-emerald-600">{formatCurrency(r.amount, 'EUR')}</span>
                          </div>
                          {r.signature && <div className="border border-gray-100 rounded-xl overflow-hidden"><img src={r.signature} alt="signature" className="w-full max-h-20 object-contain" /></div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── פנקס חוב כרונולוגי ── */}
            {ledger.length > 0 && (
              <div className="border-t-2 border-dashed border-gray-100">
                <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">📒 {isHe ? 'היסטוריית חוב' : 'Debt History'}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <div className="px-4 pb-3 space-y-0">
                  {/* Opening balance */}
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                    <span className="text-xs text-gray-400">{isHe ? 'יתרה פותחת' : 'Opening balance'}</span>
                    <span className={`text-xs font-bold ${netToCollect > 0.5 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {netToCollect > 0.5
                        ? (isHe ? `חייב לקופה ${formatCurrency(netToCollect, 'EUR')}` : `Owes kitty ${formatCurrency(netToCollect, 'EUR')}`)
                        : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                    </span>
                  </div>
                  {/* Events */}
                  {ledger.map((event, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-600">
                          {event.type === 'collection' ? '💰' : '↩'} {event.label}
                          {event.date && (
                            <span className="text-gray-300 ms-1.5">
                              · {new Date(event.date).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </span>
                        <span className={`text-xs font-semibold ms-1.5 ${event.type === 'collection' ? 'text-blue-500' : 'text-orange-500'}`}>
                          {event.type === 'collection' ? `−${formatCurrency(event.amount, 'EUR')}` : `+${formatCurrency(event.amount, 'EUR')}`}
                        </span>
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 ${event.balance > 0.5 ? 'text-red-500' : event.balance < -0.5 ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {event.balance > 0.5
                          ? (isHe ? `חייב ${formatCurrency(event.balance, 'EUR')}` : `Owes ${formatCurrency(event.balance, 'EUR')}`)
                          : event.balance < -0.5
                          ? (isHe ? `קופה חייבת ${formatCurrency(Math.abs(event.balance), 'EUR')}` : `Kitty owes ${formatCurrency(Math.abs(event.balance), 'EUR')}`)
                          : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── סבב 2 — גיוס שני (רק אם יש הוצאות לא צפויות) ── */}
            {unexpectedTotal > 0.5 && (
              <div className="border-t-2 border-gray-100">
                <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                  <span className="text-xs font-bold text-orange-400">⚡ {isHe ? 'סבב 2 — גיוס שני' : 'Round 2'}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                <div className="px-4 py-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 mb-1">{isHe ? 'חלק בהוצאות הלא צפויות' : 'Share of unexpected expenses'}</p>
                  {unexpectedExpenses.map(e => (
                    <div key={e.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{getCategoryIcon(e.category)} {e.description}</span>
                      <span className="text-xs text-gray-400">{formatCurrency(getEurAmount(e) / N, 'EUR')}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-orange-100 pt-2">
                    <span className="text-sm font-bold text-gray-700">{isHe ? 'תשלום לקופה' : 'Owed to kitty'}</span>
                    <span className="text-sm font-black text-gray-900">{formatCurrency(unexpectedShare, 'EUR')}</span>
                  </div>
                  {unexpectedPersonal.length > 0 && (
                    <>
                      <div className="pt-0.5">
                        <p className="text-xs font-semibold text-gray-400 mb-1">{isHe ? 'הוציא מכיסו' : 'Paid personally'}</p>
                        {unexpectedPersonal.map(e => (
                          <div key={e.id} className="flex items-center justify-between py-0.5 gap-2">
                            <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{getCategoryIcon(e.category)} {e.description}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">{formatCurrency(getEurAmount(e), 'EUR')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-600">{isHe ? 'הפחתה בגין הוצאה פרטית' : 'Deduction — personal payment'}</span>
                        <span className="text-sm font-bold text-blue-600">−{formatCurrency(unexpectedPersonalNet, 'EUR')}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between border-t-2 border-orange-300 pt-2">
                    <span className="text-sm font-black text-gray-800">{isHe ? 'נטו לגיוס שני' : 'Net for 2nd collection'}</span>
                    <span className={`text-base font-black ${unexpectedNet > 0.5 ? 'text-orange-600' : 'text-orange-400'}`}>
                      {unexpectedNet > 0.5 ? formatCurrency(unexpectedNet, 'EUR') : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                    </span>
                  </div>
                </div>

                {/* Collections for round 2 */}
                {round2Collections.length > 0 && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-400 mb-1">💰 {isHe ? 'גיוסים' : 'Collections'}</p>
                    {round2Collections.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-600 flex-shrink-0">{c.round_name}{c.collected_at ? ` · ${new Date(c.collected_at).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}` : ''}</span>
                        <span className="text-sm font-semibold text-blue-600">{formatCurrency(c.amount, 'EUR')}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Kitty owes round 2 + round 2 refunds */}
                {(kittyOwesRound2 || round2Refunds.length > 0) && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-emerald-500 mb-1">✅ {isHe ? 'הקופה חייבת לו' : 'Kitty owes'}</p>
                    {round2Overpay > 0.5 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{isHe ? 'שילם יותר מהיעד' : 'Overpaid target'}</span>
                        <span className="text-sm font-semibold text-emerald-600">{formatCurrency(round2Overpay, 'EUR')}</span>
                      </div>
                    )}
                    {unexpectedPersonalNet > 0.5 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">⚡ {isHe ? 'הוצאה לא צפויה ששילם (נטו)' : 'Unexpected expense paid (net)'}</span>
                        <span className="text-sm font-semibold text-emerald-600">{formatCurrency(unexpectedPersonalNet, 'EUR')}</span>
                      </div>
                    )}
                    {kittyOwesRound2 && (
                      <div className="flex items-center justify-between border-t border-emerald-200 pt-1">
                        <span className="text-sm font-bold text-emerald-700">{isHe ? 'סה״כ להחזר' : 'Total to refund'}</span>
                        <span className="text-base font-black text-emerald-600">{formatCurrency(kittyOwedRound2, 'EUR')}</span>
                      </div>
                    )}
                    {round2Refunds.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {round2Refunds.map((r, ri) => (
                          <div key={r.id} className="space-y-1" onClick={() => isAdmin && openEditRefund(r, p.name)} style={isAdmin ? { cursor: 'pointer' } : {}}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">💸 {isHe ? `החזר ${ri + 1}` : `Refund ${ri + 1}`}{(r.refund_date || r.created_at) && <span className="text-gray-400 text-xs ms-2">{new Date(r.refund_date || r.created_at).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}</span>}</span>
                              <span className="text-sm font-semibold text-emerald-600">{formatCurrency(r.amount, 'EUR')}</span>
                            </div>
                            {r.signature && <div className="border border-gray-100 rounded-xl overflow-hidden"><img src={r.signature} alt="signature" className="w-full max-h-20 object-contain" /></div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </motion.div>
        )
      })}

      {/* Edit refund modal */}
      <Modal open={!!editRefund} onClose={() => setEditRefund(null)}
        title={isHe ? `עריכת החזר — ${editRefund?.name}` : `Edit refund — ${editRefund?.name}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isHe ? 'סכום ההחזר (EUR)' : 'Refund amount (EUR)'}
            </label>
            <input type="number" inputMode="decimal"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
              value={editAmount} onChange={e => setEditAmount(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isHe ? 'תאריך ההחזר' : 'Refund date'}
            </label>
            <input type="date"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-blue-500 text-gray-900 bg-white"
              value={editDate} onChange={e => setEditDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isHe ? 'סבב גיוס' : 'Collection round'}
            </label>
            <div className="flex gap-2">
              {[1, 2].map(r => (
                <button key={r} onClick={() => setEditRound(r)}
                  className={`flex-1 py-3 rounded-2xl text-sm font-semibold border-2 transition-all ${editRound === r ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 bg-white'}`}>
                  {isHe ? `סבב ${r}` : `Round ${r}`}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleDeleteRefund}
            disabled={editSaving}
            className="w-full py-4 rounded-2xl border-2 border-red-200 text-red-600 font-semibold active:bg-red-50 disabled:opacity-40"
          >
            🗑 {isHe ? 'מחק החזר זה' : 'Delete this refund'}
          </button>
          <div className="flex gap-3">
            <button onClick={() => setEditRefund(null)} className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50">
              {t('cancel')}
            </button>
            <button onClick={handleSaveEditRefund} disabled={editSaving || !editAmount}
              className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 disabled:opacity-40">
              {editSaving ? '...' : isHe ? 'שמור וחתום' : 'Save & Sign'}
            </button>
          </div>
        </div>
      </Modal>

      <SignaturePad open={sigOpen} onClose={() => { setSigOpen(false); setSigTarget(null) }}
        onSave={handleSaveSignature} personName={sigTarget?.name || ''} amount={sigTarget?.amount || 0} lang={lang} />
    </div>
  )
}
