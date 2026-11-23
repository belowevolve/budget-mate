import { isBudgetTransaction, type Ledger, type Transaction } from './finance'

export interface RefundAllocation {
  incomeId: string
  expenseId: string
}

export interface RefundIndex {
  byIncome: ReadonlyMap<string, Transaction>
  byExpense: ReadonlyMap<string, { totalMinor: number; incomes: Transaction[] }>
}

export class RefundError extends Error {}

export function isRefundIncome(row: Transaction) {
  return row.status !== 'pending' && row.amountMinor > 0 && row.category !== 'transfer'
}

function isRefundExpense(row: Transaction, income: Transaction) {
  return row.amountMinor < 0 && isBudgetTransaction(row) && row.currency === income.currency
}

function refundAllocations(refunds: RefundAllocation[] | undefined) {
  return Array.isArray(refunds) ? refunds.filter((link) => typeof link?.incomeId === 'string' && typeof link.expenseId === 'string') : []
}

export function buildRefundIndex(transactions: Transaction[], allocations?: RefundAllocation[]): RefundIndex {
  const byIncome = new Map<string, Transaction>()
  const byExpense = new Map<string, { totalMinor: number; incomes: Transaction[] }>()
  const links = refundAllocations(allocations)
  if (links.length === 0) return { byIncome, byExpense }

  const rows = new Map(transactions.map((row) => [row.id, row]))
  for (const { incomeId, expenseId } of links) {
    const income = rows.get(incomeId)
    const expense = rows.get(expenseId)
    if (!income || !expense || byIncome.has(incomeId) || !isRefundIncome(income) || !isRefundExpense(expense, income)) continue
    const offsets = byExpense.get(expenseId) ?? { totalMinor: 0, incomes: [] }
    if (offsets.totalMinor + income.amountMinor > -expense.amountMinor) continue
    offsets.totalMinor += income.amountMinor
    offsets.incomes.push(income)
    byExpense.set(expenseId, offsets)
    byIncome.set(incomeId, expense)
  }
  return { byIncome, byExpense }
}

export function refundCandidates(transactions: Transaction[], income: Transaction, refunds: RefundIndex) {
  if (!isRefundIncome(income)) return []
  const current = refunds.byIncome.get(income.id)
  return transactions.flatMap((row) => {
    if (!isRefundExpense(row, income)) return []
    const total = refunds.byExpense.get(row.id)?.totalMinor ?? 0
    const availableMinor = -row.amountMinor - total + (current?.id === row.id ? income.amountMinor : 0)
    return availableMinor >= income.amountMinor ? [{ row, availableMinor }] : []
  }).sort((a, b) => Number(b.row.id === current?.id) - Number(a.row.id === current?.id)
    || b.row.date.localeCompare(a.row.date))
}

export function setRefundAllocation(ledger: Ledger, incomeId: string, expenseId: string | null): Ledger {
  const allocations = refundAllocations(ledger.refunds)
  const before = allocations.find((link) => link.incomeId === incomeId)?.expenseId ?? null
  if (before === expenseId) return ledger
  const refunds = allocations.filter((link) => link.incomeId !== incomeId)
  if (expenseId !== null) {
    const income = ledger.transactions.find((row) => row.id === incomeId)
    const expense = ledger.transactions.find((row) => row.id === expenseId)
    if (!income || !expense || !isRefundIncome(income) || !isRefundExpense(expense, income)) {
      throw new RefundError('Выбери поступление и расход в одной валюте.')
    }
    const current = buildRefundIndex(ledger.transactions, refunds).byExpense.get(expenseId)?.totalMinor ?? 0
    if (current + income.amountMinor > -expense.amountMinor) {
      throw new RefundError('Поступление больше оставшейся суммы расхода.')
    }
    refunds.push({ incomeId, expenseId })
  }
  return { ...ledger, refunds }
}
