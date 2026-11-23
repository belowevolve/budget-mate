import { DatePickerContent } from '@ui-sdk/react/date-picker'
import { ListboxItem } from '@ui-sdk/react/listbox'
import { SelectContent, SelectItem, SelectList } from '@ui-sdk/react/select'
import { cn } from 'cn'
import type { ComponentProps } from 'react'

export function ChoiceTriggerButton({ className, ...props }: ComponentProps<'button'>) {
  return (
    <button {...props} className={cn(
      'group inline-flex h-auto min-h-11 max-w-full items-center gap-1.5 rounded-xl border border-field-line bg-paper px-2.5 text-sm font-bold text-primary after:content-none hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary data-open:bg-subtle',
      className,
    )} />
  )
}

const popoverSurface = [
  'flex max-h-(--available-height) max-w-[min(27rem,calc(100vw-1.5rem))] min-w-[min(max(10rem,var(--anchor-width,0px)),calc(100vw-1.5rem))] flex-col overflow-clip rounded-2xl border border-line bg-paper p-1.5 text-ink not-data-[presentation=sheet]:shadow-popup',
  'data-[presentation=sheet]:max-h-[min(28rem,calc(var(--visual-viewport-height,100dvh)-2rem))] data-[presentation=sheet]:w-full data-[presentation=sheet]:max-w-none data-[presentation=sheet]:rounded-ee-none data-[presentation=sheet]:rounded-es-none data-[presentation=sheet]:px-3 data-[presentation=sheet]:pt-3 data-[presentation=sheet]:pb-[env(safe-area-inset-bottom,0px)]',
]

type SelectPopoverProps = Omit<ComponentProps<typeof SelectContent>, 'className'> & { searchable?: boolean }

export function SelectPopover({ searchable, ...props }: SelectPopoverProps) {
  return (
    <SelectContent {...props} data-sheet-surface className={cn(
      popoverSurface,
      searchable && 'max-h-[min(24rem,var(--available-height,24rem))] min-w-[min(max(15.5rem,var(--anchor-width,0px)),calc(100vw-1.5rem))] gap-1.5 [&_mark]:bg-transparent [&_mark]:font-extrabold [&_mark]:text-primary',
    )} />
  )
}

export function CalendarPopover(props: Omit<ComponentProps<typeof DatePickerContent>, 'className'>) {
  return <DatePickerContent {...props} data-sheet-surface className={cn(popoverSurface)} />
}

export function ChoiceList(props: Omit<ComponentProps<typeof SelectList>, 'className'>) {
  return <SelectList {...props} className="min-h-0 overflow-y-auto overscroll-contain scroll-edges-y in-data-[presentation=sheet]:overscroll-y-auto" />
}

const choiceItem = 'flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold wrap-anywhere data-highlighted:bg-subtle data-selected:bg-selected data-selected:font-extrabold data-selected:text-primary'

type ChoiceItemProps = Omit<ComponentProps<typeof SelectItem>, 'className'> & { compact?: boolean; className?: string }

export function ChoiceItem({ compact, className, ...props }: ChoiceItemProps) {
  return <SelectItem {...props} className={cn(choiceItem, compact && 'min-h-9 rounded-lg', className)} />
}

export function ChoiceListboxItem({ className, ...props }: Omit<ComponentProps<typeof ListboxItem>, 'className'> & { className?: string }) {
  return <ListboxItem {...props} className={cn(choiceItem, className)} />
}
