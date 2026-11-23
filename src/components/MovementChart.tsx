import { useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import { formatMonth, money, transactionAccountingAmount, type Transaction } from '../finance'
import type { RefundIndex } from '../refunds'
import { Panel } from '../shared/ui/Panel'

interface ChartPeriod {
  key: string
  label: string
  name: string
  income: number
  expenses: number
}

const chartDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const chartMonth = new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' })
const shortMoney = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 })

function periodMonth(date: Date) {
  return date.toISOString().slice(0, 7)
}

function buildChart(rows: Transaction[], month: string, refunds: RefundIndex) {
  const periods: ChartPeriod[] = []
  if (month) {
    const [year, monthNumber] = month.split('-').map(Number)
    const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
    for (let start = 1; start <= days; start += 7) {
      const end = Math.min(start + 6, days)
      periods.push({
        key: String(start),
        label: start === end ? String(start) : `${start}–${end}`,
        name: chartDate.formatRange(new Date(Date.UTC(year, monthNumber - 1, start)), new Date(Date.UTC(year, monthNumber - 1, end))),
        income: 0,
        expenses: 0,
      })
    }
  } else if (rows.length) {
    let earliest = rows[0].date.slice(0, 7)
    let latest = earliest
    for (const row of rows) {
      const date = row.date.slice(0, 7)
      if (date < earliest) earliest = date
      if (date > latest) latest = date
    }
    const [year, monthNumber] = latest.split('-').map(Number)
    for (let offset = 11; offset >= 0; offset--) {
      const date = new Date(Date.UTC(year, monthNumber - 1 - offset, 1))
      const key = periodMonth(date)
      if (key < earliest) continue
      periods.push({ key, label: chartMonth.format(date).replace('.', ''), name: formatMonth(key), income: 0, expenses: 0 })
    }
  }

  for (const row of rows) {
    const day = Number(row.date.slice(8, 10))
    const key = month ? String(Math.floor((day - 1) / 7) * 7 + 1) : row.date.slice(0, 7)
    const bucket = periods.find((period) => period.key === key)
    if (!bucket) continue
    const amount = transactionAccountingAmount(row, refunds)
    if (amount > 0) bucket.income += amount
    else bucket.expenses -= amount
  }
  return periods
}

export default function MovementChart({ rows, refunds, currency, month }: { rows: Transaction[]; refunds: RefundIndex; currency: string; month: string }) {
  const [activePeriod, setActivePeriod] = useState<string>()
  const periods = buildChart(rows, month, refunds)
  const selected = periods.find((period) => period.key === activePeriod) ??
    periods.findLast((period) => period.expenses || period.income) ?? periods[0]
  const peak = Math.max(1, ...periods.flatMap((period) => [period.expenses, period.income]))
  const unit = 10 ** Math.floor(Math.log10(peak))
  const ceiling = Math.ceil(peak / unit * 2) / 2 * unit
  const recentMonthsOnly = !month && rows.some((row) => row.date.slice(0, 7) < periods[0]?.key)

  return (
    <Panel padded aria-labelledby="movement-title">
      <h2 className="section-heading" id="movement-title">
        Движение денег {recentMonthsOnly && <span className="text-xs font-semibold text-muted">· 12 мес.</span>}
      </h2>
      <div className="mt-2 mb-2 flex flex-wrap gap-x-3 gap-y-1">
        <span className="chart-key"><i className="size-2 rounded-xs bg-chart-expense" />Расходы</span>
        <span className="chart-key"><i className="size-2 rounded-xs bg-chart-income" />Поступления</span>
      </div>
      <div
        className="overflow-x-auto overscroll-x-contain scroll-edges-x"
        tabIndex={periods.length > 8 ? 0 : undefined}
        role={periods.length > 8 ? 'region' : undefined}
        aria-label={periods.length > 8 ? 'График по месяцам' : undefined}
      >
        <div className={`grid grid-cols-[auto_minmax(0,1fr)] gap-1.5 [--track-height:5.75rem] ${periods.length > 8 ? 'min-w-[23rem]' : ''}`}>
          <div className="flex h-(--track-height) flex-col items-end justify-between text-[.62rem] tabular-nums text-muted" aria-hidden="true">
            <span>{shortMoney.format(ceiling / 100)}</span>
            <span>{shortMoney.format(ceiling / 200)}</span>
            <span>0</span>
          </div>
          <ul
            className="chart-grid relative grid list-none auto-cols-fr grid-flow-col rounded-xl p-0"
            aria-label={month ? 'Итоги по интервалам месяца' : 'Итоги по месяцам'}
          >
            {periods.map((period) => (
              <li className="min-w-0" key={period.key}>
                <Button
                  className="flex h-auto min-h-[calc(var(--track-height)+22px)] w-full min-w-0 flex-col rounded-lg border-0 bg-transparent px-0 pb-0.5 text-muted shadow-none hover:bg-subtle aria-pressed:bg-selected aria-pressed:text-primary"
                  aria-label={`${period.name}, расходы ${money(period.expenses, currency)}, поступления ${money(period.income, currency)}`}
                  aria-pressed={selected?.key === period.key}
                  onClick={() => setActivePeriod(period.key)}
                >
                  <span className="mb-1 flex h-(--track-height) w-full shrink-0 items-end justify-center gap-0.5" aria-hidden="true">
                    <span className="chart-bar bg-chart-expense" data-nonzero={period.expenses > 0 || undefined} style={{ height: `${period.expenses / ceiling * 100}%` }} />
                    <span className="chart-bar bg-chart-income" data-nonzero={period.income > 0 || undefined} style={{ height: `${period.income / ceiling * 100}%` }} />
                  </span>
                  <span className="w-full overflow-hidden text-center text-[clamp(.53rem,1.21vw,.68rem)] leading-tight font-bold whitespace-nowrap" aria-hidden="true">{period.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {selected && (
        <dl
          className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 rounded-xl bg-subtle px-2.5 py-2 text-ink min-[1050px]:grid-cols-[minmax(0,1.25fr)_repeat(2,minmax(0,1fr))] [&_dd]:text-xs [&_dd]:font-extrabold [&_dd]:wrap-anywhere [&_dd]:tabular-nums [&_dt]:text-[.7rem] [&_dt]:font-semibold [&_dt]:text-muted"
          aria-live="polite"
        >
          <div className="col-span-full min-[1050px]:col-auto"><dt className="sr-only">Период</dt><dd>{selected.name}</dd></div>
          <div><dt>Расходы</dt><dd>{money(selected.expenses, currency)}</dd></div>
          <div><dt>Поступления</dt><dd>{money(selected.income, currency)}</dd></div>
        </dl>
      )}
    </Panel>
  )
}
