import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency, getCategoryIcon, getEurAmount, getExpenseDate, getCollectedAmount, getCollectionOverpayment, getLastCollectionDate, getPostCollectionNet } from '../lib/calculations'
import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

export default function Report() {
  const { t } = useTranslation()
  const { participants, expenses, kittyRefunds, kittyCollections, lang } = useApp()
  const isHe = lang === 'he'
  const balances = calculateBalances(expenses, participants)

  const getRefunds = (pid) => kittyRefunds.filter(r => r.participant_id === pid)
  const getKittyPaidBack = (pid) => {
    const fromTable = getRefunds(pid).reduce((s, r) => s + r.amount, 0)
    const p = participants.find(x => x.id === pid)
    return fromTable > 0 ? fromTable : (p?.kitty_paid_back || 0)
  }

  const runningExpenses = expenses.filter(e => !e.is_yacht_cost)
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
    const lastDateP = getLastCollectionDate(kittyCollections, p.id)
    const NP = participants.length
    const preNet = expenses
      .filter(e => e.paid_by === p.id && !e.is_yacht_cost && (!lastDateP || getExpenseDate(e) <= lastDateP))
      .reduce((s, e) => s + getEurAmount(e) * (NP-1) / NP, 0)
    const netToCollect = Math.round((b.owes - preNet)*100)/100
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

      {/* Summary header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 text-base mb-1">{isHe ? 'סיכום הטיול' : 'Trip Summary'}</h3>
        <p className="text-3xl font-black text-gray-900">{formatCurrency(totalExpenses, 'EUR')}</p>
        <p className="text-gray-400 text-sm mt-1">
          {runningExpenses.length} {isHe ? 'הוצאות' : 'expenses'} · {participants.length} {isHe ? 'משתתפים' : 'participants'}
        </p>
      </div>

      {/* Kitty balance per person */}
      {totalCollected > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 text-base">{isHe ? 'חלק בקופה' : 'Kitty share'}</h3>
            <span className={`text-sm font-bold px-2.5 py-1 rounded-xl ${cashBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
              {Math.round(kittyPct * 100)}% {isHe ? 'נותר' : 'remaining'}
            </span>
          </div>
          <div className="space-y-2">
            {participants.map((p, i) => {
              const collected = getCollectedAmount(kittyCollections, p.id, p)
              if (collected < 0.5) return null
              const remaining = Math.round(collected * kittyPct * 100) / 100
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                    {p.name.charAt(0)}
                  </div>
                  <span className="flex-1 text-sm font-semibold text-gray-700">{p.name}</span>
                  <span className="text-xs text-gray-400">{isHe ? 'גויס' : 'paid'} {formatCurrency(collected, 'EUR')}</span>
                  <span className={`text-sm font-bold w-16 text-right ${remaining >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {remaining >= 0 ? formatCurrency(remaining, 'EUR') : '−' + formatCurrency(Math.abs(remaining), 'EUR')}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-2">
            <span className="text-xs text-gray-400">{isHe ? 'יתרת קופה' : 'Kitty balance'}</span>
            <span className={`text-sm font-black ${cashBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {cashBalance >= 0 ? formatCurrency(cashBalance, 'EUR') : '−' + formatCurrency(Math.abs(cashBalance), 'EUR')}
            </span>
          </div>
        </div>
      )}

      {/* Per-person breakdown */}
      {participants.map((p, i) => {
        const b = balances[p.id] || { owes: 0, paid: 0 }
        const myCollections = kittyCollections.filter(c => c.participant_id === p.id)
        const kittyPaidBack = getKittyPaidBack(p.id)
        const refunds = getRefunds(p.id)
        const lastDate = getLastCollectionDate(kittyCollections, p.id)
        const N = participants.length

        // Pre-collection personal expenses (paid before collection date, or all if no date)
        const prePersonal = expenses.filter(e =>
          e.paid_by === p.id && !e.is_yacht_cost &&
          (!lastDate || getExpenseDate(e) <= lastDate)
        )
        const prePersonalNet = Math.round(
          prePersonal.reduce((s, e) => s + getEurAmount(e) * (N - 1) / N, 0) * 100
        ) / 100

        // Late joiner reduction
        const existing = participants.filter(x => !x.joined_late)
        const oldParts = existing.reduce((sum, x) => sum + (x.is_gil ? 2 : 1), 0)
        const newParts = participants.reduce((sum, x) => sum + (x.is_gil ? 2 : 1), 0)
        const myParts = p.is_gil ? 2 : 1
        const yachtReduction = (hasLateJoiners && !p.joined_late && oldParts > 0 && newParts > 0)
          ? Math.round(yachtTotal * myParts * (1 / oldParts - 1 / newParts) * 100) / 100
          : 0

        // Only include pre-collection running expenses in the breakdown
        const preRunningExpenses = lastDate
          ? runningExpenses.filter(e => getExpenseDate(e) <= lastDate)
          : runningExpenses
        const postRunningTotal = lastDate
          ? runningExpenses.filter(e => getExpenseDate(e) > lastDate).reduce((s, e) => s + getEurAmount(e), 0)
          : 0
        const runningShare = Math.round(preRunningExpenses.reduce((s, e) => s + getEurAmount(e), 0) / N * 100) / 100
        const displayOwes = Math.round((b.owes - postRunningTotal / N) * 100) / 100

        const categoryBreakdown = preRunningExpenses.reduce((acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + getEurAmount(e) / N
          return acc
        }, {})

        // Post-collection: kitty owes them
        const overpay = getCollectionOverpayment(kittyCollections, p.id)
        const postPersonal = lastDate ? expenses.filter(e =>
          e.paid_by === p.id && !e.is_yacht_cost &&
          getExpenseDate(e) > lastDate
        ) : []
        const postNet = Math.round(postPersonal.reduce((s, e) => s + getEurAmount(e) * (N - 1) / N, 0) * 100) / 100
        const kittyOwedAmount = Math.round((overpay + postNet) * 100) / 100
        const kittyOwes = kittyOwedAmount > 0.5

        // Net to collect = pre-collection owes minus personal credit
        const netToCollect = Math.round((displayOwes - prePersonalNet) * 100) / 100

        const lateJoinerNames = lateJoiners.map(x => x.name).join(', ')

        return (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Header */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                {p.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{p.name}{p.is_gil ? ' ⭐' : ''}{p.joined_late ? ' ⏰' : ''}</p>
                <p className={`text-sm font-semibold ${netToCollect > 0.5 ? 'text-red-500' : kittyOwes ? 'text-emerald-500' : 'text-gray-400'}`}>
                  {netToCollect > 0.5
                    ? `${isHe ? 'נטו לגיוס' : 'Net to collect'}: ${formatCurrency(netToCollect, 'EUR')}`
                    : kittyOwes
                    ? `${isHe ? 'הקופה חייבת לו' : 'Kitty owes'}: ${formatCurrency(kittyOwedAmount, 'EUR')}`
                    : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                </p>
              </div>
            </div>

            {/* Expense breakdown */}
            <div className="border-t border-gray-100 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-400 mb-2">{isHe ? 'חלקו בהוצאות השוטפות' : 'Share of running expenses'}</p>
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
              {prePersonalNet > 0.5 && (
                <>
                  <div className="pt-1">
                    <p className="text-xs font-semibold text-gray-400 mb-1">{isHe ? 'הוציא מכיסו לפני הגיוס' : 'Paid personally before collection'}</p>
                    {prePersonal.map(e => (
                      <div key={e.id} className="flex items-center justify-between py-0.5 gap-2">
                        <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">{getCategoryIcon(e.category)} {e.description}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatCurrency(getEurAmount(e), 'EUR')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-600">{isHe ? 'קיזוז — שילם מכיסו (נטו)' : 'Offset — personal payments (net)'}</span>
                    <span className="text-sm font-bold text-blue-600">−{formatCurrency(prePersonalNet, 'EUR')}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between border-t-2 border-gray-200 pt-2">
                <span className="text-sm font-black text-gray-800">{isHe ? 'נטו לגיוס' : 'Net to collect'}</span>
                <span className={`text-base font-black ${netToCollect > 0.5 ? 'text-red-500' : 'text-gray-400'}`}>
                  {netToCollect > 0.5 ? formatCurrency(netToCollect, 'EUR') : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                </span>
              </div>
            </div>

            {/* Kitty owes — post collection */}
            {kittyOwes && (
              <div className="border-t border-gray-100 px-4 py-3 bg-emerald-50 space-y-1">
                <p className="text-xs font-semibold text-emerald-600 mb-1">{isHe ? 'הקופה חייבת לו' : 'Kitty owes them'}</p>
                {overpay > 0.5 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{isHe ? '💰 שילם יותר מהיעד' : '💰 Overpaid target'}</span>
                    <span className="text-sm font-semibold text-emerald-600">{formatCurrency(overpay, 'EUR')}</span>
                  </div>
                )}
                {postPersonal.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-emerald-700 mt-1">{isHe ? 'הוצאות מכיס לאחר הגיוס' : 'Personal expenses after collection'}</p>
                    {postPersonal.map(e => (
                      <div key={e.id} className="flex items-center justify-between py-0.5 gap-2">
                        <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">{getCategoryIcon(e.category)} {e.description}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">{formatCurrency(getEurAmount(e), 'EUR')}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-xs text-emerald-600">{isHe ? 'חלק הקופה (נטו)' : 'Kitty share (net)'}</span>
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(postNet, 'EUR')}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between border-t border-emerald-200 pt-1">
                  <span className="text-sm font-bold text-emerald-700">{isHe ? 'סה״כ להחזר' : 'Total to refund'}</span>
                  <span className="text-base font-black text-emerald-600">{formatCurrency(kittyOwedAmount, 'EUR')}</span>
                </div>
              </div>
            )}

            {/* Collections */}
            {myCollections.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 mb-1">{isHe ? 'גיוסים' : 'Collections'}</p>
                {myCollections.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-500 flex-shrink-0">💰 {c.round_name}{c.collected_at ? ` · ${new Date(c.collected_at).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}` : ''}</span>
                    <span className="flex items-center gap-1.5">
                      {c.target_amount > 0 && c.target_amount < netToCollect - 0.5 && (
                        <span className="text-xs text-amber-500 font-medium">{isHe ? 'באישור הגזבר' : 'treasurer approved'}</span>
                      )}
                      <span className="text-sm font-semibold text-blue-600">{formatCurrency(c.amount, 'EUR')}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Refunds */}
            {refunds.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-gray-400">{isHe ? 'החזרים מהקופה' : 'Kitty refunds'}</p>
                {refunds.map((r, ri) => (
                  <div key={r.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">{isHe ? `החזר ${ri + 1}` : `Refund ${ri + 1}`}{r.created_at && <span className="text-gray-400 text-xs ms-2">{new Date(r.created_at).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}</span>}</span>
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(r.amount, 'EUR')}</span>
                    </div>
                    {r.signature && <div className="border border-gray-100 rounded-xl overflow-hidden"><img src={r.signature} alt="signature" className="w-full max-h-20 object-contain" /></div>}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
