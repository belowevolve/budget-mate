import { useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogClose, DialogTrigger } from '@ui-sdk/react/dialog'
import {
  createSelectController, Select, SelectItemIndicator, SelectLabel, SelectTrigger, SelectValue,
} from '@ui-sdk/react/select'
import { Check, SlidersHorizontal } from 'lucide-react'
import { categoryDefinition, type CategoryCatalog } from '../../categories/catalog'
import { useCategoryCatalog } from '../../categories/categoryContext'
import { banks as bankNames, type Category } from '../../finance'
import type { BankId } from '../../statements/types'
import { BankIcon } from '../BankIcon'
import { CategoryIcon } from '../CategoryIcon'
import { Button, buttonVariants } from '../../shared/ui/Button'
import { ChoiceClear, type ChoiceOption } from '../../shared/ui/Choice'
import { ChoiceItem, ChoiceList, ChoiceTriggerButton, SelectPopover } from '../../shared/ui/ChoiceParts'
import { ChoiceTriggerContent } from '../../shared/ui/ChoiceTriggerContent'
import { DialogActions } from '../../shared/ui/DialogActions'
import { DialogBody, DialogSurface } from '../../shared/ui/DialogSurface'
import { DialogHeader } from '../../shared/ui/DialogHeader'
import { SearchSelectList, SelectSearchField } from '../../shared/ui/SearchSelect'
import { SheetGrip } from '../../shared/ui/SheetGrip'
import { useAndroidPopupBack } from '../../shared/ui/popupBack'
import { useDesktopPicker } from '../../shared/ui/useDesktopPicker'

function summarizeChoices(labels: string[]) {
  const names = labels.slice(0, 2).join(', ')
  return labels.length > 2 ? `${names} +${labels.length - 2}` : names
}

function MultiChoice<Value extends string>({ label, placeholder, clearLabel, searchLabel, value, options, onChange, disabled }: {
  label: string
  placeholder: string
  clearLabel: string
  searchLabel?: string
  value: Value[]
  options: (ChoiceOption & { value: Value })[]
  onChange: (value: Value[]) => void
  disabled?: boolean
}) {
  const [controller] = useState(() => createSelectController<Value, true>())
  const searchInput = useRef<HTMLInputElement>(null)
  const watchBack = useAndroidPopupBack(() => { controller.close({ reason: 'back' }) })
  const desktop = useDesktopPicker()
  const search = desktop ? searchLabel : undefined

  return (
    <Select multiple disabled={disabled} controller={controller} items={options} value={value} presentation={search ? undefined : 'auto'} onValueChange={onChange}
      onOpenChange={watchBack} onOpenChangeComplete={(open) => {
        if (open) searchInput.current?.focus({ preventScroll: true })
      }}>
      <div className="grid min-w-0 gap-1">
        <SelectLabel className="text-xs font-bold text-muted">{label}</SelectLabel>
        <div className="flex min-w-0 items-center gap-2">
          <SelectTrigger render={<ChoiceTriggerButton />} className="w-full min-w-0">
            <ChoiceTriggerContent>
              <SelectValue className="min-w-0 flex-1 text-start leading-snug whitespace-normal wrap-anywhere">
                {({ labels }) => summarizeChoices(labels) || placeholder}
              </SelectValue>
            </ChoiceTriggerContent>
          </SelectTrigger>
          <ChoiceClear label={clearLabel} />
        </div>
      </div>
      <SelectPopover align="start" sideOffset={7} collisionPadding={10} searchable={Boolean(search)}>
        {search ? (
          <>
            <SelectSearchField label={search} noResults="Категории не найдены" inputRef={searchInput} />
            <SearchSelectList label={label} options={options} />
          </>
        ) : (
          <>
            <SheetGrip />
            <ChoiceList>
              {options.map(({ value, label, icon }) => (
                <ChoiceItem key={value} value={value} label={label} aria-label={label} className="focus-visible:-outline-offset-2">
                  <span className="flex min-w-0 items-center gap-2">{icon}<span>{label}</span></span>
                  <SelectItemIndicator className="shrink-0"><Check size={16} aria-hidden="true" /></SelectItemIndicator>
                </ChoiceItem>
              ))}
            </ChoiceList>
          </>
        )}
        <div className="shrink-0 px-0.5 pt-2 pb-3">
          <Button className="w-full" onClick={() => { controller.close() }}>Готово</Button>
        </div>
      </SelectPopover>
    </Select>
  )
}

