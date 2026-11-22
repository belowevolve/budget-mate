import { action, atom, computed } from '@reatom/core'

export function reatomRefundPicker(initialExpenseId?: string) {
  const query = atom('', 'refundPicker.query')
  const selectedId = atom(initialExpenseId, 'refundPicker.selectedId')
  const search = computed(() => {
    const text = query().trim().toLowerCase()
    const amount = text.replace(/[\s₽]/g, '').replace(',', '.').replace(/^[-+−]/, '')
    return { text, amount: /^\d+(?:\.\d{0,2})?$/.test(amount) ? amount : undefined }
  }, 'refundPicker.search')
  const setQuery = action((text: string) => query.set(text), 'refundPicker.setQuery')
  const selectExpense = action((id: string) => selectedId.set(id), 'refundPicker.selectExpense')
  return { query, selectedId, search, setQuery, selectExpense }
}
