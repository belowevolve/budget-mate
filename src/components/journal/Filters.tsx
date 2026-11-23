import { useRef, useState } from 'react'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@ui-sdk/react/dialog'
import {
  createSelectController, Select, SelectContent, SelectItem, SelectItemIndicator, SelectLabel, SelectList, SelectTrigger, SelectValue,
} from '@ui-sdk/react/select'
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control'
import { Toggle, ToggleGroup } from '@ui-sdk/react/toggle'
import { Check, SlidersHorizontal } from 'lucide-react'
import { useCategoryCatalog } from '../../categories/categoryContext'
import { categoryDefinition } from '../../categories/catalog'
import { banks, type Category } from '../../finance'
import type { BankId } from '../../statements/types'
import { CategoryIcon } from '../CategoryIcon'
import { cn } from '../../shared/cn'
import { Button, buttonVariants } from '../../shared/ui/Button'
import { ChoiceClear, type ChoiceOption } from '../../shared/ui/Choice'
import { ChoiceTriggerContent } from '../../shared/ui/ChoiceTriggerContent'
import { DialogHeader } from '../../shared/ui/DialogHeader'
import SearchField, { SearchToolbar } from '../../shared/ui/SearchField'
import { SearchSelectList, SelectSearchField } from '../../shared/ui/SearchSelect'
import { SheetGrip } from '../../shared/ui/SheetGrip'
import { useAndroidPopupBack } from '../../shared/ui/popupBack'
import { useDesktopPicker } from '../../shared/ui/useDesktopPicker'
import { journalTabs, type JournalModel, type JournalSelection, type OperationKind, type TransferScope } from './model'

const transferTabs = [
  { value: 'all', label: 'Все' },
  { value: 'own', label: 'Свои и компенсации' },
  { value: 'review', label: 'Неопознанные' },
] as const satisfies readonly { value: TransferScope; label: string }[]
const operationTabs = journalTabs.filter((tab) => tab.value !== 'activity')

function summarizeChoices(labels: string[]) {
  const names = labels.slice(0, 2).join(', ')
  return labels.length > 2 ? `${names} +${labels.length - 2}` : names
}

