import { Input } from '@ui-sdk/react/input'
import { Search, X } from 'lucide-react'
import { useRef, type ComponentProps, type ReactNode } from 'react'
import { cn } from '../cn'
import { Button } from './Button'

export function SearchToolbar({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2', className)} />
}

export function SearchInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input {...props} type="search" className={cn(
      'h-11 min-h-11 w-full min-w-0 rounded-xl border border-field-line bg-paper pe-9 ps-8 text-base text-ink sm:text-sm',
      'focus-visible:border-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
      '[&::-webkit-search-cancel-button]:appearance-none',
      className,
    )} />
  )
}

export function SearchFieldFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search size={16} className="pointer-events-none absolute inset-s-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
      {children}
    </div>
  )
}

export default function SearchField({ label, placeholder = label, value, onChange, disabled }: {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <SearchFieldFrame className="shrink-0">
      <Input ref={input} render={<SearchInput />} type="search" aria-label={label} placeholder={placeholder}
        inputMode="search" autoComplete="off" enterKeyHint="search" value={value} onValueChange={onChange} disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.currentTarget.form) event.preventDefault()
        }} />
      {value && (
        <Button variant="secondary" size="icon-sm"
          className="absolute inset-e-1 top-1/2 size-8 -translate-y-1/2 rounded-lg bg-transparent text-muted hover:bg-subtle"
          aria-label="Очистить поиск" disabled={disabled} onClick={() => {
            input.current?.focus({ preventScroll: true })
            onChange('')
          }}>
          <X aria-hidden="true" />
        </Button>
      )}
    </SearchFieldFrame>
  )
}
