import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { calculateBalances, formatCurrency, getCategoryIcon, getEurAmount, getExpenseDate, getCollectedAmount, getCollectionOverpayment, getLastCollectionDate, getPostCollectionNet } from '../lib/calculations'
import { motion } from 'framer-motion'
import { FileText, Trash2, Clipboard, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import SignaturePad from '../components/SignaturePad'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

const CAT_HE = {
  yacht: 'יאכטה', fuel: 'דלק', food: 'מסעדות', supermarket: 'סופר',
  alcohol: 'אלכוהול', transport: 'תחבורה', activities: 'פעילויות',
  gear: 'ציוד', accommodation: 'לינה', health: 'בריאות',
  insurance: 'ביטוח', yacht_services: 'שירותי יאכטה', other: 'אחר',
}

export default function Report() {
  const { t } = useTranslation()
  const { participants, expenses, kittyRefunds, kittyCollections, lang, isAdmin, reloadRefunds, reloadCollections, reloadExpenses, trip, setExpenses, shoppingItems } = useApp()
  const isHe = lang === 'he'

  const [editRefund, setEditRefund] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editRound, setEditRound] = useState(1)
  const [editSaving, setEditSaving] = useState(false)
  const [sigOpen, setSigOpen] = useState(false)
  const [sigTarget, setSigTarget] = useState(null)
  const [copying, setCopying] = useState(false)
  const [generating, setGenerating] = useState(false)

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

  const collectReportData = async () => {
    const [{ data: notes }, { data: leftovers }, { data: expenseItems }] = await Promise.all([
      supabase.from('trip_notes').select('*').eq('trip_id', trip.id).order('created_at'),
      supabase.from('trip_leftovers').select('*').eq('trip_id', trip.id).order('category'),
      supabase.from('expense_items').select('*').eq('trip_id', trip.id),
    ])
    return { notes: notes || [], leftovers: leftovers || [], expenseItems: expenseItems || [] }
  }

  const buildReportSections = (notes, leftovers, expenseItems) => {
    const fmt = (n) => `€${Math.round(n).toLocaleString('he-IL')}`
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

    const totalCollected = participants.reduce((s, p) => s + getCollectedAmount(kittyCollections, p.id, p), 0)
    const N = participants.length

    const catBreakdown = expenses.reduce((acc, e) => {
      const cat = CAT_HE[e.category] || e.category
      acc[cat] = (acc[cat] || 0) + getEurAmount(e)
      return acc
    }, {})

    const byDay = expenses.reduce((acc, e) => {
      const day = (e.planned_date || e.created_at || '').slice(0, 10)
      if (day) acc[day] = (acc[day] || 0) + getEurAmount(e)
      return acc
    }, {})
    const days = Object.keys(byDay).sort()
    const numDays = days.length || 1
    const avgDaily = totalExpenses / numDays

    const estimateExpenses = expenses.filter(e => e.is_estimate)
    const unexpectedExpenses = expenses.filter(e => e.is_unexpected)

    const crewNames = participants.map(p => `${p.name}${p.is_gil ? ' ⭐' : ''}${p.joined_late ? ' (הצטרף מאוחר)' : ''}`).join(', ')

    return { fmt, fmtDate, totalCollected, N, catBreakdown, byDay, days, numDays, avgDaily, estimateExpenses, unexpectedExpenses, crewNames }
  }

  const generatePDF = async () => {
    setGenerating(true)
    const { notes, leftovers, expenseItems } = await collectReportData()
    const { fmt, fmtDate, totalCollected, N, catBreakdown, byDay, days, numDays, avgDaily, estimateExpenses, unexpectedExpenses, crewNames } = buildReportSections(notes, leftovers, expenseItems)
    setGenerating(false)

    const tripTitle = `שייט ${trip.destination || ''} ${trip.year || ''} — ${trip.name || ''}`

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8"/>
<title>${tripTitle}</title>
<style>
  body { font-family: Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 28px 32px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 24px; margin-bottom: 2px; color: #1e3a8a; }
  h2 { font-size: 14px; color: #1e40af; border-bottom: 2px solid #dbeafe; padding-bottom: 4px; margin-top: 28px; margin-bottom: 8px; }
  h3 { font-size: 13px; color: #374151; margin: 12px 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
  th { background: #eff6ff; color: #1e40af; padding: 6px 8px; text-align: right; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .total td { font-weight: bold; background: #f8fafc; }
  .green { color: #059669; } .red { color: #dc2626; } .orange { color: #d97706; }
  .grid4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin: 10px 0; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
  .card { background: #f8fafc; border-radius: 8px; padding: 10px 14px; border: 1px solid #e2e8f0; }
  .card-label { font-size: 10px; color: #94a3b8; }
  .card-value { font-size: 18px; font-weight: 900; color: #1e293b; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-orange { background: #fef3c7; color: #92400e; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .note-block { background: #fafafa; border-right: 3px solid #3b82f6; padding: 8px 12px; margin: 6px 0; border-radius: 0 6px 6px 0; }
  .page-break { page-break-before: always; }
  @media print { body { padding: 12px 16px; } .page-break { page-break-before: always; } }
</style>
</head>
<body>

<h1>⛵ ${tripTitle}</h1>
<p style="color:#64748b;margin:2px 0 0">צוות: ${crewNames}</p>
<p style="color:#94a3b8;font-size:11px;margin:2px 0 16px">הופק ב-${new Date().toLocaleDateString('he-IL', { day:'numeric', month:'long', year:'numeric' })}</p>

<h2>📊 סיכום כספי</h2>
<div class="grid4">
  <div class="card"><div class="card-label">סך כל ההוצאות</div><div class="card-value">${fmt(totalExpenses + yachtTotal + unexpectedExpenses.reduce((s,e)=>s+getEurAmount(e),0))}</div></div>
  <div class="card"><div class="card-label">עלות לאדם</div><div class="card-value">${fmt((totalExpenses + yachtTotal)/N)}</div></div>
  <div class="card"><div class="card-label">סך גיוסים</div><div class="card-value">${fmt(totalCollected)}</div></div>
  <div class="card"><div class="card-label">ממוצע יומי</div><div class="card-value">${fmt(avgDaily)}</div></div>
</div>
<div class="grid4">
  <div class="card"><div class="card-label">יאכטה</div><div class="card-value">${fmt(yachtTotal)}</div></div>
  <div class="card"><div class="card-label">הוצאות שוטפות</div><div class="card-value">${fmt(totalExpenses)}</div></div>
  <div class="card"><div class="card-label">הוצאות לא צפויות</div><div class="card-value">${fmt(unexpectedExpenses.reduce((s,e)=>s+getEurAmount(e),0))}</div></div>
  <div class="card"><div class="card-label">ימי שייט (עם הוצאות)</div><div class="card-value">${numDays}</div></div>
</div>

<h2>📋 פירוט לפי קטגוריה</h2>
<table>
  <tr><th>קטגוריה</th><th>סכום</th><th>%</th><th>לאדם</th></tr>
  ${Object.entries(catBreakdown).sort((a,b)=>b[1]-a[1]).map(([cat,amt]) =>
    `<tr><td>${cat}</td><td>${fmt(amt)}</td><td>${Math.round(amt/(totalExpenses+yachtTotal)*100)}%</td><td>${fmt(amt/N)}</td></tr>`
  ).join('')}
  <tr class="total"><td>סה"כ</td><td>${fmt(totalExpenses+yachtTotal)}</td><td>100%</td><td>${fmt((totalExpenses+yachtTotal)/N)}</td></tr>
</table>

<h2>📅 פירוט יומי</h2>
<table>
  <tr><th>תאריך</th><th>הוצאות</th><th>סכום</th></tr>
  ${days.map(day => {
    const dayExpenses = expenses.filter(e => (e.planned_date || e.created_at || '').slice(0,10) === day)
    return `<tr><td>${fmtDate(day)}</td><td style="font-size:11px;color:#64748b">${dayExpenses.map(e=>e.description).join(' · ')}</td><td>${fmt(byDay[day])}</td></tr>`
  }).join('')}
  <tr class="total"><td>סה"כ</td><td></td><td>${fmt(Object.values(byDay).reduce((s,v)=>s+v,0))}</td></tr>
</table>

<h2>💸 כל ההוצאות בפירוט</h2>
<table>
  <tr><th>תיאור</th><th>קטגוריה</th><th>תאריך</th><th>סוג</th><th>שילם</th><th>סכום</th></tr>
  ${[...expenses].sort((a,b)=>(a.planned_date||a.created_at||'').localeCompare(b.planned_date||b.created_at||'')).map(e => {
    const payer = participants.find(p => p.id === e.paid_by)
    const badges = []
    if (e.is_estimate) badges.push('<span class="badge badge-blue">הערכה</span>')
    if (e.is_unexpected) badges.push('<span class="badge badge-orange">לא צפוי</span>')
    if (e.is_yacht_cost) badges.push('<span class="badge badge-blue">יאכטה</span>')
    if (e.is_cash) badges.push('<span class="badge badge-green">מזומן</span>')
    return `<tr>
      <td>${e.description}${e.notes ? `<br><span style="font-size:10px;color:#94a3b8">${e.notes}</span>` : ''}</td>
      <td>${CAT_HE[e.category]||e.category}</td>
      <td style="white-space:nowrap">${fmtDate(e.planned_date || e.created_at)}</td>
      <td>${badges.join(' ')}</td>
      <td>${payer ? payer.name : '—'}</td>
      <td>${fmt(getEurAmount(e))}</td>
    </tr>`
  }).join('')}
</table>

${estimateExpenses.length > 0 ? `
<h2>🎯 הערכות מול בפועל</h2>
<table>
  <tr><th>תיאור</th><th>תקציב</th><th>בפועל</th><th>סטייה</th><th>סטטוס</th></tr>
  ${estimateExpenses.map(e => {
    const budget = e.amount
    const actual = e.actual_amount
    const diff = actual != null ? actual - budget : null
    return `<tr>
      <td>${e.description}</td>
      <td>${fmt(budget)}</td>
      <td>${actual != null ? fmt(actual) : '—'}</td>
      <td class="${diff==null?'':diff>0?'red':'green'}">${diff==null?'—':diff>0?`+${fmt(diff)}`:fmt(diff)}</td>
      <td>${e.is_finalized ? '<span class="badge badge-green">סגור</span>' : '<span class="badge badge-blue">פתוח</span>'}</td>
    </tr>`
  }).join('')}
</table>` : ''}

${unexpectedExpenses.length > 0 ? `
<h2>⚡ הוצאות לא צפויות</h2>
<table>
  <tr><th>תיאור</th><th>קטגוריה</th><th>תאריך</th><th>סכום</th><th>לאדם</th></tr>
  ${unexpectedExpenses.map(e => `<tr>
    <td>${e.description}</td>
    <td>${CAT_HE[e.category]||e.category}</td>
    <td>${fmtDate(e.planned_date||e.created_at)}</td>
    <td>${fmt(getEurAmount(e))}</td>
    <td>${fmt(getEurAmount(e)/N)}</td>
  </tr>`).join('')}
  <tr class="total"><td colspan="3">סה"כ</td><td>${fmt(unexpectedExpenses.reduce((s,e)=>s+getEurAmount(e),0))}</td><td>${fmt(unexpectedExpenses.reduce((s,e)=>s+getEurAmount(e),0)/N)}</td></tr>
</table>` : ''}

<h2 class="page-break">👥 פירוט לאדם</h2>
${participants.map(p => {
  const b = balances[p.id] || { owes: 0 }
  const col = getCollectedAmount(kittyCollections, p.id, p)
  const netToCollect = Math.round(b.owes * 100) / 100
  const myExpenses = expenses.filter(e => e.paid_by === p.id)
  const totalPaid = myExpenses.reduce((s,e) => s + getEurAmount(e), 0)
  const refundsTotal = kittyRefunds.filter(r => r.participant_id === p.id).reduce((s,r) => s+r.amount, 0)
  return `
  <h3>${p.name}${p.is_gil?' ⭐':''}${p.joined_late?' (הצטרף מאוחר)':''}</h3>
  <div class="grid4" style="margin-bottom:4px">
    <div class="card"><div class="card-label">חלק בהוצאות</div><div class="card-value" style="font-size:14px">${fmt(netToCollect)}</div></div>
    <div class="card"><div class="card-label">גויס ממנו</div><div class="card-value" style="font-size:14px">${fmt(col)}</div></div>
    <div class="card"><div class="card-label">שילם ישירות</div><div class="card-value" style="font-size:14px">${fmt(totalPaid)}</div></div>
    <div class="card"><div class="card-label">קיבל החזר</div><div class="card-value" style="font-size:14px">${fmt(refundsTotal)}</div></div>
  </div>
  ${myExpenses.length > 0 ? `<p style="font-size:11px;color:#64748b;margin:2px 0">הוצאות שמימן: ${myExpenses.map(e=>e.description).join(', ')}</p>` : ''}
  `
}).join('')}

${(shoppingItems||[]).length > 0 ? `
<h2>🛒 רשימת קניות</h2>
<div class="grid2">
  <div>
    <h3>נרכש (${(shoppingItems||[]).filter(i=>i.checked).length} פריטים)</h3>
    <table>
      <tr><th>מוצר</th><th>כמות</th></tr>
      ${(shoppingItems||[]).filter(i=>i.checked).map(i=>`<tr><td>${i.name_he||i.name}</td><td>${i.quantity||'—'}</td></tr>`).join('')}
    </table>
  </div>
  <div>
    <h3>לא נרכש (${(shoppingItems||[]).filter(i=>!i.checked).length} פריטים)</h3>
    <table>
      <tr><th>מוצר</th><th>כמות</th></tr>
      ${(shoppingItems||[]).filter(i=>!i.checked).map(i=>`<tr><td>${i.name_he||i.name}</td><td>${i.quantity||'—'}</td></tr>`).join('')}
    </table>
  </div>
</div>` : ''}

${leftovers.length > 0 ? `
<h2>📦 שאריות שהושארו ביאכטה</h2>
<table>
  <tr><th>מוצר</th><th>קטגוריה</th><th>כמות</th></tr>
  ${leftovers.map(i=>`<tr><td>${i.name}</td><td>${CAT_HE[i.category]||i.category}</td><td>${i.quantity||'—'}</td></tr>`).join('')}
</table>` : ''}

${notes.length > 0 ? `
<h2>💡 תובנות מהשייט</h2>
${notes.map(n=>`<div class="note-block">
  <p style="font-size:11px;color:#94a3b8;margin:0 0 4px">${fmtDate(n.created_at)}</p>
  <p style="margin:0">${n.content}</p>
</div>`).join('')}` : ''}

<script>window.onload = () => window.print()</script>
</body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
  }

  const copyForAI = async () => {
    setCopying(true)
    const { notes, leftovers, expenseItems } = await collectReportData()
    const { fmt, fmtDate, totalCollected, N, catBreakdown, byDay, days, numDays, avgDaily, estimateExpenses, unexpectedExpenses, crewNames } = buildReportSections(notes, leftovers, expenseItems)

    const tripTitle = `שייט ${trip.destination || ''} ${trip.year || ''} — ${trip.name || ''}`

    const lines = []
    lines.push(`# ${tripTitle}`)
    lines.push(`**צוות:** ${crewNames}`)
    lines.push(`**תאריך הפקת הדוח:** ${new Date().toLocaleDateString('he-IL')}`)
    lines.push(`**מספר ימי שייט (עם הוצאות):** ${numDays}`)
    lines.push('')

    lines.push('## סיכום כספי')
    lines.push(`- סך כל ההוצאות: ${fmt(totalExpenses + yachtTotal + unexpectedExpenses.reduce((s,e)=>s+getEurAmount(e),0))}`)
    lines.push(`- יאכטה: ${fmt(yachtTotal)}`)
    lines.push(`- הוצאות שוטפות: ${fmt(totalExpenses)}`)
    lines.push(`- הוצאות לא צפויות: ${fmt(unexpectedExpenses.reduce((s,e)=>s+getEurAmount(e),0))}`)
    lines.push(`- עלות לאדם (ללא לא צפויות): ${fmt((totalExpenses + yachtTotal)/N)}`)
    lines.push(`- ממוצע יומי: ${fmt(avgDaily)}`)
    lines.push(`- סך גיוסים: ${fmt(totalCollected)}`)
    lines.push('')

    lines.push('## פירוט לפי קטגוריה')
    Object.entries(catBreakdown).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt]) => {
      lines.push(`- ${cat}: ${fmt(amt)} (${Math.round(amt/(totalExpenses+yachtTotal)*100)}%, לאדם: ${fmt(amt/N)})`)
    })
    lines.push('')

    lines.push('## פירוט יומי')
    days.forEach(day => {
      const dayExp = expenses.filter(e => (e.planned_date||e.created_at||'').slice(0,10) === day)
      lines.push(`- ${fmtDate(day)}: ${fmt(byDay[day])} — ${dayExp.map(e=>e.description).join(', ')}`)
    })
    lines.push('')

    lines.push('## כל ההוצאות (כרונולוגי)')
    ;[...expenses].sort((a,b)=>(a.planned_date||a.created_at||'').localeCompare(b.planned_date||b.created_at||'')).forEach(e => {
      const payer = participants.find(p => p.id === e.paid_by)
      const tags = [e.is_estimate?'הערכה':null, e.is_unexpected?'לא צפוי':null, e.is_yacht_cost?'יאכטה':null, e.is_cash?'מזומן':null].filter(Boolean)
      lines.push(`- ${e.description} | ${CAT_HE[e.category]||e.category} | ${fmtDate(e.planned_date||e.created_at)} | ${fmt(getEurAmount(e))}${payer?` | שולם ע"י ${payer.name}`:''}${tags.length?` | [${tags.join(', ')}]`:''}${e.notes?` | הערה: ${e.notes}`:''}`)
    })
    lines.push('')

    if (estimateExpenses.length > 0) {
      lines.push('## הערכות מול בפועל')
      estimateExpenses.forEach(e => {
        const diff = e.actual_amount != null ? e.actual_amount - e.amount : null
        lines.push(`- ${e.description}: תקציב ${fmt(e.amount)}, בפועל ${e.actual_amount!=null?fmt(e.actual_amount):'לא נסגר'}, סטייה: ${diff==null?'—':diff>0?`+${fmt(diff)}`:fmt(diff)} | ${e.is_finalized?'סגור':'פתוח'}`)
      })
      lines.push('')
    }

    if (unexpectedExpenses.length > 0) {
      lines.push('## הוצאות לא צפויות')
      unexpectedExpenses.forEach(e => {
        lines.push(`- ${e.description}: ${fmt(getEurAmount(e))} (לאדם: ${fmt(getEurAmount(e)/N)})`)
      })
      lines.push('')
    }

    lines.push('## פירוט לאדם')
    participants.forEach(p => {
      const b = balances[p.id] || { owes: 0 }
      const col = getCollectedAmount(kittyCollections, p.id, p)
      const netToCollect = Math.round(b.owes * 100) / 100
      const myExpenses = expenses.filter(e => e.paid_by === p.id)
      const totalPaid = myExpenses.reduce((s,e) => s + getEurAmount(e), 0)
      const refundsTotal = kittyRefunds.filter(r => r.participant_id === p.id).reduce((s,r) => s+r.amount, 0)
      lines.push(`### ${p.name}${p.is_gil?' (גיל - משלם ×2 על יאכטה)':''}${p.joined_late?' (הצטרף מאוחר)':''}`)
      lines.push(`- חלק בהוצאות: ${fmt(netToCollect)}`)
      lines.push(`- גויס ממנו: ${fmt(col)}`)
      lines.push(`- שילם ישירות: ${fmt(totalPaid)}`)
      lines.push(`- קיבל החזר: ${fmt(refundsTotal)}`)
      if (myExpenses.length > 0) lines.push(`- הוצאות שמימן: ${myExpenses.map(e=>e.description).join(', ')}`)
      lines.push('')
    })

    if ((shoppingItems||[]).length > 0) {
      lines.push('## רשימת קניות')
      const purchased = (shoppingItems||[]).filter(i=>i.checked)
      const remaining = (shoppingItems||[]).filter(i=>!i.checked)
      if (purchased.length > 0) {
        lines.push(`### נרכש (${purchased.length} פריטים)`)
        purchased.forEach(i => lines.push(`- ${i.name_he||i.name}${i.quantity?` (${i.quantity})`:''}` ))
      }
      if (remaining.length > 0) {
        lines.push(`### לא נרכש (${remaining.length} פריטים)`)
        remaining.forEach(i => lines.push(`- ${i.name_he||i.name}${i.quantity?` (${i.quantity})`:''}`))
      }
      lines.push('')
    }

    if (leftovers.length > 0) {
      lines.push('## שאריות שהושארו ביאכטה')
      leftovers.forEach(i => lines.push(`- ${i.name}${i.quantity?` (${i.quantity})`:''}  | ${CAT_HE[i.category]||i.category}`))
      lines.push('')
    }

    if (notes.length > 0) {
      lines.push('## תובנות מהשייט')
      notes.forEach(n => lines.push(`### ${fmtDate(n.created_at)}\n${n.content}`))
      lines.push('')
    }

    await navigator.clipboard.writeText(lines.join('\n'))
    setCopying(false)
    setTimeout(() => setCopying(false), 2000)
  }

  return (
    <div className="p-4 space-y-4">

      {/* Export buttons */}
      <div className="flex gap-2">
        <button
          onClick={generatePDF}
          disabled={generating}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700 disabled:opacity-50"
        >
          <FileText size={16} />
          {generating ? '...' : (isHe ? 'הורד דוח PDF' : 'PDF Report')}
        </button>
        <button
          onClick={copyForAI}
          disabled={copying}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 text-white font-semibold text-sm active:bg-violet-700 disabled:opacity-50"
        >
          {copying ? <Check size={16} /> : <Clipboard size={16} />}
          {copying ? (isHe ? 'הועתק!' : 'Copied!') : (isHe ? 'העתק לקלוד / AI' : 'Copy for AI')}
        </button>
      </div>

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

        // Chronological debt ledger — group collections by date so split rows appear as one payment
        const collectionsByDate = {}
        myCollections.forEach(c => {
          const key = c.collected_at || 'no-date'
          if (!collectionsByDate[key]) {
            collectionsByDate[key] = { date: c.collected_at || '', type: 'collection', label: '', amount: 0 }
          }
          collectionsByDate[key].amount += c.amount
          if (c.round_name && !collectionsByDate[key].label) collectionsByDate[key].label = c.round_name
        })
        const ledgerEvents = [
          ...Object.values(collectionsByDate).map(e => ({ ...e, amount: Math.round(e.amount * 100) / 100, label: e.label || (isHe ? 'גיוס' : 'Collection') })),
          ...allRefunds.map(r => ({
            date: r.refund_date || (r.created_at || '').slice(0, 10),
            type: 'refund',
            amount: r.amount,
            label: isHe ? 'החזר מהקופה' : 'Kitty refund',
            signature: r.signature,
          })),
        ].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        let bal = netToCollect
        const ledger = ledgerEvents.map(event => {
          const balBefore = Math.round(bal * 100) / 100
          if (event.type === 'collection') bal -= event.amount
          else bal += event.amount
          const balAfter = Math.round(bal * 100) / 100
          return { ...event, balBefore, balAfter }
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
                <div className="px-4 pb-3 space-y-2">

                  {/* Opening */}
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-500">{isHe ? 'נטו לגיוס' : 'Net to collect'}</span>
                    <span className="text-xs font-black text-red-500">{formatCurrency(netToCollect, 'EUR')}</span>
                  </div>

                  {ledger.map((event, idx) => {
                    const dateStr = event.date
                      ? new Date(event.date).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })
                      : ''
                    const overpaidCollection = event.type === 'collection' && event.balBefore > 0.5 && event.amount > event.balBefore + 0.5
                    const exactCollection    = event.type === 'collection' && event.balBefore > 0.5 && Math.abs(event.amount - event.balBefore) <= 0.5
                    const partialCollection  = event.type === 'collection' && event.balBefore > 0.5 && event.amount < event.balBefore - 0.5
                    const overRefund         = event.type === 'refund' && event.balBefore < -0.5 && event.amount > Math.abs(event.balBefore) + 0.5
                    const exactRefund        = event.type === 'refund' && event.balBefore < -0.5 && Math.abs(event.amount - Math.abs(event.balBefore)) <= 0.5
                    const partialRefund      = event.type === 'refund' && event.balBefore < -0.5 && event.amount < Math.abs(event.balBefore) - 0.5

                    return (
                      <div key={idx} className="space-y-1 border-b border-gray-50 pb-2 last:border-0 last:pb-0">

                        {/* Event header */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-600">
                            {event.type === 'collection' ? '💰' : '↩'} {event.label}
                            {dateStr && <span className="text-gray-300 font-normal ms-1.5">· {dateStr}</span>}
                          </span>
                          <span className={`text-xs font-bold flex-shrink-0 ${event.type === 'collection' ? 'text-blue-600' : 'text-orange-500'}`}>
                            {formatCurrency(event.amount, 'EUR')}
                          </span>
                        </div>

                        {/* Collection statuses */}
                        {exactCollection && (
                          <div className="text-xs text-emerald-500 font-semibold">✓ {isHe ? 'שולם בדיוק — מסולק' : 'Paid exactly — settled'}</div>
                        )}
                        {overpaidCollection && (
                          <div className="space-y-0.5">
                            <div className="text-xs text-orange-500">
                              {isHe
                                ? `שילם יותר מהיעד — עודף ${formatCurrency(event.amount - event.balBefore, 'EUR')}`
                                : `Overpaid — excess ${formatCurrency(event.amount - event.balBefore, 'EUR')}`}
                            </div>
                            <div className="text-xs font-semibold text-emerald-500">
                              {isHe ? `קופה חייבת לו: ${formatCurrency(Math.abs(event.balAfter), 'EUR')}` : `Kitty owes: ${formatCurrency(Math.abs(event.balAfter), 'EUR')}`}
                            </div>
                          </div>
                        )}
                        {partialCollection && (
                          <div className="text-xs text-red-400">
                            {isHe ? `נשאר חייב לקופה: ${formatCurrency(event.balAfter, 'EUR')}` : `Still owes kitty: ${formatCurrency(event.balAfter, 'EUR')}`}
                          </div>
                        )}

                        {/* Refund statuses */}
                        {exactRefund && (
                          <div className="space-y-1">
                            <div className="text-xs text-emerald-500 font-semibold">✓ {isHe ? 'חוב הקופה סולק' : 'Kitty debt settled'}</div>
                            {event.signature && <img src={event.signature} alt="sig" className="max-h-14 rounded-lg border border-gray-100 mt-1" />}
                          </div>
                        )}
                        {overRefund && (
                          <div className="space-y-0.5">
                            <div className="text-xs text-orange-500">
                              {isHe
                                ? `שולם יותר מהחוב — חוב הקופה היה ${formatCurrency(Math.abs(event.balBefore), 'EUR')}`
                                : `Over-refunded — kitty owed ${formatCurrency(Math.abs(event.balBefore), 'EUR')}`}
                            </div>
                            <div className="text-xs font-semibold text-red-500">
                              {isHe ? `כעת חייב לקופה: ${formatCurrency(event.balAfter, 'EUR')}` : `Now owes kitty: ${formatCurrency(event.balAfter, 'EUR')}`}
                            </div>
                            {event.signature && <img src={event.signature} alt="sig" className="max-h-14 rounded-lg border border-gray-100 mt-1" />}
                          </div>
                        )}
                        {partialRefund && (
                          <div className="text-xs text-emerald-400">
                            {isHe ? `נשאר חוב הקופה: ${formatCurrency(Math.abs(event.balAfter), 'EUR')}` : `Kitty still owes: ${formatCurrency(Math.abs(event.balAfter), 'EUR')}`}
                          </div>
                        )}

                      </div>
                    )
                  })}
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
