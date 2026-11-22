import { useMemo, type ReactNode } from 'react'
import { wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { money, needsTransferReview, type Transaction } from '../finance'
import { isRefundIncome, type RefundIndex } from '../refunds'
import { JournalSwipe } from './JournalSwipe'
import Entry from './journal/Entry'
import Filters from './journal/Filters'
import { reatomJournal, selectJournalRows, type JournalFilter } from './journal/model'
import { VirtualOperationList } from './journal/VirtualOperationList'

type JournalProps = {
  rows: Transaction[]
  currency: string
  editable: boolean
  initial: JournalFilter
  periodKey?: string
  refunds: RefundIndex
  onSelect: (row: Transaction) => void
  onRefund: (row: Transaction) => void
  onQuickTransfer?: (row: Transaction) => Promise<void>
  transferSettings?: ReactNode
}

export default reatomFactoryComponent<JournalProps>(({ initial }) => {
  const model = reatomJournal(initial)
  return function Journal({ rows, currency, editable, periodKey, refunds, onSelect, onRefund, onQuickTransfer, transferSettings }) {
    const selection = model.selection()
    const { kind, bank, category, query } = selection

    const view = useMemo(() => selectJournalRows(rows, selection, refunds), [rows, selection, refunds])
    const showTotals = kind !== 'transfer' && kind !== 'review'
    const hasFilter = Boolean(query || bank !== 'all' || view.activeCategory !== 'all')
    const openDetails = editable ? wrap(onSelect) : undefined
    const openRefund = editable ? wrap(onRefund) : undefined
    const markTransfer = editable && onQuickTransfer ? wrap(onQuickTransfer) : undefined
    const refundFromSwipe = openRefund && ((id: string) => {
      const row = rows.find((operation) => operation.id === id)
      if (!row || !isRefundIncome(row) || needsTransferReview(row)) return false
      openRefund(row)
      return true
    })

    return (
      <div className="grid min-w-0 gap-2.5 sm:gap-3">
        <div className="grid min-w-0 gap-2">
          <Filters model={model} kind={kind} bank={bank} query={query} category={view.activeCategory}
            availableCategories={view.possibleCategories} hasUnmatched={view.hasUnmatched} transferSettings={transferSettings} />
          <div aria-live="polite" className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 px-0.5 text-xs font-medium text-muted">
            <span>{showTotals ? 'Операций' : 'Переводов'} · {view.count}</span>
            {showTotals && (
              <div className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-0.5 font-bold tabular-nums">
                {kind !== 'income' && view.total.expenses > 0 && <span className="wrap-anywhere" title="Расходы">{money(-view.total.expenses, currency, true)}</span>}
                {kind !== 'expense' && view.total.income > 0 && <span className="text-income wrap-anywhere" title="Доходы">+{money(view.total.income, currency, true)}</span>}
              </div>
            )}
          </div>
        </div>

        {view.groups.length === 0 && (
          <div className="surface-panel grid justify-items-center gap-2 p-4 text-center sm:p-5">
            <p className="text-sm font-bold text-muted">{kind === 'review' ? 'Нераспознанных переводов нет' : kind === 'transfer' ? 'Переводов нет' : 'Операций нет'}</p>
            {hasFilter && <Button className="btn-secondary" onClick={wrap(model.clearFilters)}>Сбросить фильтры</Button>}
          </div>
        )}

        {view.groups.length > 0 && (
          <JournalSwipe onFullSwipe={refundFromSwipe}>
            <VirtualOperationList groups={view.groups} ariaLabel={showTotals ? 'Операции' : 'Переводы'}
              resetKey={JSON.stringify([periodKey, kind, bank, category, query])}
              renderEntry={(entry) => <Entry {...entry} onSelect={openDetails} onRefund={openRefund} onQuickTransfer={markTransfer} />} />
          </JournalSwipe>
        )}
      </div>
    )
  }
}, 'Journal')