function JournalTabs<Value extends string>({ label, value, options, onChange, pendingDot = false }: {
  label: string
  value: Value | null
  options: readonly { value: Value; label: string; pending?: number }[]
  onChange: (value: Value) => void
  pendingDot?: boolean
}) {
  return (
    <SegmentedControl
      className="segmented-control"
      aria-label={label}
      value={value}
      onValueChange={wrap((next) => { if (next !== null) onChange(next) })}
    >
      <SegmentedControlIndicator />
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

function MultiChoice<Value extends string>({ label, placeholder, clearLabel, searchLabel, value, options, onChange }: {
  label: string
  placeholder: string
  clearLabel: string
  searchLabel?: string
  value: Value[]
  options: (ChoiceOption & { value: Value })[]
  onChange: (value: Value[]) => void
}) {
  const [controller] = useState(() => createSelectController<Value, true>())
  const searchInput = useRef<HTMLInputElement>(null)
  const watchBack = useAndroidPopupBack(() => { controller.close({ reason: 'back' }) })
  const desktop = useDesktopPicker()
  const search = desktop ? searchLabel : undefined

  return (
    <Select multiple controller={controller} items={options} value={value} presentation={search ? undefined : 'auto'} onValueChange={onChange}
      onOpenChange={watchBack} onOpenChangeComplete={(open) => {
        if (open) searchInput.current?.focus({ preventScroll: true })
      }}>
      <div className="grid min-w-0 gap-1">
        <SelectLabel className="text-xs font-bold text-muted">{label}</SelectLabel>
        <div className="flex min-w-0 items-center gap-2">
          <SelectTrigger className="choice-trigger w-full min-w-0">
            <ChoiceTriggerContent>
              <SelectValue className="min-w-0 flex-1 text-start leading-snug whitespace-normal wrap-anywhere">
                {({ labels }) => summarizeChoices(labels) || placeholder}
              </SelectValue>
            </ChoiceTriggerContent>
          </SelectTrigger>
          <ChoiceClear label={clearLabel} />
        </div>
      </div>
      <SelectContent align="start" sideOffset={7} collisionPadding={10}
        className={search ? 'choice-popover search-select-popover' : 'choice-popover'}>
        {search ? (
          <>
            <SelectSearchField label={search} noResults="Категории не найдены" inputRef={searchInput} />
            <SearchSelectList label={label} options={options} />
          </>
        ) : (
          <>
            <SheetGrip />
            <SelectList>
              {options.map(({ value, label, icon }) => (
                <SelectItem key={value} value={value} label={label} className="choice-item focus-visible:-outline-offset-2">
                  <span className="flex min-w-0 items-center gap-2">{icon}<span>{label}</span></span>
                  <SelectItemIndicator className="shrink-0"><Check size={16} aria-hidden="true" /></SelectItemIndicator>
                </SelectItem>
              ))}
            </SelectList>
          </>
        )}
        <div className="shrink-0 px-0.5 pt-2 pb-3">
          <Button className="w-full" onClick={() => { controller.close() }}>Готово</Button>
        </div>
      </SelectContent>
    </Select>
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
  const catalog = useCategoryCatalog()
  const hasSelections = kinds.length > 0 || selectedBanks.length > 0 || categories.length > 0 || transferScope !== 'all'
  const activeTab = kinds.length > 1 ? null : kinds[0] ?? 'activity'
  const bankChoices = availableBanks.map((value) => ({ value, label: banks[value] }))
  const definitions = availableCategories.map((value) => {
    const definition = categoryDefinition(catalog, value)
    return { value, ...definition, label: value === 'transfer' ? 'Переводы и компенсации' : definition.label }
  })
  const labelCounts = new Map<string, number>()
  for (const { label } of definitions) {
    const key = label.toLowerCase()
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1)
  }
  const categoryChoices = definitions.map(({ value, label, kind }) => ({
    value,
    label: value !== 'transfer' && (labelCounts.get(label.toLowerCase()) ?? 0) > 1 ? `${label} · ${kind === 'income' ? 'доходы' : 'расходы'}` : label,
    icon: <CategoryIcon category={value} className="size-7 rounded-lg" />,
  }))
  const activeLabels = [
    kinds.length > 1 ? operationTabs.filter(({ value }) => kinds.includes(value)).map(({ label }) => label).join(', ') : '',
    summarizeChoices(selectedBanks.map((bank) => banks[bank])),
    summarizeChoices(categoryChoices.filter(({ value }) => categories.includes(value)).map(({ label }) => label)),
  ].filter(Boolean).join(' · ')
  return (
    <>
      <JournalTabs label="Тип операций" value={activeTab} onChange={model.setKind} pendingDot
        options={journalTabs.map((tab) => ({ ...tab, pending: tab.value === 'transfer' && activeTab !== 'transfer' ? reviewCount : 0 }))} />
      {activeTab === 'transfer' && (reviewCount > 0 || transferScope !== 'all') && <JournalTabs label="Тип переводов" value={transferScope} onChange={model.setTransferScope}
        options={transferTabs.map((tab) => ({ ...tab, pending: tab.value === 'review' ? reviewCount : 0 }))} />}
      <SearchToolbar>
        <SearchField label="Поиск по операциям" placeholder="Поиск" value={query} onChange={wrap(model.setQuery)} />
        <Dialog presentation="auto">
          <DialogTrigger aria-label="Фильтры" data-active={hasSelections ? '' : undefined}
            className={cn(buttonVariants({ variant: 'outline', size: 'icon-lg' }), 'rounded-xl')}>
            <SlidersHorizontal aria-hidden="true" />
          </DialogTrigger>
          <DialogContent initialFocus="content" className="compact-dialog grid-rows-[auto_minmax(0,1fr)_auto]">
            <DialogHeader title="Фильтры" />
            <div className="dialog-body grid content-start gap-3" data-slot="scroll">
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
              {bankChoices.length > 0 && (
                <MultiChoice label="Банки" placeholder="Все банки" clearLabel="Сбросить банки" value={selectedBanks}
                  options={bankChoices} onChange={wrap(model.setBanks)} />
              )}
              {categoryChoices.length > 0 && (
                <MultiChoice label="Категории" placeholder="Все категории" clearLabel="Сбросить категории" value={categories}
                  searchLabel="Поиск категорий" options={categoryChoices} onChange={wrap(model.setCategories)} />
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              {hasSelections && <Button variant="text" onClick={wrap(model.clearSelections)}>Сбросить фильтры</Button>}
              <DialogClose className={cn(buttonVariants(), 'grow')} aria-label="Готово, закрыть фильтры">Готово</DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </SearchToolbar>
      {activeLabels && <p className="min-w-0 px-0.5 text-xs leading-snug text-muted wrap-anywhere">{activeLabels}</p>}
    </>
  )
}, 'JournalFilters')
