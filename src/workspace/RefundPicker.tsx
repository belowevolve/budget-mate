import { wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { useMemo, useRef } from 'react'
import { useCategoryCatalog } from '../categories/categoryContext'
import { categoryDefinition } from '../categories/catalog'
import Entry from '../components/journal/Entry'
import { groupJournalEntries } from '../components/journal/model'
import { VirtualOperationList } from '../components/journal/VirtualOperationList'
import { DialogBody } from '../shared/ui/DialogSurface'
import { Button } from '../shared/ui/Button'
import { DialogActions } from '../shared/ui/DialogActions'
import { DialogHeader } from '../shared/ui/DialogHeader'
import SearchField from '../shared/ui/SearchField'
import { banks, money, type Transaction } from '../finance'
import { operationTitle } from '../operationPresentation'
import { refundCandidates, type RefundIndex } from '../refunds'
import { formatDate } from '../shared/format'
import { reatomRefundPicker } from './refundPickerModel'
import { BodyText, ErrorText } from '../shared/ui/Text'

type RefundPickerProps = {
  row: Transaction
  transactions: Transaction[]
  refunds: RefundIndex
  pending: boolean
  error?: string
  onSave: (expenseId: string | null) => Promise<void>
  onBack: () => void
}

export default reatomFactoryComponent<RefundPickerProps>(({ row, refunds }) => {
  const model = reatomRefundPicker(refunds.byIncome.get(row.id)?.id)

  return function RefundPicker({ row, transactions, refunds, pending, error, onSave, onBack }) {
    const catalog = useCategoryCatalog()
    const scrollRef = useRef<HTMLDivElement>(null)
    const candidates = useMemo(() => refundCandidates(transactions, row, refunds), [transactions, row, refunds])
    const query = model.query()
    const selectedId = model.selectedId()
    const search = model.search()
    const currentTarget = refunds.byIncome.get(row.id)
    const selected = candidates.find(({ row: candidate }) => candidate.id === selectedId)
    const remainingExpense = useMemo(() => new Map(candidates.map(({ row, availableMinor }) => [row.id, -availableMinor])), [candidates])
    const groups = useMemo(() => groupJournalEntries(candidates.filter(({ row: expense, availableMinor }) => {
      if (!search.text) return true
      const { amount } = search
      if (amount !== undefined && [availableMinor, -expense.amountMinor].some((value) => (value / 100).toFixed(2).startsWith(amount))) return true
      return `${operationTitle(expense)} ${formatDate(expense.date)} ${banks[expense.bank]} ${categoryDefinition(catalog, expense.category).label}`.toLowerCase().includes(search.text)
    })), [candidates, catalog, search])
    const select = wrap((expense: Transaction) => {
      if (pending) return
      if (expense.id === currentTarget?.id) void onSave(null)
      else model.selectExpense(expense.id)
    })

    return (
      <>
        <div className="grid min-w-0 gap-2">
          <DialogHeader title="К расходу" closeDisabled={pending}
            description={`Поступление ${money(row.amountMinor, row.currency, true)} · ${formatDate(row.date)}`} />
          <SearchField label="Поиск расхода" value={query} onChange={wrap(model.setQuery)} disabled={pending} />
          {currentTarget && <p className="text-xs text-muted">Нажми на связанный расход, чтобы отвязать его.</p>}
        </div>
        <DialogBody ref={scrollRef}>
          {groups.length > 0 ? (
            <VirtualOperationList groups={groups} scrollRef={scrollRef} ariaLabel="Подходящие расходы"
              resetKey={query}
              renderEntry={(entry) => <Entry {...entry} onSelect={select} exactAmount
                selection={{ selected: entry.row.id === selectedId, disabled: pending, linked: entry.row.id === currentTarget?.id,
                  amountMinor: remainingExpense.get(entry.row.id) }} />}
            />
          ) : <BodyText>{search.text ? 'Поиск ничего не нашёл.' : 'Нет подходящих расходов на эту сумму.'}</BodyText>}
        </DialogBody>
        <div className="grid min-w-0 gap-1.5">
          {error && <ErrorText role="alert">{error}</ErrorText>}
          <DialogActions>
            <Button variant="secondary" disabled={pending} onClick={wrap(onBack)}>К операции</Button>
            <Button disabled={!selected || selected.row.id === currentTarget?.id || pending}
              onClick={wrap(() => { if (selected) return onSave(selected.row.id) })}>{currentTarget ? 'Сохранить' : 'Привязать'}</Button>
          </DialogActions>
        </div>
      </>
    )
  }
}, 'RefundPicker')
