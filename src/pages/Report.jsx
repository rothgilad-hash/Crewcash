import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency, getCategoryIcon, getEurAmount, getCollectedAmount, getCollectionOverpayment } from '../lib/calculations'
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
    const rem = Math.round((b.owes - col)*100)/100
    return `<tr>
      <td>${p.name}${p.is_gil?' ⭐':''}${p.joined_late?' ⏰':''}</td>
      <td>${fmt(b.owes)}</td>
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

      {/* Per-person breakdown */}
      {participants.map((p, i) => {
        const b = balances[p.id] || { owes: 0, paid: 0 }
        const collected = getCollectedAmount(kittyCollections, p.id, p)
        const myCollections = kittyCollections.filter(c => c.participant_id === p.id)
        const personalPaid = b.paid || 0
        const kittyPaidBack = getKittyPaidBack(p.id)
        const refunds = getRefunds(p.id)
        const remaining = Math.round((b.owes - collected - personalPaid + kittyPaidBack) * 100) / 100
        // Kitty owes only if no collection yet (collection already absorbs personal credit)
        const overpay = Math.round(getCollectionOverpayment(kittyCollections, p.id) * 100) / 100
        const kittyOwes = overpay > 0.5

        const personalExpenses = expenses.filter(e => e.paid_by === p.id && !e.is_yacht_cost)

        // Running share before any yacht adjustments
        const runningShare = Math.round((totalExpenses / participants.length) * 100) / 100

        // Late joiner reduction for this person
        const existing = participants.filter(x => !x.joined_late)
        const oldParts = existing.reduce((sum, x) => sum + (x.is_gil ? 2 : 1), 0)
        const newParts = participants.reduce((sum, x) => sum + (x.is_gil ? 2 : 1), 0)
        const myParts = p.is_gil ? 2 : 1
        const yachtReduction = (hasLateJoiners && !p.joined_late && oldParts > 0 && newParts > 0)
          ? Math.round(yachtTotal * myParts * (1 / oldParts - 1 / newParts) * 100) / 100
          : 0

        const categoryBreakdown = runningExpenses.reduce((acc, e) => {
          const share = getEurAmount(e) / participants.length
          acc[e.category] = (acc[e.category] || 0) + share
          return acc
        }, {})

        const lateJoinerNames = lateJoiners.map(x => x.name).join(', ')

        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
          >
            {/* Person header */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                {p.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{p.name}{p.is_gil ? ' ⭐' : ''}{p.joined_late ? ' ⏰' : ''}</p>
                <p className={`text-sm font-semibold ${remaining > 0.5 ? 'text-red-500' : kittyOwes ? 'text-emerald-500' : 'text-gray-400'}`}>
                  {remaining > 0.5
                    ? `${isHe ? 'חייב לקופה' : 'Owes kitty'} ${formatCurrency(remaining, 'EUR')}`
                    : kittyOwes
                    ? `${isHe ? 'הקופה חייבת לו' : 'Kitty owes'} ${formatCurrency(overpay, 'EUR')}`
                    : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                </p>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="border-t border-gray-100 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-400 mb-2">{isHe ? 'חלקו בהוצאות השוטפות' : 'Share of running expenses'}</p>
              {Object.entries(categoryBreakdown).sort((a, c) => c[1] - a[1]).map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{getCategoryIcon(cat)} {t('cat_' + cat)}</span>
                  <span className="text-sm font-semibold text-gray-800">{formatCurrency(amt, 'EUR')}</span>
                </div>
              ))}

              {/* Subtotal running share */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                <span className="text-sm text-gray-500">{isHe ? 'סה״כ' : 'Subtotal'}</span>
                <span className="text-sm font-bold text-gray-800">{formatCurrency(runningShare, 'EUR')}</span>
              </div>

              {/* Late joiner reduction */}
              {yachtReduction > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-600">
                    ⏰ {isHe ? `הפחתה (${lateJoinerNames} הצטרף מאוחר)` : `Reduction (${lateJoinerNames} joined late)`}
                  </span>
                  <span className="text-sm font-bold text-emerald-600">−{formatCurrency(yachtReduction, 'EUR')}</span>
                </div>
              )}

              {/* Net */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                <span className="text-sm font-bold text-gray-700">{isHe ? 'לתשלום לקופה' : 'Net owed to kitty'}</span>
                <span className="text-sm font-black text-gray-900">{formatCurrency(b.owes, 'EUR')}</span>
              </div>
            </div>

            {/* Personal payments */}
            {personalExpenses.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 mb-2">{isHe ? 'שילם מכיסו' : 'Paid personally'}</p>
                {personalExpenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-0.5 gap-2">
                    <span className="text-sm text-gray-600 flex-1 min-w-0 truncate">
                      {getCategoryIcon(e.category)} {e.notes || e.description}
                    </span>
                    <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">
                      {formatCurrency(e.amount, e.currency)}
                      {e.currency !== 'EUR' && e.eur_rate && (
                        <span className="text-xs text-blue-400 block">
                          ≈ {formatCurrency(getEurAmount(e), 'EUR')}
                          <span className="text-gray-300 font-normal"> · {new Date(e.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
                  <span className="text-sm text-gray-500">{isHe ? 'סה״כ מכיסו' : 'Total personal'}</span>
                  <span className="text-sm font-bold text-emerald-600">{formatCurrency(personalExpenses.reduce((s,e) => s + getEurAmount(e), 0), 'EUR')}</span>
                </div>
              </div>
            )}

            {/* Collections per round */}
            {myCollections.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 mb-2">{isHe ? 'גיוסים לקופה' : 'Collections'}</p>
                {myCollections.map(c => (
                  <div key={c.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">💰 {c.round_name}</span>
                    <span className="text-sm font-semibold text-blue-600">{formatCurrency(c.amount, 'EUR')}</span>
                  </div>
                ))}
                {myCollections.length > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
                    <span className="text-sm text-gray-400">{isHe ? 'סה״כ גויס' : 'Total collected'}</span>
                    <span className="text-sm font-bold text-blue-600">{formatCurrency(collected, 'EUR')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Kitty refunds */}
            {refunds.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                <p className="text-xs font-semibold text-gray-400">{isHe ? 'החזרים מהקופה' : 'Kitty refunds'}</p>
                {refunds.map((r, ri) => (
                  <div key={r.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {isHe ? `החזר ${ri + 1}` : `Refund ${ri + 1}`}
                        {r.created_at && (
                          <span className="text-gray-400 text-xs ms-2">
                            {new Date(r.created_at).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(r.amount, 'EUR')}</span>
                    </div>
                    {r.signature && (
                      <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
                        <img src={r.signature} alt="signature" className="w-full max-h-20 object-contain" />
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <span className="text-sm font-bold text-gray-700">{isHe ? 'יתרה סופית' : 'Final balance'}</span>
                  <span className={`text-sm font-black ${remaining > 0.5 ? 'text-red-500' : kittyOwes ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {remaining > 0.5 ? formatCurrency(remaining, 'EUR') : kittyOwes ? `−${formatCurrency(overpay, 'EUR')}` : (isHe ? 'מסולק ✓' : 'Settled ✓')}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
