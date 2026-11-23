import { money } from '../../finance'

function PeriodTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[.7rem] font-semibold text-muted">{label}</dt>
      <dd className="text-xs font-extrabold wrap-anywhere tabular-nums">{value}</dd>
    </div>
  )
}

export function MovementPeriodSummary({ name, income, expenses, currency }: {
  name: string
  income: number
  expenses: number
  currency: string
}) {
  return (
    <dl className="mt-2 grid grid-cols-2 items-center gap-x-2 gap-y-1 rounded-xl bg-subtle px-2.5 py-2 text-ink min-[1050px]:grid-cols-3 min-[1050px]:text-center"
      aria-live="polite">
      <div className="col-span-full min-w-0 min-[1050px]:col-auto">
        <dt className="sr-only">Период</dt>
        <dd className="text-xs font-extrabold wrap-anywhere">{name}</dd>
      </div>
      <PeriodTotal label="Расходы" value={money(expenses, currency)} />
      <PeriodTotal label="Поступления" value={money(income, currency)} />
    </dl>
  )
}
