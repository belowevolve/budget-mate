import { action, atom, computed } from '@reatom/core'
import type { Category } from '../finance'
import { parseOperationSearch } from '../shared/operationSearch'
import type { BankId } from '../statements/types'

type ExpenseFilters = { banks: BankId[]; categories: Category[] }

export function reatomRefundPicker(initialExpenseId?: string) {
  const query = atom('', 'refundPicker.query')
  const selectedId = atom(initialExpenseId, 'refundPicker.selectedId')
  const filters = atom<ExpenseFilters>({ banks: [], categories: [] }, 'refundPicker.filters')
  const search = computed(() => parseOperationSearch(query()), 'refundPicker.search')
  const setQuery = action((text: string) => query.set(text), 'refundPicker.setQuery')
  const setBanks = action((banks: BankId[]) => filters.set({ ...filters(), banks }), 'refundPicker.setBanks')
  const setCategories = action((categories: Category[]) => filters.set({ ...filters(), categories }), 'refundPicker.setCategories')
  const clearFilters = action(() => filters.set({ banks: [], categories: [] }), 'refundPicker.clearFilters')
  const selectExpense = action((id: string) => selectedId.set(id), 'refundPicker.selectExpense')
  return { query, selectedId, filters, search, setQuery, setBanks, setCategories, clearFilters, selectExpense }
}
