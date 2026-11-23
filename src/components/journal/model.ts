import { action, atom, computed } from '@reatom/core'
import { categoryDefinition, defaultCategoryCatalog, kindForAmount } from '../../categories/catalog'
import { banks, isTechnicalCreditEntry, needsTransferReview, summarize, transactionAccountingAmount, type Category, type Transaction } from '../../finance'
import { operationTitle } from '../../operationPresentation'
import type { RefundIndex } from '../../refunds'
import type { BankId } from '../../statements/types'

export const journalTabs = [
  { value: 'activity', label: 'Все' },
  { value: 'expense', label: 'Расходы' },
  { value: 'income', label: 'Доходы' },
  { value: 'transfer', label: 'Переводы' },
] as const

export type OperationKind = 'expense' | 'income' | 'transfer'
export type JournalKind = 'activity' | OperationKind | 'review'
export type TransferScope = 'all' | 'own' | 'review'
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

export interface JournalSelection {
  kinds: OperationKind[]
  banks: BankId[]
  categories: Category[]
  transferScope: TransferScope
  query: string
}

export function reatomJournal(initial: JournalFilter) {
  const firstKind = initial.kind === 'review' ? 'transfer' : initial.kind
  const kinds = atom<OperationKind[]>(firstKind && firstKind !== 'activity' ? [firstKind] : [], 'journal.kinds')
  const selectedBanks = atom<BankId[]>([], 'journal.banks')
  const categories = atom<Category[]>(initial.category ? [initial.category] : [], 'journal.categories')
  const transferScope = atom<TransferScope>(initial.kind === 'review' ? 'review' : 'all', 'journal.transferScope')
  const query = atom('', 'journal.query')
  const selection = computed((): JournalSelection => ({
    kinds: kinds(), banks: selectedBanks(), categories: categories(), transferScope: transferScope(), query: query(),
  }), 'journal.selection')

  const setKinds = action((value: OperationKind[]) => {
    kinds.set(value)
    transferScope.set('all')
  }, 'journal.setKinds')

  const setKind = action((value: 'activity' | OperationKind) => {
    setKinds(value === 'activity' ? [] : [value])
    categories.set([])
  }, 'journal.setKind')

  const setBanks = action((value: BankId[]) => selectedBanks.set(value), 'journal.setBanks')

  const setCategories = action((value: Category[]) => categories.set(value), 'journal.setCategories')

  const setTransferScope = action((value: TransferScope) => transferScope.set(value), 'journal.setTransferScope')

  const setQuery = action((value: string) => query.set(value), 'journal.setQuery')

  const clearSelections = action(() => {
    setKinds([])
    setBanks([])
    setCategories([])
  }, 'journal.clearSelections')

  const clearFilters = action(() => {
    clearSelections()
    setQuery('')
  }, 'journal.clearFilters')

  return { selection, setKind, setKinds, setBanks, setCategories, setTransferScope, setQuery, clearSelections, clearFilters }
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

function groupEntries(rows: Transaction[], refunds: RefundIndex) {
  const pairs = new Map<string, Transaction[]>()
  for (const row of rows) {
    if (row.category !== 'transfer' || !row.transferMatchId) continue
    const pair = pairs.get(row.transferMatchId) ?? []
    pair.push(row)
    pairs.set(row.transferMatchId, pair)
  }

  const entries: JournalEntry[] = []
  for (const row of rows) {
    const pair = row.category === 'transfer' && row.transferMatchId ? pairs.get(row.transferMatchId) : undefined
    if (pair?.length === 2 && row.amountMinor > 0) continue
    const counterpart = pair?.length === 2 ? pair.find((other) => other.id !== row.id) : undefined
    entries.push({ row, counterpart, refundTarget: refunds.byIncome.get(row.id), refundMinor: refunds.byExpense.get(row.id)?.totalMinor })
  }
  return groupJournalEntries(entries)
}

function normalizeSearch(text: string) {
  return text.normalize('NFC').toLowerCase().replaceAll('ё', 'е')
}

export function selectJournalRows(rows: Transaction[], selection: JournalSelection, refunds: RefundIndex, catalog = defaultCategoryCatalog) {
  const { kinds, banks: selectedBanks, categories, transferScope, query } = selection
  const search = normalizeSearch(query.trim())
  const numericSearch = search.replace(/[\s₽]/g, '').replace(',', '.').replace(/^[-+−]/, '')
  const searchByAmount = /^\d+(?:\.\d{0,2})?$/.test(numericSearch)
  const bankIds = new Set(selectedBanks)
  const categoryIds = new Set(categories)
  const possibleBankIds = new Set(selectedBanks)
  const possibleCategoryIds = new Set(categories)
  const scope = kinds.length === 1 && kinds[0] === 'transfer' ? transferScope : 'all'
  const filtered: Transaction[] = []
  let reviewCount = 0

  for (const row of rows) {
    if (isTechnicalCreditEntry(row)) continue
    const linked = refunds.byIncome.get(row.id)
    const review = !linked && needsTransferReview(row)
    const kind = linked || review || row.category === 'transfer' ? 'transfer' : kindForAmount(row.amountMinor)
    const category = kind === 'transfer' ? 'transfer' : row.category
    possibleBankIds.add(row.bank)
    if (catalog.get(category)?.kind === kind) possibleCategoryIds.add(category)
    if (bankIds.size && !bankIds.has(row.bank)) continue
    if (review) reviewCount++
    if (kinds.length && !kinds.includes(kind)) continue
    if ((scope === 'review' && !review) || (scope === 'own' && review)) continue
    if (categoryIds.size && !categoryIds.has(category)) continue

    if (!search || (searchByAmount && [row.amountMinor, transactionAccountingAmount(row, refunds)].some((amount) => {
      const units = Math.abs(amount) / 100
      return units.toFixed(2).startsWith(numericSearch)
        || (!numericSearch.includes('.') && String(Math.round(units)).startsWith(numericSearch))
    }))) {
      filtered.push(row)
      continue
    }

    const compensation = linked ? `компенсация расхода ${operationTitle(linked)}` : ''
    const definition = categoryDefinition(catalog, row.category, kindForAmount(row.amountMinor))
    const text = `${compensation} ${operationTitle(row)} ${row.description} ${definition.label} ${banks[row.bank]}`
    if (normalizeSearch(text).includes(search)) filtered.push(row)
  }

  const possibleBanks = [...possibleBankIds].sort((left, right) => banks[left].localeCompare(banks[right], 'ru'))
  const possibleCategories = [...possibleCategoryIds].sort((left, right) =>
    categoryDefinition(catalog, left).label.localeCompare(categoryDefinition(catalog, right).label, 'ru'))
  const groups = groupEntries(filtered, refunds)
  const count = groups.reduce((sum, [, entries]) => sum + entries.length, 0)
  return { groups, count, possibleBanks, possibleCategories, total: summarize(filtered, refunds), reviewCount }
}
