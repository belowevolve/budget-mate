import { Input } from '@ui-sdk/react/input'
import { cn } from 'cn'
import type { ComponentProps } from 'react'

const fieldStyles = 'min-h-11 w-full min-w-0 rounded-xl border border-field-line bg-field px-3 text-sm text-ink focus-visible:border-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary data-invalid:focus-visible:border-danger data-invalid:focus-visible:outline-danger'

export function FieldInput({ className, ...props }: Omit<ComponentProps<typeof Input>, 'className'> & { className?: string }) {
  return <Input {...props} className={cn(fieldStyles, className)} />
}

export function FieldInputElement({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={cn(fieldStyles, className)} />
}

export function FileField({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <FieldInputElement {...props} type="file" className={cn(
      'max-w-full truncate py-2 file:mr-2 file:rounded-lg file:border-0 file:bg-subtle file:px-2 file:py-1',
      className,
    )} />
  )
}
