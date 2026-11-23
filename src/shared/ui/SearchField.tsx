import { Input } from '@ui-sdk/react/input'
import { Search, X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { Button } from './Button'

export function SearchFieldFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative min-w-0 ${className}`}>
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
      <Input ref={input} className="search-input" type="search" aria-label={label} placeholder={placeholder}
        inputMode="search" autoComplete="off" enterKeyHint="search" value={value} onValueChange={onChange} disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.currentTarget.form) event.preventDefault()
        }} />
      {value && (
        <Button variant="icon" size="compact" icon={X}
          className="absolute inset-e-1 top-1/2 size-8 -translate-y-1/2 rounded-lg bg-transparent text-muted hover:bg-subtle"
          aria-label="Очистить поиск" disabled={disabled} onClick={() => {
            input.current?.focus({ preventScroll: true })
            onChange('')
          }} />
      )}
    </SearchFieldFrame>
  )
}
