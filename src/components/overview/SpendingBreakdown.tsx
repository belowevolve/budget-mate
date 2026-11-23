import { ChevronRight } from 'lucide-react'
import { useCategoryCatalog } from '../../categories/categoryContext'
import { categoryDefinition } from '../../categories/catalog'
import { money, type Category } from '../../finance'
import { Panel } from '../../shared/ui/Panel'
import { RowAction } from '../../shared/ui/RowAction'
import { CategoryAccent, CategoryIcon } from '../CategoryIcon'
import { SectionHeading, BodyText } from '../../shared/ui/Text'

const percent = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 0 })

function SpendingRow({ category, amount, expenses, currency, onViewCategory }: {
  category: Category
  amount: number
  expenses: number
  currency: string
  onViewCategory?: (category: Category) => void
}) {
  const definition = categoryDefinition(useCategoryCatalog(), category, 'expense')
  const share = amount / expenses
  const row = (
    <>
      <CategoryIcon category={category} />
      <span className="grid min-w-0 gap-1 text-xs sm:text-sm">
        <strong className="font-bold wrap-anywhere">{definition.label}</strong>
        <CategoryAccent tone={definition.tone} className="block h-1 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
          <span className="block h-full min-w-0.5 rounded-full bg-(--category-accent)" style={{ width: `${share * 100}%` }} />
        </CategoryAccent>
      </span>
      <span className="grid max-w-[38vw] min-w-0 justify-items-end gap-0.5 text-right text-xs wrap-anywhere tabular-nums sm:max-w-none sm:text-sm">
        <strong className="font-extrabold">{money(amount, currency)}</strong>
        <small className="text-xs font-semibold text-muted">{share < 0.01 ? '<1%' : percent.format(share)}</small>
      </span>
      {onViewCategory && <ChevronRight className="text-muted" size={16} aria-hidden="true" />}
    </>
  )
  const columns = onViewCategory
    ? 'grid-cols-[2rem_minmax(0,1fr)_minmax(0,max-content)_1rem]'
    : 'grid-cols-[2rem_minmax(0,1fr)_minmax(0,max-content)]'
  const layout = `grid min-h-12 items-center gap-2 rounded-none px-3 py-1.5 text-start sm:px-4 ${columns}`
  return onViewCategory
    ? <RowAction className={layout} onClick={() => onViewCategory(category)}>{row}</RowAction>
    : <div className={layout}>{row}</div>
}

export function SpendingBreakdown({ spending, expenses, currency, onViewCategory }: {
  spending: [Category, number][]
  expenses: number
  currency: string
  onViewCategory?: (category: Category) => void
}) {
  return (
    <Panel className="overflow-clip" aria-labelledby="spending-title">
      <SectionHeading className="p-3 sm:p-4" id="spending-title">По категориям</SectionHeading>
      {spending.length ? (
        <ul className="list-none divide-y divide-line border-t border-line p-0">
          {spending.map(([category, amount]) => (
            <li key={category}>
              <SpendingRow category={category} amount={amount} expenses={expenses} currency={currency} onViewCategory={onViewCategory} />
            </li>
          ))}
        </ul>
      ) : <BodyText className="px-3 pb-3 sm:px-4 sm:pb-4">За этот период расходов нет.</BodyText>}
    </Panel>
  )
}
