import { wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { DialogClose, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog'
import { Input } from '@ui-sdk/react/input'
import { X } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useCategoryCatalog } from '../categories/categoryContext'
import { categoryDefinition } from '../categories/catalog'
import Entry from '../components/journal/Entry'
import { groupJournalEntries } from '../components/journal/model'
import { VirtualOperationList } from '../components/journal/VirtualOperationList'
import { SheetGrip } from '../shared/ui/SheetGrip'
import { banks, formatDate, money, type Transaction } from '../finance'
import { operationTitle } from '../operationPresentation'
import { refundCandidates, type RefundIndex } from '../refunds'
import { reatomRefundPicker } from './refundPickerModel'

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
          <div className="dialog-header">
            <SheetGrip />
            <div className="min-w-0">
              <DialogTitle className="text-lg leading-tight">К расходу</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted wrap-anywhere">
                Поступление {money(row.amountMinor, row.currency, true)} · {formatDate(row.date)}
              </DialogDescription>
            </div>
            <DialogClose className="dialog-close" aria-label="Закрыть" disabled={pending}><X size={16} aria-hidden="true" /></DialogClose>
          </div>
          <Input className="field-input min-w-0 text-base" aria-label="Поиск расхода" inputMode="search"
            placeholder="Поиск расхода" value={query} onValueChange={wrap(model.setQuery)} disabled={pending} />
          {currentTarget && <p className="text-xs text-muted">Нажми на связанный расход, чтобы отвязать его.</p>}
        </div>
        <div ref={scrollRef} className="dialog-body" data-slot="scroll">
          {groups.length > 0 ? (
            <VirtualOperationList groups={groups} scrollRef={scrollRef} ariaLabel="Подходящие расходы"
              resetKey={query}
              renderEntry={(entry) => <Entry {...entry} onSelect={select} exactAmount
                selection={{ selected: entry.row.id === selectedId, disabled: pending, linked: entry.row.id === currentTarget?.id,
                  amountMinor: remainingExpense.get(entry.row.id) }} />}
            />
          ) : <p className="body-text">{search.text ? 'Поиск ничего не нашёл.' : 'Нет подходящих расходов на эту сумму.'}</p>}
        </div>
        <div className="grid min-w-0 gap-1.5">
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <Button className="btn-secondary min-w-0 px-2" disabled={pending} onClick={wrap(onBack)}>К операции</Button>
            <Button className="btn-primary min-w-0 flex-1 px-2" disabled={!selected || selected.row.id === currentTarget?.id || pending}
              onClick={wrap(() => { if (selected) return onSave(selected.row.id) })}>{currentTarget ? 'Сохранить' : 'Привязать'}</Button>
          </div>
        </div>
      </>
    )
  }
}, 'RefundPicker')
