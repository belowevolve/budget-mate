import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { Toggle, ToggleGroup } from '@ui-sdk/react/toggle'
import type { Category } from '../../finance'
import type { BankId } from '../../statements/types'
import SearchField, { SearchToolbar } from '../../shared/ui/SearchField'
import { SegmentedControl, SegmentedControlItem } from '../../shared/ui/SegmentedControl'
import { OperationFilterDialog, OperationFilterSummary } from './OperationFilterDialog'
import { journalTabs, type JournalModel, type JournalSelection, type OperationKind, type TransferScope } from './model'

const transferTabs = [
  { value: 'all', label: 'Все' },
  { value: 'own', label: 'Свои и компенсации' },
  { value: 'review', label: 'Неопознанные' },
] as const satisfies readonly { value: TransferScope; label: string }[]
const operationTabs = journalTabs.filter((tab) => tab.value !== 'activity')

function JournalTabs<Value extends string>({ label, value, options, onChange, pendingDot = false }: {
  label: string
  value: Value | null
  options: readonly { value: Value; label: string; pending?: number }[]
  onChange: (value: Value) => void
  pendingDot?: boolean
}) {
  return (
    <SegmentedControl
      aria-label={label}
      value={value}
      onValueChange={wrap((next) => { if (next !== null) onChange(next) })}
    >
      {options.map(({ value, label, pending }) => (
        <SegmentedControlItem key={value} value={value}
          aria-description={pending && pendingDot ? 'Есть неопознанные переводы' : undefined}
        >
          <span className="min-w-0 whitespace-normal wrap-anywhere">{label}</span>
          {!!pending && (pendingDot
            ? <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            : <span className="shrink-0 rounded-md bg-warning-soft px-1 py-0.5 text-[10px] leading-none text-warning">{pending}</span>)}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  )
}

type FiltersProps = {
  model: JournalModel
  selection: JournalSelection
  availableCategories: Category[]
  availableBanks: BankId[]
  reviewCount: number
}

export default reatomComponent<FiltersProps>(function Filters({ model, selection, availableCategories, availableBanks, reviewCount }) {
  const { kinds, banks: selectedBanks, categories, transferScope, query } = selection
  const activeTab = kinds.length > 1 ? null : kinds[0] ?? 'activity'
  const activeKinds = kinds.length > 1 ? operationTabs.filter(({ value }) => kinds.includes(value)).map(({ label }) => label).join(', ') : ''
  return (
    <>
      <JournalTabs label="Тип операций" value={activeTab} onChange={model.setKind} pendingDot
        options={journalTabs.map((tab) => ({ ...tab, pending: tab.value === 'transfer' && activeTab !== 'transfer' ? reviewCount : 0 }))} />
      {activeTab === 'transfer' && (reviewCount > 0 || transferScope !== 'all') && <JournalTabs label="Тип переводов" value={transferScope} onChange={model.setTransferScope}
        options={transferTabs.map((tab) => ({ ...tab, pending: tab.value === 'review' ? reviewCount : 0 }))} />}
      <SearchToolbar>
        <SearchField label="Поиск по операциям" placeholder="Поиск" value={query} onChange={wrap(model.setQuery)} />
        <OperationFilterDialog banks={selectedBanks} categories={categories} availableBanks={availableBanks} availableCategories={availableCategories}
          onBanksChange={wrap(model.setBanks)} onCategoriesChange={wrap(model.setCategories)} onReset={wrap(model.clearSelections)}
          additionalFiltersActive={kinds.length > 0 || transferScope !== 'all'}>
          <div className="grid min-w-0 gap-1">
            <div className="flex justify-between gap-2 text-xs font-bold text-muted">
              <span>Типы операций</span>
              {kinds.length === 0 && <span>Все</span>}
            </div>
            <ToggleGroup<OperationKind> multiple aria-label="Какие операции показать" value={kinds} onValueChange={wrap(model.setKinds)}
              className="grid min-w-0 grid-cols-3 gap-1.5">
              {operationTabs.map(({ value, label }) => (
                <Toggle key={value} value={value} className="h-auto min-h-11 min-w-0 rounded-xl border border-field-line bg-paper px-1 text-xs font-bold text-muted shadow-none hover:bg-subtle data-pressed:border-primary data-pressed:bg-selected data-pressed:text-primary">
                  {label}
                </Toggle>
              ))}
            </ToggleGroup>
          </div>
        </OperationFilterDialog>
      </SearchToolbar>
      <OperationFilterSummary banks={selectedBanks} categories={categories} availableCategories={availableCategories}>
        {activeKinds && <span className="min-w-0">{activeKinds}</span>}
      </OperationFilterSummary>
    </>
  )
}, 'JournalFilters')
