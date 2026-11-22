import type { ReactNode } from 'react'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog'
import { Input } from '@ui-sdk/react/input'
import { SlidersHorizontal, Search, X } from 'lucide-react'
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control'
import { banks, categories, type Category } from '../../finance'
import { CategoryIcon } from '../CategoryIcon'
import { Choice } from '../Choice'
import { SheetGrip } from '../SheetGrip'
import { journalTabs, type JournalKind, type JournalModel } from './model'

const bankOptions = [{ value: 'all', label: 'Все банки' }, ...Object.entries(banks).map(([value, label]) => ({ value, label }))]

type FiltersProps = {
  model: JournalModel
  kind: JournalKind
  bank: string
  query: string
  category: string
  availableCategories: Category[]
  hasUnmatched: boolean
  transferSettings?: ReactNode
}

export default reatomComponent<FiltersProps>(function Filters({ model, kind, bank, query, category, availableCategories, hasUnmatched, transferSettings }) {
  const hasSelections = bank !== 'all' || category !== 'all' || kind === 'review'
  return (
    <>
      {transferSettings}
      <SegmentedControl
        className="relative isolate grid min-w-0 grid-cols-4 gap-0.5 rounded-xl border-0 bg-subtle p-0.5"
        aria-label="Тип операций"
        value={kind === 'review' ? null : kind}
        onValueChange={wrap((value) => { if (value !== null) model.setKind(value as JournalKind) })}
      >
        <SegmentedControlIndicator className="rounded-lg border-0 bg-selected shadow-none" />
        {journalTabs.map(({ value, label }) => (
          <SegmentedControlItem
            key={value}
            value={value}
            className="flex h-auto min-h-10 min-w-0 items-center justify-center rounded-lg border-0 bg-transparent px-0.5 py-1 text-center text-xs leading-tight font-bold text-muted shadow-none hover:bg-selected/50 data-checked:font-extrabold data-checked:text-primary sm:text-sm"
          >
            <span className="min-w-0 truncate">{label}</span>
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="relative min-w-0">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input className="h-11 w-full min-w-0 rounded-xl border border-line bg-paper pr-9 pl-8 text-base sm:text-sm"
            aria-label="Поиск по операциям" inputMode="search" placeholder="Поиск" value={query}
            onValueChange={wrap(model.setQuery)} />
          {query && (
            <Button className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-lg border-0 bg-transparent p-0 text-muted shadow-none hover:bg-subtle" aria-label="Очистить поиск" onClick={wrap(() => model.setQuery(''))}>
              <X size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
        <Dialog presentation="auto">
          <DialogTrigger aria-label="Фильтры" className={`btn-icon relative size-11 rounded-xl ${hasSelections ? 'bg-selected' : 'bg-paper ring-1 ring-line'}`}>
            <SlidersHorizontal size={18} aria-hidden="true" />
          </DialogTrigger>
          <DialogContent initialFocus="content" className="compact-dialog grid-rows-[auto_minmax(0,1fr)]">
            <div className="dialog-header">
              <SheetGrip />
              <DialogTitle className="min-w-0 text-lg leading-tight">Фильтры</DialogTitle>
              <DialogClose className="btn-icon" aria-label="Закрыть"><X size={17} aria-hidden="true" /></DialogClose>
            </div>
            <div className="dialog-body grid content-start gap-2" data-slot="scroll">
              <Choice className="w-full min-w-0" label="Банк" value={bank} options={bankOptions} onChange={wrap(model.setBank)} />
              {kind === 'expense' && availableCategories.length > 0 && (
                <Choice className="w-full min-w-0" label="Категория расходов" value={category} presentation="auto" options={[
                  { value: 'all', label: 'Все категории' },
                  ...availableCategories.map((value) => ({ value, label: categories[value].label, icon: <CategoryIcon category={value} className="size-7 rounded-lg" /> })),
                ]} onChange={wrap(model.setCategory)} />
              )}
              {hasUnmatched && kind !== 'review' && (
                <DialogClose className="btn-secondary w-full min-w-0 whitespace-normal" onClick={wrap(() => model.setKind('review'))}>
                  Нераспознанные переводы
                </DialogClose>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {kind === 'review' && (
        <Button className="inline-flex h-auto min-h-9 min-w-0 items-center gap-1 justify-self-start rounded-full border-0 bg-transfer-soft px-2 text-xs font-bold text-transfer shadow-none hover:bg-selected"
          aria-label="Выключить фильтр «Нераспознанные переводы»" onClick={wrap(() => model.setKind('activity'))}>
          <span className="truncate">Нераспознанные переводы</span><X size={13} className="shrink-0" aria-hidden="true" />
        </Button>
      )}
    </>
  )
}, 'JournalFilters')
