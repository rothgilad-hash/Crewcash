// Returns the EUR-equivalent of an expense (uses stored eur_rate if available)
export function getEurAmount(expense) {
  if (!expense.eur_rate || expense.currency === 'EUR') return expense.amount
  return expense.amount * expense.eur_rate
}

export function getTotalParts(participants, isYachtCost) {
  if (!isYachtCost) return participants.length
  return participants.reduce((sum, p) => sum + (p.is_gil ? 2 : 1), 0)
}

export function calculateBalances(expenses, participants) {
  const balances = {}
  participants.forEach(p => { balances[p.id] = { paid: 0, owes: 0, net: 0, name: p.name, is_gil: p.is_gil, joined_late: p.joined_late } })

  // Running expenses — split equally among all participants
  const runningExpenses = expenses.filter(e => !e.is_yacht_cost)
  const totalParts = participants.length
  if (totalParts > 0) {
    runningExpenses.forEach(exp => {
      const eurAmt = getEurAmount(exp)
      const partValue = eurAmt / totalParts
      participants.forEach(p => { balances[p.id].owes += partValue })
      // Credit personal payer — they fronted this expense from their own pocket
      if (exp.paid_by && balances[exp.paid_by]) {
        balances[exp.paid_by].paid += eurAmt
      }
    })
  }

  // Yacht adjustments for late joiners
  const yachtTotal = expenses.filter(e => e.is_yacht_cost).reduce((s, e) => s + getEurAmount(e), 0)
  if (yachtTotal > 0) {
    const existing = participants.filter(p => !p.joined_late)
    const late = participants.filter(p => p.joined_late)

    if (late.length > 0) {
      const oldParts = existing.reduce((sum, p) => sum + (p.is_gil ? 2 : 1), 0)
      const newParts = participants.reduce((sum, p) => sum + (p.is_gil ? 2 : 1), 0)

      if (oldParts > 0 && newParts > 0) {
        // Existing members get a reduction — they overpaid their yacht share
        existing.forEach(p => {
          const parts = p.is_gil ? 2 : 1
          const overpayment = yachtTotal * parts * (1 / oldParts - 1 / newParts)
          balances[p.id].owes -= overpayment
        })

        // Late joiners owe their yacht share to the economist
        late.forEach(p => {
          const parts = p.is_gil ? 2 : 1
          balances[p.id].owes += (parts / newParts) * yachtTotal
        })
      }
    }
  }

  Object.keys(balances).forEach(id => {
    balances[id].net = Math.round((balances[id].paid - balances[id].owes) * 100) / 100
  })

  return balances
}

export function simplifyDebts(balances) {
  const creditors = []
  const debtors = []

  Object.entries(balances).forEach(([id, b]) => {
    if (b.net > 0.5) creditors.push({ id, amount: b.net, name: b.name })
    else if (b.net < -0.5) debtors.push({ id, amount: -b.net, name: b.name })
  })

  const transactions = []

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.amount - a.amount)
    debtors.sort((a, b) => b.amount - a.amount)

    const creditor = creditors[0]
    const debtor = debtors[0]
    const amount = Math.min(creditor.amount, debtor.amount)

    transactions.push({
      from: debtor.id,
      fromName: debtor.name,
      to: creditor.id,
      toName: creditor.name,
      amount: Math.round(amount)
    })

    creditor.amount -= amount
    debtor.amount -= amount

    if (creditor.amount < 0.5) creditors.shift()
    if (debtor.amount < 0.5) debtors.shift()
  }

  return transactions
}

export function formatCurrency(amount, currency = 'ILS') {
  const symbols = { ILS: '₪', EUR: '€', USD: '$' }
  const sym = symbols[currency] || currency
  return `${sym}${Math.abs(amount).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`
}

export function getCategoryIcon(cat) {
  const icons = {
    yacht: '⛵', fuel: '⛽', food: '🍽️', supermarket: '🛒',
    alcohol: '🍷', transport: '🚕', activities: '🏊', gear: '🎒',
    accommodation: '🏨', health: '💊', insurance: '🛡️', yacht_services: '⚓', other: '💰'
  }
  return icons[cat] || '💰'
}

export function getLeaderboard(expenses, participants) {
  const stats = {}
  participants.forEach(p => {
    stats[p.id] = { name: p.name, totalPaid: 0, alcoholSpend: 0, foodSpend: 0, expenseCount: 0 }
  })

  expenses.forEach(exp => {
    if (exp.paid_by && stats[exp.paid_by]) {
      stats[exp.paid_by].totalPaid += exp.amount
      stats[exp.paid_by].expenseCount += 1
      if (exp.category === 'alcohol') stats[exp.paid_by].alcoholSpend += exp.amount
      if (exp.category === 'food') stats[exp.paid_by].foodSpend += exp.amount
    }
  })

  return Object.values(stats)
}
