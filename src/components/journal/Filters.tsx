import { useState } from 'react'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog'
import {
  createSelectController, Select, SelectClear, SelectContent, SelectItem, SelectItemIndicator, SelectLabel, SelectList, SelectTrigger, SelectValue,
} from '@ui-sdk/react/select'
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control'
import { Toggle, ToggleGroup } from '@ui-sdk/react/toggle'
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { useCategoryCatalog } from '../../categories/categoryContext'
import { categoryDefinition } from '../../categories/catalog'
import { banks, type Category } from '../../finance'
import type { BankId } from '../../statements/types'
import { CategoryIcon } from '../CategoryIcon'
import type { ChoiceOption } from '../Choice'
import SearchField from '../SearchField'
import { SheetGrip } from '../SheetGrip'
import { useAndroidPickerBack } from '../useDialogBack'
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

function MultiChoice<Value extends string>({ label, placeholder, clearLabel, value, options, onChange }: {
  label: string
  placeholder: string
  clearLabel: string
  value: Value[]
  options: (ChoiceOption & { value: Value })[]
  onChange: (value: Value[]) => void
}) {
  const [controller] = useState(() => createSelectController<Value, true>())
  const watchBack = useAndroidPickerBack(() => { controller.close({ reason: 'back' }) })

  return (
    <Select multiple controller={controller} items={options} value={value} presentation="auto" onValueChange={onChange}
      onOpenChange={watchBack}>
      <div className="grid min-w-0 gap-1">
        <SelectLabel className="text-xs font-bold text-muted">{label}</SelectLabel>
        <div className="flex min-w-0 items-center gap-2">
          <SelectTrigger className="choice-trigger w-full min-w-0">
            <SelectValue className="min-w-0 flex-1 text-left leading-snug whitespace-normal wrap-anywhere">
              {({ labels }) => summarizeChoices(labels) || placeholder}
            </SelectValue>
            <ChevronDown size={16} className="shrink-0 opacity-80" aria-hidden="true" />
          </SelectTrigger>
          <SelectClear className="btn-icon size-11 rounded-xl" aria-label={clearLabel}>
            <X size={17} aria-hidden="true" />
          </SelectClear>
        </div>
      </div>
      <SelectContent align="start" sideOffset={7} collisionPadding={10} className="choice-popover">
        <SheetGrip />
        <SelectList>
          {options.map(({ value, label, icon }) => (
            <SelectItem key={value} value={value} label={label} className="choice-item focus-visible:outline-offset-[-2px]">
              <span className="flex min-w-0 items-center gap-2">{icon}<span>{label}</span></span>
              <SelectItemIndicator className="shrink-0"><Check size={16} aria-hidden="true" /></SelectItemIndicator>
            </SelectItem>
          ))}
        </SelectList>
        <div className="shrink-0 px-0.5 pt-2 pb-3">
          <Button className="btn-primary w-full" onClick={() => { controller.close() }}>Готово</Button>
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
      <div className="search-toolbar">
        <SearchField label="Поиск по операциям" placeholder="Поиск" value={query} onChange={wrap(model.setQuery)} />
        <Dialog presentation="auto">
          <DialogTrigger aria-label="Фильтры" className="btn-icon search-action" data-active={hasSelections ? '' : undefined}>
            <SlidersHorizontal size={18} aria-hidden="true" />
          </DialogTrigger>
          <DialogContent initialFocus="content" className="compact-dialog grid-rows-[auto_minmax(0,1fr)_auto]">
            <div className="dialog-header">
              <SheetGrip />
              <DialogTitle className="min-w-0 text-lg leading-tight">Фильтры</DialogTitle>
              <DialogClose className="dialog-close" aria-label="Закрыть"><X size={17} aria-hidden="true" /></DialogClose>
            </div>
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
                  options={categoryChoices} onChange={wrap(model.setCategories)} />
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              {hasSelections && <Button className="btn-text" onClick={wrap(model.clearSelections)}>Сбросить фильтры</Button>}
              <DialogClose className="btn-primary grow" aria-label="Готово, закрыть фильтры">Готово</DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {activeLabels && <p className="min-w-0 px-0.5 text-xs leading-snug text-muted wrap-anywhere">{activeLabels}</p>}
    </>
  )
}, 'JournalFilters')
