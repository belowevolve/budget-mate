import { Checkbox as CheckboxPrimitive, CheckboxIndicator } from '@ui-sdk/react/checkbox'
import { cn } from 'cn'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'

export function Checkbox({ className, ...props }: Omit<ComponentProps<typeof CheckboxPrimitive>, 'className' | 'children'> & { className?: string }) {
  return (
    <CheckboxPrimitive {...props} className={cn(
      'size-5 shrink-0 rounded-md border border-field-line bg-paper text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-checked:border-primary data-checked:bg-primary',
      className,
    )}>
      <CheckboxIndicator><Check size={13} aria-hidden="true" /></CheckboxIndicator>
    </CheckboxPrimitive>
  )
}
