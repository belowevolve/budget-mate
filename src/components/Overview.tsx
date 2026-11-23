import { Button } from '@ui-sdk/react/button'
import { FileUp } from 'lucide-react'
import { isBudgetTransaction, isTechnicalCreditEntry, summarize, transactionAccountingAmount, type Category, type Transaction } from '../finance'
import type { RefundIndex } from '../refunds'
import { Panel } from '../shared/ui/Panel'
import MovementChart from './MovementChart'
import { BudgetSummary } from './overview/BudgetSummary'
import { SpendingBreakdown } from './overview/SpendingBreakdown'

function EmptyOverview({ hasTransfers, onClick }: { hasTransfers: boolean; onClick: () => void }) {
  return (
    <Panel className="empty-card">
      <span className="empty-icon"><FileUp size={27} aria-hidden="true" /></span>
      <h2 className="section-heading">{hasTransfers ? 'Нет доходов и расходов' : 'Операций пока нет'}</h2>
      <Button className="btn-primary" onClick={onClick}>
        {hasTransfers ? 'Открыть переводы' : 'Импортировать PDF'}
      </Button>
    </Panel>
  )
}

export default function Overview({
  rows, refunds, currency, month, onImport, onViewTransfers, onViewCategory,
}: {
  rows: Transaction[]; refunds: RefundIndex; currency: string; month: string; onImport: () => void
  onViewTransfers: () => void
  onViewCategory?: (category: Category) => void
}) {
  const { income, expenses, spending } = summarize(rows, refunds)
  const activity = rows.filter((row) => isBudgetTransaction(row) && !refunds.byIncome.has(row.id))
  const purchases = activity.filter((row) => row.amountMinor < 0)
  const pendingExpenses = purchases.reduce((total, row) =>
    row.status === 'pending' ? total - transactionAccountingAmount(row, refunds) : total, 0)
  const hasTransfers = rows.some((row) => (row.category === 'transfer' && !isTechnicalCreditEntry(row)) || refunds.byIncome.has(row.id))

  return (
    <div className="grid min-w-0 gap-3">
      <BudgetSummary income={income} expenses={expenses} currency={currency} payments={purchases.length} pendingExpenses={pendingExpenses} />
      {activity.length ? (
        <div className="grid min-w-0 items-start gap-3 min-[701px]:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]">
          <SpendingBreakdown spending={spending} expenses={expenses} currency={currency} onViewCategory={onViewCategory} />
          <MovementChart key={`${currency}:${month}`} rows={activity} refunds={refunds} currency={currency} month={month} />
        </div>
      ) : <EmptyOverview hasTransfers={hasTransfers} onClick={hasTransfers ? onViewTransfers : onImport} />}
    </div>
  )
}
