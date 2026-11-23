import { ArrowDownLeft, ArrowDownUp, ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { money } from '../../finance'
import { pluralRu } from '../../shared/format'
import { Panel } from '../../shared/ui/Panel'
import { PendingStatus } from '../../shared/ui/PendingStatus'

function BudgetMetric({ label, icon: Icon, value, featured, negative, className = '', children }: {
  label: string
  icon: LucideIcon
  value: string
  featured?: boolean
  negative?: boolean
  className?: string
  children?: ReactNode
}) {
  const layout = featured ? 'gap-1 bg-summary px-4 py-3 text-on-summary sm:px-5 sm:py-4' : 'gap-0.5 px-3 py-2 sm:px-4'
  const amount = featured
    ? 'text-[clamp(1.75rem,8vw,3.15rem)] leading-[1.08] tracking-[-.06em]'
    : 'text-[clamp(1rem,4.6vw,1.9rem)] leading-tight tracking-tight'

  return (
    <div className={`grid min-w-0 content-center ${layout} ${className}`}>
      <dt className={`flex min-w-0 items-center gap-1.5 text-xs font-bold sm:text-sm ${featured ? 'text-on-summary-muted' : ''}`}>
        <Icon size={19} className="shrink-0" aria-hidden="true" /> {label}
      </dt>
      <dd className="grid min-w-0 gap-1">
        <span className={`font-extrabold wrap-anywhere tabular-nums data-negative:text-danger ${amount}`} data-negative={negative || undefined}>{value}</span>
        {children}
      </dd>
    </div>
  )
}

export function BudgetSummary({ income, expenses, payments, pendingExpenses, currency }: {
  income: number
  expenses: number
  payments: number
  pendingExpenses: number
  currency: string
}) {
  const net = income - expenses

  return (
    <Panel className="overflow-hidden bg-subtle" aria-label="Итоги бюджета">
      <dl className="grid grid-cols-2 min-[701px]:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
        <BudgetMetric label="Расходы" icon={ArrowUpRight} value={money(expenses, currency)} featured className="col-span-full min-[701px]:col-auto">
          <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-on-summary-muted">
            <span>{payments} {pluralRu(payments, 'платёж', 'платежа', 'платежей')}</span>
            {pendingExpenses > 0 && (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true">·</span>
                <PendingStatus className="text-inherit" />
                <span>{money(pendingExpenses, currency)}</span>
              </span>
            )}
          </span>
        </BudgetMetric>
        <BudgetMetric label="Доходы" icon={ArrowDownLeft} value={money(income, currency)} />
        <BudgetMetric label="Разница" icon={ArrowDownUp} value={`${net > 0 ? '+' : ''}${money(net, currency)}`} negative={net < 0}
          className="border-s border-line" />
      </dl>
    </Panel>
  )
}
