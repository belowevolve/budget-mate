import {
  Select, SelectContent, SelectEmpty, SelectInput, SelectItem, SelectItemIndicator, SelectItemText, SelectList,
  SelectTrigger, SelectValue, type SelectContentProps, type SelectProps,
} from '@ui-sdk/react/select'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useRef, type ReactNode, type Ref } from 'react'
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
      <div className="search-select-tools">
        <div className="search-select-field">
          <Search size={16} aria-hidden="true" />
          <SelectInput ref={inputRef} aria-label={label} placeholder={label} type="search" autoComplete="off" className="search-input" />
        </div>
        {action}
      </div>
      <SelectEmpty className="search-select-empty">{noResults}</SelectEmpty>
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
            <span className="search-select-label">
              {icon}
              <span className="search-select-text">
                <SelectItemText />
                {detail && <span className="search-select-detail">{detail}</span>}
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
        <SelectTrigger ref={triggerRef} aria-label={label} className="choice-trigger search-select-trigger">
          {triggerIcon ?? selectedIcon}
          <SelectValue className="min-w-0 truncate" />
          <ChevronDown size={16} className="ms-auto shrink-0" aria-hidden="true" />
        </SelectTrigger>
      )}
      <SelectContent anchor={anchor} align="start" sideOffset={6} collisionPadding={12}
        aria-label={label} className="choice-popover search-select-popover">
        <SelectSearchField label={searchLabel} noResults={noResults} action={searchAction} inputRef={searchInput} />
        <SearchSelectList label={label} options={options} />
        {footer}
      </SelectContent>
    </Select>
  )
}
