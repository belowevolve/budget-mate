import { Button } from '@ui-sdk/react/button'
import { ArrowDownLeft, ArrowDownUp, ArrowRight, ArrowUpRight, ChevronRight, FileUp } from 'lucide-react'
import { banks, categories, formatDate, isBudgetTransaction, isTechnicalCreditEntry, money, summarize, transactionAccountingAmount } from '../finance'
import type { Category, Transaction } from '../finance'
import { operationTitle } from '../operationPresentation'
import type { RefundIndex } from '../refunds'
import { CategoryIcon } from './CategoryIcon'
import MovementChart from './MovementChart'
import './Overview.css'

const percent = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 0 })
const payments = new Intl.PluralRules('ru-RU')
const paymentForms = { one: 'платёж', few: 'платежа', many: 'платежей', other: 'платежей', zero: 'платежей', two: 'платежа' }

function TransactionList({
  rows, refunds, onSelect,
}: { rows: Transaction[]; refunds: RefundIndex; onSelect?: (row: Transaction) => void }) {
  return (
    <ul className="mt-1 list-none divide-y divide-line p-0">
      {rows.map((row) => {
        const content = (
          <>
            <CategoryIcon category={row.category} />
            <span className="grid min-w-0 gap-0.5">
              <strong className="truncate text-sm font-bold">{operationTitle(row)}</strong>
              <small className="truncate text-xs text-muted">
                {row.status === 'pending' && <span className="font-semibold text-warning">В обработке · </span>}
                {banks[row.bank]} · {formatDate(row.date)}
              </small>
            </span>
            <span className="overview-row-amount font-extrabold">{money(transactionAccountingAmount(row, refunds), row.currency, true)}</span>
          </>
        )
        return (
          <li key={row.id}>
            {onSelect ? (
              <Button className="overview-row hover:bg-subtle" data-operation-trigger={row.id} onClick={() => onSelect(row)}>{content}</Button>
            ) : <div className="overview-row">{content}</div>}
          </li>
        )
      })}
    </ul>
  )
}

function SpendingRow({ category, amount, expenses, currency, onViewCategory }: {
  category: Category; amount: number; expenses: number; currency: string; onViewCategory?: (category: Category) => void
}) {
  const share = amount / expenses
  const result = (
    <>
      <CategoryIcon category={category} />
      <span className="grid min-w-0 gap-1 text-xs sm:text-sm">
        <strong className="font-bold wrap-anywhere">{categories[category].label}</strong>
        <span className="category-accent block h-1 overflow-hidden rounded-full bg-subtle" data-category={category} aria-hidden="true">
          <span className="block h-full min-w-0.5 rounded-full bg-(--category-accent)" style={{ width: `${share * 100}%` }} />
        </span>
      </span>
      <span className="overview-row-amount grid min-w-0 justify-items-end gap-0.5">
        <strong className="font-extrabold">{money(amount, currency, true)}</strong>
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
  rows, refunds, currency, month, onImport, onViewAll, onViewCategory, onSelectTransaction,
}: {
  rows: Transaction[]; refunds: RefundIndex; currency: string; month: string; onImport: () => void
  onViewAll: (view?: 'expense' | 'transfer') => void
  onViewCategory?: (category: Category) => void
  onSelectTransaction?: (row: Transaction) => void
}) {
  const { income, expenses, spending } = summarize(rows, refunds)
  const activity = rows.filter((row) => isBudgetTransaction(row) && !refunds.byIncome.has(row.id))
  const purchases = activity.filter((row) => row.amountMinor < 0)
  const pendingExpenses = purchases.reduce((total, row) => row.status === 'pending' ? total - row.amountMinor : total, 0)
  const hasTransfers = rows.some((row) => row.category === 'transfer' && !isTechnicalCreditEntry(row))
  const net = income - expenses

  return (
    <div className="grid min-w-0 gap-3">
      <section className="surface-panel grid overflow-hidden bg-subtle min-[701px]:grid-cols-[minmax(0,1.09fr)_minmax(0,1fr)]" aria-label="Итоги бюджета">
        <div className="min-w-0 bg-primary-hover px-4 py-3 text-on-primary sm:px-5 sm:py-4">
          <h2 className="overview-summary-label text-on-inverse-muted"><ArrowUpRight size={19} aria-hidden="true" /> Расходы</h2>
          <p className="my-1 text-[clamp(1.75rem,8vw,3.15rem)] leading-[1.08] font-extrabold tracking-[-.06em] wrap-anywhere tabular-nums">
            {money(expenses, currency, true)}
          </p>
          <p className="text-xs text-on-inverse-muted">
            {purchases.length} {paymentForms[payments.select(purchases.length)]}
            {pendingExpenses > 0 && <> · {money(pendingExpenses, currency, true)} в обработке</>}
          </p>
        </div>
        <dl className="grid min-w-0 grid-cols-2 items-center divide-x divide-line py-1.5 text-ink [&>div]:min-w-0 [&>div]:px-3 [&>div]:py-1.5 sm:[&>div]:px-4">
          <div>
            <dt className="overview-summary-label"><ArrowDownLeft size={19} aria-hidden="true" /> Доходы</dt>
            <dd className="overview-summary-amount">{money(income, currency, true)}</dd>
          </div>
          <div>
            <dt className="overview-summary-label"><ArrowDownUp size={19} aria-hidden="true" /> Разница</dt>
            <dd className="overview-summary-amount data-negative:text-danger" data-negative={net < 0 || undefined}>{net > 0 ? '+' : ''}{money(net, currency, true)}</dd>
          </div>
        </dl>
      </section>

      {!activity.length ? (
        <section className="surface-panel empty-card">
          <span className="empty-icon"><FileUp size={27} aria-hidden="true" /></span>
          <h2 className="section-heading">{hasTransfers ? 'Нет доходов и расходов' : 'Операций пока нет'}</h2>
          <Button className="btn-primary" onClick={hasTransfers ? () => onViewAll('transfer') : onImport}>
            {hasTransfers ? 'Открыть переводы' : 'Импортировать PDF'}
          </Button>
        </section>
      ) : (
        <>
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
          {purchases.length > 0 && (
            <section className="surface-panel card-padding" aria-labelledby="recent-title">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2">
                <h2 className="section-heading" id="recent-title">Последние расходы</h2>
                <Button className="btn-text max-sm:px-1 max-sm:text-xs" onClick={() => onViewAll('expense')}>Все <ArrowRight size={16} aria-hidden="true" /></Button>
              </div>
              <TransactionList rows={purchases.slice(0, 4)} refunds={refunds} onSelect={onSelectTransaction} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
