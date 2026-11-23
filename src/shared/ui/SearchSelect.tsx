import {
  Select, SelectContent, SelectEmpty, SelectInput, SelectItem, SelectItemIndicator, SelectItemText, SelectList,
  SelectTrigger, SelectValue, type SelectContentProps, type SelectProps,
} from '@ui-sdk/react/select'
import { Check } from 'lucide-react'
import { useRef, type ReactNode, type Ref } from 'react'
import { ChoiceTriggerContent } from './ChoiceTriggerContent'
import { SearchFieldFrame, SearchInput } from './SearchField'
import './searchSelect.css'

interface SearchOption<Value extends string> {
  value: Value
  label: string
  icon?: ReactNode
  detail?: string
}

export function SelectSearchField({ label, noResults, action, inputRef }: {
  label: string
  noResults: string
  action?: ReactNode
  inputRef?: Ref<HTMLInputElement>
}) {
  return (
    <>
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <SearchFieldFrame className="flex-1">
          <SelectInput ref={inputRef} aria-label={label} placeholder={label} type="search" autoComplete="off"
            render={<SearchInput className="h-9 min-h-9 pe-2" />} />
        </SearchFieldFrame>
        {action}
      </div>
      <SelectEmpty className="px-2 py-3 text-sm text-muted not-data-empty:hidden">{noResults}</SelectEmpty>
    </>
  )
}

export function SearchSelectList<Value extends string>({ label, options }: { label: string; options: SearchOption<Value>[] }) {
  const byValue = new Map(options.map((option) => [option.value, option]))
  return (
    <SelectList aria-label={label}>
      {({ items }) => (items as { value: Value }[]).map((item) => {
        const option = byValue.get(item.value)
        if (!option) return null
        const { value, label, icon, detail } = option
        return (
          <SelectItem key={value} value={value} label={label} aria-label={label} className="choice-item">
            <span className="flex min-w-0 items-center gap-2">
              {icon}
              <span className="grid min-w-0 leading-snug wrap-anywhere">
                <SelectItemText />
                {detail && <span className="text-xs font-medium text-muted">{detail}</span>}
              </span>
            </span>
            <SelectItemIndicator className="shrink-0"><Check size={16} aria-hidden="true" /></SelectItemIndicator>
          </SelectItem>
        )
      })}
    </SelectList>
  )
}

type SearchSelectProps<Value extends string> = Pick<SelectProps<Value, false>,
  'open' | 'disabled' | 'onOpenChange' | 'onOpenChangeComplete'> & {
    value: Value | null
    onValueChange: (value: Value | null) => void
    label: string
    searchLabel: string
    options: SearchOption<Value>[]
    placeholder?: string
    noResults?: string
    triggerIcon?: ReactNode
    triggerRef?: Ref<HTMLButtonElement>
    anchor?: SelectContentProps['anchor']
    searchAction?: ReactNode
    footer?: ReactNode
  }

export function SearchSelect<Value extends string>({ label, searchLabel, options, placeholder, noResults = 'Ничего не найдено',
  triggerIcon, triggerRef, anchor, searchAction, footer, onOpenChangeComplete, ...select }: SearchSelectProps<Value>) {
  const selectedIcon = options.find((option) => option.value === select.value)?.icon
  const searchInput = useRef<HTMLInputElement>(null)

  return (
    <Select<Value> {...select} items={options} placeholder={placeholder}
      announcement={(change) => change.type === 'results' ? (change.count ? `Найдено: ${change.count}` : noResults) : null}
      onOpenChangeComplete={(open) => {
        if (open) searchInput.current?.focus({ preventScroll: true })
        onOpenChangeComplete?.(open)
      }}>
      {anchor === undefined && (
        <SelectTrigger ref={triggerRef} aria-label={label} className="choice-trigger group w-full min-w-0 text-start">
          <ChoiceTriggerContent icon={triggerIcon ?? selectedIcon}>
            <SelectValue className="min-w-0 truncate" />
          </ChoiceTriggerContent>
        </SelectTrigger>
      )}
      <SelectContent anchor={anchor} align="start" sideOffset={6} collisionPadding={12}
        aria-label={label} className="choice-popover search-select-popover">
        <SelectSearchField label={searchLabel} noResults={noResults} action={searchAction} inputRef={searchInput} />
        <SearchSelectList label={label} options={options} />
        {footer && <div className="grid shrink-0 gap-1.5 border-t border-line pt-1.5">{footer}</div>}
      </SelectContent>
    </Select>
  )
}
