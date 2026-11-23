import { useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import { formatMonth, money, transactionAccountingAmount, type Transaction } from '../finance'
import type { RefundIndex } from '../refunds'
import { Panel } from '../shared/ui/Panel'
import { MovementPeriodSummary } from './overview/MovementPeriodSummary'
import './MovementChart.css'

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

function ChartLegendItem({ label, tone }: { label: string; tone: 'expense' | 'income' }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
      <span className={`size-2 rounded-xs ${tone === 'expense' ? 'bg-chart-expense' : 'bg-chart-income'}`} aria-hidden="true" />
      {label}
    </span>
  )
}

function ChartBar({ value, ceiling, tone }: { value: number; ceiling: number; tone: 'expense' | 'income' }) {
  return (
    <span className={`w-[min(13px,32%)] rounded-t data-nonzero:min-h-0.5 ${tone === 'expense' ? 'bg-chart-expense' : 'bg-chart-income'}`}
      data-nonzero={value > 0 || undefined} style={{ height: `${value / ceiling * 100}%` }} />
  )
}

function MovementPeriodButton({ period, selected, ceiling, currency, onSelect }: {
  period: ChartPeriod
  selected: boolean
  ceiling: number
  currency: string
  onSelect: (key: string) => void
}) {
  return (
    <Button
      className="flex h-auto min-h-[calc(var(--track-height)+22px)] w-full min-w-0 flex-col rounded-lg border-0 bg-transparent px-0 pb-0.5 text-muted shadow-none hover:bg-subtle aria-pressed:bg-selected aria-pressed:text-primary"
      aria-label={`${period.name}, расходы ${money(period.expenses, currency)}, поступления ${money(period.income, currency)}`}
      aria-pressed={selected}
      onClick={() => onSelect(period.key)}
    >
      <span className="mb-1 flex h-(--track-height) w-full shrink-0 items-end justify-center gap-0.5" aria-hidden="true">
        <ChartBar value={period.expenses} ceiling={ceiling} tone="expense" />
        <ChartBar value={period.income} ceiling={ceiling} tone="income" />
      </span>
      <span className="w-full overflow-hidden text-center text-[clamp(.53rem,1.21vw,.68rem)] leading-tight font-bold whitespace-nowrap" aria-hidden="true">{period.label}</span>
    </Button>
  )
}

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
        <ChartLegendItem label="Расходы" tone="expense" />
        <ChartLegendItem label="Поступления" tone="income" />
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
            className="movement-chart-grid relative grid list-none auto-cols-fr grid-flow-col rounded-xl p-0"
            aria-label={month ? 'Итоги по интервалам месяца' : 'Итоги по месяцам'}
          >
            {periods.map((period) => (
              <li className="min-w-0" key={period.key}>
                <MovementPeriodButton period={period} selected={selected?.key === period.key} ceiling={ceiling} currency={currency} onSelect={setActivePeriod} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {selected && <MovementPeriodSummary name={selected.name} income={selected.income} expenses={selected.expenses} currency={currency} />}
    </Panel>
  )
}
