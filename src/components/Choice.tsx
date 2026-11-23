import { useState, type ReactNode } from 'react'
import {
  createSelectController, Select, SelectClear, SelectContent, SelectItem, SelectItemIndicator, SelectList, SelectTrigger, SelectValue,
} from '@ui-sdk/react/select'
import { Check, ChevronDown, X } from 'lucide-react'
import { SheetGrip } from './SheetGrip'

export interface ChoiceOption {
  value: string
  label: string
  icon?: ReactNode
}

export interface ChoiceProps {
  label: string
  value: string
  options: ChoiceOption[]
  onChange: (value: string) => void
  icon?: ReactNode
  className?: string
  presentation?: 'auto'
  clear?: { value: string; label: string }
  onPresenceChange?: (close: (() => void) | null) => void
}

export function Choice({ label, value, options, onChange, icon, className, presentation, clear, onPresenceChange }: ChoiceProps) {
  const selectedIcon = options.find((option) => option.value === value)?.icon
  const [controller] = useState(() => createSelectController())
  const trigger = (
    <SelectTrigger aria-label={label} className={className ? `choice-trigger group ${className}` : 'choice-trigger group'}>
      {icon ?? selectedIcon}
      <SelectValue className="min-w-0 truncate" />
      <ChevronDown size={16} className="ml-auto shrink-0 opacity-80 transition-transform group-data-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
    </SelectTrigger>
  )

  return (
    <Select items={options} value={value} presentation={presentation} controller={controller} onValueChange={(next) => {
      const selected = next ?? clear?.value
      if (selected != null) onChange(selected)
    }}
      onOpenChange={(open) => {
        if (open) onPresenceChange?.(() => { controller.close({ reason: 'back' }) })
      }}
      onOpenChangeComplete={(open) => {
        if (!open) onPresenceChange?.(null)
      }}>
      {clear ? (
        <div className="flex min-w-0 items-center gap-2">
          {trigger}
          {value !== clear.value && (
            <SelectClear className="btn-icon size-11 rounded-xl" aria-label={clear.label}>
              <X size={17} aria-hidden="true" />
            </SelectClear>
          )}
        </div>
      ) : trigger}
      <SelectContent align="start" sideOffset={7} collisionPadding={10} className="choice-popover">
        {presentation && <SheetGrip />}
        <SelectList>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="choice-item">
              <span className="flex min-w-0 items-center gap-2">{option.icon}<span>{option.label}</span></span>
              <SelectItemIndicator className="shrink-0"><Check size={16} aria-hidden="true" /></SelectItemIndicator>
            </SelectItem>
          ))}
        </SelectList>
      </SelectContent>
    </Select>
  )
}