function operationCategoryChoices(catalog: CategoryCatalog, availableCategories: Category[]) {
  const definitions = availableCategories.map((value) => {
    const definition = categoryDefinition(catalog, value)
    return { value, kind: definition.kind, label: value === 'transfer' ? 'Переводы и компенсации' : definition.label }
  })
  const labelCounts = new Map<string, number>()
  for (const { label } of definitions) {
    const key = label.toLowerCase()
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1)
  }
  return definitions.map(({ value, label, kind }) => ({
    value,
    label: value !== 'transfer' && (labelCounts.get(label.toLowerCase()) ?? 0) > 1
      ? `${label} · ${kind === 'income' ? 'доходы' : 'расходы'}`
      : label,
  }))
}

type OperationFilterSelection = {
  banks: BankId[]
  categories: Category[]
  availableCategories: Category[]
}

export function OperationFilterSummary({ banks, categories, availableCategories, children }: OperationFilterSelection & { children?: ReactNode }) {
  const catalog = useCategoryCatalog()
  const categoryLabels = categories.length
    ? summarizeChoices(operationCategoryChoices(catalog, availableCategories)
      .filter(({ value }) => categories.includes(value)).map(({ label }) => label))
    : ''
  if (!banks.length && !categoryLabels && !children) return null

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-0.5 text-xs leading-snug text-muted wrap-anywhere">
      {banks.length > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1">
          {banks.map((bank) => <BankIcon key={bank} bank={bank} />)}
        </span>
      )}
      {children}
      {categoryLabels && <span className="min-w-0">{categoryLabels}</span>}
    </div>
  )
}

type OperationFilterDialogProps = OperationFilterSelection & {
  availableBanks: BankId[]
  onBanksChange: (banks: BankId[]) => void
  onCategoriesChange: (categories: Category[]) => void
  onReset: () => void
  disabled?: boolean
  additionalFiltersActive?: boolean
  children?: ReactNode
  title?: string
}

export function OperationFilterDialog({
  banks, categories, availableBanks, availableCategories, onBanksChange, onCategoriesChange, onReset,
  disabled, additionalFiltersActive, children, title = 'Фильтры',
}: OperationFilterDialogProps) {
  const catalog = useCategoryCatalog()
  const hasSelections = additionalFiltersActive || banks.length > 0 || categories.length > 0
  const bankChoices = availableBanks.map((value) => ({
    value, label: bankNames[value], icon: <BankIcon bank={value} className="size-7 rounded-lg" decorative />,
  }))
  const categoryChoices = operationCategoryChoices(catalog, availableCategories).map((choice) => ({
    ...choice, icon: <CategoryIcon category={choice.value} className="size-7 rounded-lg" />,
  }))

  return (
    <Dialog presentation="auto">
      <DialogTrigger aria-label={title} data-active={hasSelections ? '' : undefined} disabled={disabled}
        className={buttonVariants({ variant: 'outline', size: 'icon-lg', className: 'rounded-xl' })}>
        <SlidersHorizontal aria-hidden="true" />
      </DialogTrigger>
      <DialogSurface initialFocus="content" className="grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader title={title} />
        <DialogBody className="grid content-start gap-3">
          {children}
          {bankChoices.length > 0 && (
            <MultiChoice label="Банки" placeholder="Все банки" clearLabel="Сбросить банки" value={banks}
              options={bankChoices} onChange={onBanksChange} disabled={disabled} />
          )}
          {categoryChoices.length > 0 && (
            <MultiChoice label="Категории" placeholder="Все категории" clearLabel="Сбросить категории" value={categories}
              searchLabel="Поиск категорий" options={categoryChoices} onChange={onCategoriesChange} disabled={disabled} />
          )}
        </DialogBody>
        <DialogActions>
          {hasSelections && <Button variant="text" onClick={onReset} disabled={disabled}>Сбросить фильтры</Button>}
          <DialogClose className={buttonVariants({ className: 'grow' })} aria-label="Готово, закрыть фильтры">Готово</DialogClose>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  )
}
