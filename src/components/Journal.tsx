import { useMemo } from 'react'
import { wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Button } from '../shared/ui/Button'
import { Panel } from '../shared/ui/Panel'
import { useCategoryCatalog } from '../categories/categoryContext'
import { isBudgetTransaction, money, type Transaction } from '../finance'
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
  onChangeCategory: (row: Transaction) => void
  onQuickTransfer?: (row: Transaction) => Promise<void>
}

export default reatomFactoryComponent<JournalProps>(({ initial }) => {
  const model = reatomJournal(initial)
  return function Journal({ rows, currency, editable, periodKey, refunds, onSelect, onRefund, onChangeCategory, onQuickTransfer }) {
    const selection = model.selection()
    const { kinds, banks, categories, transferScope, query } = selection

    const catalog = useCategoryCatalog()
    const view = useMemo(() => selectJournalRows(rows, selection, refunds, catalog), [rows, selection, refunds, catalog])
    const transfersOnly = kinds.length === 1 && kinds[0] === 'transfer'
    const reviewOnly = transfersOnly && transferScope === 'review'
    const hasFilter = Boolean(query || banks.length || categories.length || kinds.length)
    const openDetails = editable ? wrap(onSelect) : undefined
    const openRefund = editable ? wrap(onRefund) : undefined
    const openCategories = editable ? wrap(onChangeCategory) : undefined
    const markTransfer = editable && onQuickTransfer ? wrap(onQuickTransfer) : undefined
    const activateFullSwipe = editable ? (id: string) => {
      const row = rows.find((operation) => operation.id === id)
      if (!row || (!refunds.byIncome.has(id) && !isBudgetTransaction(row))) return false
      const open = row.amountMinor < 0 ? openCategories : isRefundIncome(row) ? openRefund : undefined
      if (!open) return false
      open(row)
      return true
    } : undefined

    return (
      <div className="grid min-w-0 gap-2.5 sm:gap-3">
        <div className="grid min-w-0 gap-2 px-3 sm:px-0">
          <Filters model={model} selection={selection} availableBanks={view.possibleBanks}
            availableCategories={view.possibleCategories} reviewCount={view.reviewCount} />
          {reviewOnly && view.count > 0 && (
            <p className="px-0.5 text-xs text-muted">Не удалось определить, чей это перевод. Выбери категорию или отметь свой перевод. Пока суммы вне итогов.</p>
          )}
          <div aria-live="polite" className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 px-0.5 text-xs font-medium text-muted">
            <span>{transfersOnly ? 'Переводов' : 'Операций'} · {view.count}</span>
            {!transfersOnly && (
              <div className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-0.5 font-bold tabular-nums">
                {view.total.expenses > 0 && <span className="wrap-anywhere" title="Расходы">{money(-view.total.expenses, currency)}</span>}
                {view.total.income > 0 && <span className="text-income wrap-anywhere" title="Доходы">+{money(view.total.income, currency)}</span>}
              </div>
            )}
          </div>
        </div>

        {view.groups.length === 0 && (
          <Panel as="div" className="mx-3 grid justify-items-center gap-2 p-4 text-center sm:mx-0 sm:p-5">
            <p className="text-sm font-bold text-muted">{reviewOnly ? 'Неопознанных переводов нет' : transfersOnly ? 'Переводов и компенсаций нет' : 'Операций нет'}</p>
            {hasFilter && <Button variant="secondary" onClick={wrap(model.clearFilters)}>Сбросить фильтры</Button>}
          </Panel>
        )}

        {view.groups.length > 0 && (
          <JournalSwipe onFullSwipe={activateFullSwipe}>
            <VirtualOperationList className="mx-3 sm:mx-0" groups={view.groups} ariaLabel={reviewOnly ? 'Неопознанные переводы' : transfersOnly ? 'Переводы и компенсации' : 'Операции'}
              resetKey={JSON.stringify([periodKey, selection])}
              renderEntry={(entry) => <Entry {...entry} flush onSelect={openDetails} onRefund={openRefund} onChangeCategory={openCategories}
                onQuickTransfer={markTransfer} />} />
          </JournalSwipe>
        )}
      </div>
    )
  }
}, 'Journal')
