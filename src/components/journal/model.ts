import { action, atom, computed } from '@reatom/core'
import { banks, categories, isBudgetTransaction, isTechnicalCreditEntry, needsTransferReview, summarize, transactionAccountingAmount, type Category, type Transaction } from '../../finance'
import { operationTitle } from '../../operationPresentation'
import type { RefundIndex } from '../../refunds'

export const journalTabs = [
  { value: 'activity', label: 'Все' },
  { value: 'expense', label: 'Расходы' },
  { value: 'income', label: 'Доходы' },
  { value: 'transfer', label: 'Переводы' },
] as const

export type JournalKind = typeof journalTabs[number]['value'] | 'review'
export interface JournalFilter {
  kind?: JournalKind
  category?: Category
}

export interface JournalEntry {
  row: Transaction
  counterpart?: Transaction
  refundTarget?: Transaction
  refundMinor?: number
}

export type JournalGroups = [date: string, entries: JournalEntry[]][]

interface JournalSelection {
  kind: JournalKind
  bank: string
  category: string
  query: string
}

export function reatomJournal(initial: JournalFilter) {
  const kind = atom<JournalKind>(initial.kind ?? 'activity', 'journal.kind')
  const bank = atom('all', 'journal.bank')
  const category = atom<string>(initial.category ?? 'all', 'journal.category')
  const query = atom('', 'journal.query')
  const selection = computed(() => ({ kind: kind(), bank: bank(), category: category(), query: query() }), 'journal.selection')

  const setKind = action((value: JournalKind) => {
    kind.set(value)
    category.set('all')
  }, 'journal.setKind')

  const setBank = action((value: string) => {
    bank.set(value)
    category.set('all')
  }, 'journal.setBank')

  const setCategory = action((value: string) => {
    category.set(value)
  }, 'journal.setCategory')

  const setQuery = action((value: string) => {
    query.set(value)
  }, 'journal.setQuery')

  const clearFilters = action(() => {
    bank.set('all')
    category.set('all')
    query.set('')
  }, 'journal.clearFilters')

  return { selection, setKind, setBank, setCategory, setQuery, clearFilters }
}

export type JournalModel = ReturnType<typeof reatomJournal>

export function groupJournalEntries(entries: readonly JournalEntry[]): JournalGroups {
  const groups = new Map<string, JournalEntry[]>()
  for (const entry of entries) {
    const group = groups.get(entry.row.date) ?? []
    group.push(entry)
    groups.set(entry.row.date, group)
  }
  return [...groups]
}

function groupEntries(rows: Transaction[], collapse: boolean, refunds: RefundIndex) {
  const pairs = new Map<string, Transaction[]>()
  if (collapse) {
    for (const row of rows) {
      if (!row.transferMatchId) continue
      const pair = pairs.get(row.transferMatchId) ?? []
      pair.push(row)
      pairs.set(row.transferMatchId, pair)
    }
  }

  const entries: JournalEntry[] = []
  for (const row of rows) {
    const pair = row.transferMatchId ? pairs.get(row.transferMatchId) : undefined
    if (pair?.length === 2 && row.amountMinor > 0) continue
    const counterpart = pair?.length === 2 ? pair.find((other) => other.id !== row.id) : undefined
    entries.push({ row, counterpart, refundTarget: refunds.byIncome.get(row.id), refundMinor: refunds.byExpense.get(row.id)?.totalMinor })
  }
  return groupJournalEntries(entries)
}

export function selectJournalRows(rows: Transaction[], { kind, bank, category, query }: JournalSelection, refunds: RefundIndex) {
  const search = query.trim().toLowerCase()
  const numericSearch = search.replace(/[\s₽]/g, '').replace(',', '.').replace(/^[-+−]/, '')
  const searchByAmount = /^\d+(?:\.\d{0,2})?$/.test(numericSearch)
  const bankRows = bank === 'all' ? rows : rows.filter((row) => row.bank === bank)
  const possibleCategories = [...new Set(bankRows.filter((row) => row.amountMinor < 0 && isBudgetTransaction(row)).map((row) => row.category))]
    .sort((left, right) => categories[left].label.localeCompare(categories[right].label, 'ru'))
  const activeCategory = possibleCategories.includes(category as Category) ? category : 'all'
  const filtered = bankRows.filter((row) => {
    const linked = refunds.byIncome.get(row.id)
    if (kind === 'review') {
      if (linked || !needsTransferReview(row)) return false
    } else if (kind === 'transfer') {
      if (row.category !== 'transfer' || isTechnicalCreditEntry(row)) return false
    } else if (!linked && !isBudgetTransaction(row)) return false
    if (kind === 'expense' && (row.amountMinor >= 0 || (activeCategory !== 'all' && row.category !== activeCategory))) return false
    if (kind === 'income' && (linked || row.amountMinor <= 0)) return false
    if (!search) return true
    if (searchByAmount && [row.amountMinor, transactionAccountingAmount(row, refunds)]
      .some((amount) => (Math.abs(amount) / 100).toFixed(2).startsWith(numericSearch))) return true
    const compensation = linked ? `компенсация расхода ${operationTitle(linked)}` : ''
    return `${compensation} ${operationTitle(row)} ${row.description} ${categories[row.category].label} ${banks[row.bank]}`.toLowerCase().includes(search)
  })
  const groups = groupEntries(filtered, kind === 'transfer', refunds)
  const count = groups.reduce((sum, [, entries]) => sum + entries.length, 0)
  return { groups, count, possibleCategories, activeCategory, total: summarize(filtered, refunds),
    hasUnmatched: rows.some((row) => needsTransferReview(row) && !refunds.byIncome.has(row.id)) }
}
