import { Button } from '@ui-sdk/react/button'
import { ArrowDownLeft, ArrowDownUp, ArrowUpRight, ChevronRight, FileUp } from 'lucide-react'
import { useCategoryCatalog } from '../categories/categoryContext'
import { categoryDefinition } from '../categories/catalog'
import { isBudgetTransaction, isTechnicalCreditEntry, money, summarize, transactionAccountingAmount } from '../finance'
import type { Category, Transaction } from '../finance'
import type { RefundIndex } from '../refunds'
import { CategoryIcon } from './CategoryIcon'
import MovementChart from './MovementChart'
import { PendingStatus } from './PendingStatus'
import './Overview.css'

const percent = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 0 })
const payments = new Intl.PluralRules('ru-RU')
const paymentForms = { one: 'платёж', few: 'платежа', many: 'платежей', other: 'платежей', zero: 'платежей', two: 'платежа' }

function SpendingRow({ category, amount, expenses, currency, onViewCategory }: {
  category: Category; amount: number; expenses: number; currency: string; onViewCategory?: (category: Category) => void
}) {
  const definition = categoryDefinition(useCategoryCatalog(), category, 'expense')
  const share = amount / expenses
  const result = (
    <>
      <CategoryIcon category={category} />
      <span className="grid min-w-0 gap-1 text-xs sm:text-sm">
        <strong className="font-bold wrap-anywhere">{definition.label}</strong>
        <span className="category-accent block h-1 overflow-hidden rounded-full bg-subtle" data-category={definition.tone} aria-hidden="true">
          <span className="block h-full min-w-0.5 rounded-full bg-(--category-accent)" style={{ width: `${share * 100}%` }} />
        </span>
      </span>
      <span className="overview-row-amount grid min-w-0 justify-items-end gap-0.5">
        <strong className="font-extrabold">{money(amount, currency)}</strong>
        <small className="text-xs font-semibold text-muted">{share < 0.01 ? '<1%' : percent.format(share)}</small>
      </span>
      {onViewCategory && <ChevronRight className="text-muted" size={16} aria-hidden="true" />}
    </>
  )
  return onViewCategory
    ? <Button className="overview-row grid-cols-[2rem_minmax(0,1fr)_minmax(0,max-content)_1rem] hover:bg-subtle" onClick={() => onViewCategory(category)}>{result}</Button>
    : <div className="overview-row">{result}</div>
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
  const net = income - expenses

  return (
    <div className="grid min-w-0 gap-3">
      <section className="surface-panel grid overflow-hidden bg-subtle min-[701px]:grid-cols-[minmax(0,1.09fr)_minmax(0,1fr)]" aria-label="Итоги бюджета">
        <div className="min-w-0 bg-summary px-4 py-3 text-on-summary sm:px-5 sm:py-4">
          <h2 className="overview-summary-label text-on-summary-muted"><ArrowUpRight size={19} aria-hidden="true" /> Расходы</h2>
          <p className="my-1 text-[clamp(1.75rem,8vw,3.15rem)] leading-[1.08] font-extrabold tracking-[-.06em] wrap-anywhere tabular-nums">
            {money(expenses, currency)}
          </p>
          <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-on-summary-muted">
            <span>{purchases.length} {paymentForms[payments.select(purchases.length)]}</span>
            {pendingExpenses > 0 && (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true">·</span>
                <PendingStatus className="text-inherit" />
                <span>{money(pendingExpenses, currency)}</span>
              </span>
            )}
          </p>
        </div>
        <dl className="grid min-w-0 grid-cols-2 items-center divide-x divide-line py-1.5 text-ink [&>div]:min-w-0 [&>div]:px-3 [&>div]:py-1.5 sm:[&>div]:px-4">
          <div>
            <dt className="overview-summary-label"><ArrowDownLeft size={19} aria-hidden="true" /> Доходы</dt>
            <dd className="overview-summary-amount">{money(income, currency)}</dd>
          </div>
          <div>
            <dt className="overview-summary-label"><ArrowDownUp size={19} aria-hidden="true" /> Разница</dt>
            <dd className="overview-summary-amount data-negative:text-danger" data-negative={net < 0 || undefined}>{net > 0 ? '+' : ''}{money(net, currency)}</dd>
          </div>
        </dl>
      </section>

      {!activity.length ? (
        <section className="surface-panel empty-card">
          <span className="empty-icon"><FileUp size={27} aria-hidden="true" /></span>
          <h2 className="section-heading">{hasTransfers ? 'Нет доходов и расходов' : 'Операций пока нет'}</h2>
          <Button className="btn-primary" onClick={hasTransfers ? onViewTransfers : onImport}>
            {hasTransfers ? 'Открыть переводы' : 'Импортировать PDF'}
          </Button>
        </section>
      ) : (
        <div className="grid min-w-0 items-start gap-3 min-[701px]:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]">
          <section className="surface-panel card-padding" aria-labelledby="spending-title">
            <h2 className="section-heading mb-1" id="spending-title">По категориям</h2>
            {spending.length ? (
              <ul className="list-none divide-y divide-line p-0">
                {spending.map(([category, amount]) => (
                  <li key={category}><SpendingRow category={category} amount={amount} expenses={expenses} currency={currency} onViewCategory={onViewCategory} /></li>
                ))}
              </ul>
            ) : <p className="body-text pt-5 pb-2">За этот период расходов нет.</p>}
          </section>
          <MovementChart key={`${currency}:${month}`} rows={activity} refunds={refunds} currency={currency} month={month} />
        </div>
      )}
    </div>
  )
}
