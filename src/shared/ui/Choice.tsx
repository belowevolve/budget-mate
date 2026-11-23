import { useState, type ReactNode } from 'react'
import {
  createSelectController, Select, SelectClear, SelectItemIndicator, SelectTrigger, SelectValue,
} from '@ui-sdk/react/select'
import { Check, X } from 'lucide-react'
import { buttonVariants } from './Button'
import { ChoiceItem, ChoiceList, ChoiceTriggerButton, SelectPopover } from './ChoiceParts'
import { ChoiceTriggerContent } from './ChoiceTriggerContent'
import { useAndroidPopupBack } from './popupBack'
import { SheetGrip } from './SheetGrip'

export interface ChoiceOption {
  value: string
  label: string
  icon?: ReactNode
}

export function ChoiceClear({ label }: { label: string }) {
  return (
    <SelectClear className={buttonVariants({ variant: 'secondary', size: 'icon-lg', className: 'rounded-xl' })} aria-label={label}>
      <X aria-hidden="true" />
    </SelectClear>
  )
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
}

export function Choice({ label, value, options, onChange, icon, className, presentation, clear }: ChoiceProps) {
  const selectedIcon = options.find((option) => option.value === value)?.icon
  const [controller] = useState(() => createSelectController())
  const onOpenChange = useAndroidPopupBack(() => { controller.close({ reason: 'back' }) })
  const trigger = (
    <SelectTrigger aria-label={label} render={<ChoiceTriggerButton />} className={className}>
      <ChoiceTriggerContent icon={icon ?? selectedIcon}>
        <SelectValue className="min-w-0 truncate" />
      </ChoiceTriggerContent>
    </SelectTrigger>
  )

  return (
    <Select items={options} value={value} presentation={presentation} controller={controller} onValueChange={(next) => {
      const selected = next ?? clear?.value
      if (selected != null) onChange(selected)
    }}
      onOpenChange={onOpenChange}>
      {clear ? (
        <div className="flex min-w-0 items-center gap-2">
          {trigger}
          {value !== clear.value && <ChoiceClear label={clear.label} />}
        </div>
      ) : trigger}
      <SelectPopover align="start" sideOffset={7} collisionPadding={10}>
        {presentation && <SheetGrip />}
        <ChoiceList>
          {options.map((option) => (
            <ChoiceItem key={option.value} value={option.value}>
              <span className="flex min-w-0 items-center gap-2">{option.icon}<span>{option.label}</span></span>
              <SelectItemIndicator className="shrink-0"><Check size={16} aria-hidden="true" /></SelectItemIndicator>
            </ChoiceItem>
          ))}
        </ChoiceList>
      </SelectPopover>
    </Select>
  )
}
