import { Checkbox as CheckboxPrimitive, CheckboxIndicator } from '@ui-sdk/react/checkbox'
import { cn } from 'cn'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'

export function Checkbox({ className, ...props }: Omit<ComponentProps<typeof CheckboxPrimitive>, 'className' | 'children'> & { className?: string }) {
  return (
    <CheckboxPrimitive {...props} className={cn(
      'inline-flex size-4.5 shrink-0 items-center justify-center rounded-xs border-2 border-field-line bg-paper text-on-primary',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      'data-checked:border-0 data-checked:bg-primary',
      className,
    )}>
      <CheckboxIndicator className="grid size-4.5 shrink-0 place-items-center" aria-hidden="true">
        <Check className="size-full" />
      </CheckboxIndicator>
    </CheckboxPrimitive>
  )
}

export function CheckboxLabel({ className, ...props }: ComponentProps<'label'>) {
  return <label {...props} className={cn(
    'flex min-h-12 min-w-0 cursor-pointer items-center gap-2.5 text-sm font-semibold has-data-disabled:cursor-default',
    className,
  )} />
}
