import type { ReactNode } from 'react'
import {
  Select, SelectContent, SelectItem, SelectItemIndicator, SelectTrigger, SelectValue,
} from '@ui-sdk/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { SheetGrip } from './SheetGrip'

export interface ChoiceOption {
  value: string
  label: string
  icon?: ReactNode
}

export function Choice({ label, value, options, onChange, icon, className, presentation }: {
  label: string
  value: string
  options: ChoiceOption[]
  onChange: (value: string) => void
  icon?: ReactNode
  className?: string
  presentation?: 'auto'
}) {
  const selectedIcon = options.find((option) => option.value === value)?.icon

  return (
    <Select items={options} value={value} presentation={presentation} onValueChange={(next) => { if (next != null) onChange(next) }}>
      <SelectTrigger aria-label={label} className={className ? `choice-trigger group ${className}` : 'choice-trigger group'}>
        {icon ?? selectedIcon}
        <SelectValue className="min-w-0 truncate" />
        <ChevronDown size={16} className="ml-auto shrink-0 opacity-80 transition-transform group-data-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </SelectTrigger>
      <SelectContent align="start" sideOffset={7} collisionPadding={10} className="choice-popover">
        {presentation && <SheetGrip />}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="choice-item">
            <span className="flex min-w-0 items-center gap-2">{option.icon}<span>{option.label}</span></span>
            <SelectItemIndicator className="shrink-0"><Check size={16} aria-hidden="true" /></SelectItemIndicator>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
