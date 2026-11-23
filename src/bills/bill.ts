import { isBudgetTransaction, localDate, type Ledger, type Transaction } from '../finance'

export interface BillPerson {
  id: string
  name: string
}

export interface BillItem {
  id: string
  personId: string
  groupId?: string
  name: string
  priceMinor: number
  quantity: number
}

export type BillItemChanges = Partial<Pick<BillItem, 'name' | 'priceMinor' | 'quantity'>>

export interface Bill {
  id: string
  title: string
  date: string
  currency: string
  people: BillPerson[]
  items: BillItem[]
  expenseId?: string
}

export function billItemGroup(item: BillItem) {
  return item.groupId ?? item.id
}

export const ownerId = 'me'

export function newBill(): Bill {
  return {
    id: crypto.randomUUID(),
    title: '',
    date: localDate(),
    currency: 'RUB',
    people: [{ id: ownerId, name: 'Я' }],
    items: [],
  }
}

export function parseBillPrice(value: string) {
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(value.trim().replace(/\s/g, ''))
  if (!match) return undefined
  const price = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return price > 0 ? price : undefined
}

export function billTotals(bill: Bill) {
  const byPerson = new Map(bill.people.map((person) => [person.id, 0]))
  let total = 0
  for (const item of bill.items) {
    if (!byPerson.has(item.personId)) continue
    const price = item.priceMinor * item.quantity
    byPerson.set(item.personId, (byPerson.get(item.personId) ?? 0) + price)
    total += price
  }
  return { byPerson, total }
}

function matchesExpense(currency: string, amounts: Set<number | undefined>, row: Transaction) {
  return row.amountMinor < 0 && row.currency === currency &&
    amounts.has(-row.amountMinor) && isBudgetTransaction(row)
}

function expenseAmounts(bill: Bill) {
  const { total, byPerson } = billTotals(bill)
  return new Set([total, byPerson.get(ownerId)])
}

export function billExpenseOptions(ledger: Ledger, bill: Bill) {
  const amounts = expenseAmounts(bill)
  const claimed = new Set(ledger.bills?.filter((entry) => entry.id !== bill.id).map((entry) => entry.expenseId))
  return ledger.transactions.filter((row) => !claimed.has(row.id) && matchesExpense(bill.currency, amounts, row))
}

export function saveBill(ledger: Ledger, bill: Bill): Ledger {
  const previous = ledger.bills ?? []
  const saved = previous.find((entry) => entry.id === bill.id)
  const expense = ledger.transactions.find((row) => row.id === saved?.expenseId)
  const record = { ...bill, expenseId: expense && matchesExpense(bill.currency, expenseAmounts(bill), expense) ? expense.id : undefined }
  return { ...ledger, bills: [record, ...previous.filter((entry) => entry.id !== bill.id)] }
}

export function setBillExpense(ledger: Ledger, billId: string, expenseId?: string): Ledger {
  const bills = ledger.bills ?? []
  const bill = bills.find((entry) => entry.id === billId)
  if (!bill) throw new Error('Счёт не найден.')
  if (expenseId) {
    const row = ledger.transactions.find((entry) => entry.id === expenseId)
    if (!row || !matchesExpense(bill.currency, expenseAmounts(bill), row)) throw new Error('Сумма операции изменилась. Выбери другую.')
    if (bills.some((entry) => entry.id !== billId && entry.expenseId === expenseId)) throw new Error('Операция уже привязана к другому счёту.')
  }
  if (bill.expenseId === expenseId) return ledger
  return { ...ledger, bills: bills.map((entry) => entry.id === billId ? { ...entry, expenseId } : entry) }
}
