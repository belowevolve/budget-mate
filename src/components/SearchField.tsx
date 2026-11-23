import { Button } from '@ui-sdk/react/button'
import { Input } from '@ui-sdk/react/input'
import { Search, X } from 'lucide-react'
import { useRef } from 'react'

export default function SearchField({ label, placeholder = label, value, onChange }: {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className="relative min-w-0 shrink-0">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" aria-hidden="true" />
      <Input ref={input} className="search-input" type="search" aria-label={label} placeholder={placeholder}
        inputMode="search" autoComplete="off" enterKeyHint="search" value={value} onValueChange={onChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.currentTarget.form) event.preventDefault()
        }} />
      {value && (
        <Button type="button" className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-lg border-0 bg-transparent p-0 text-muted shadow-none hover:bg-subtle"
          aria-label="Очистить поиск" onClick={() => {
            input.current?.focus({ preventScroll: true })
            onChange('')
          }}>
          <X size={16} aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
