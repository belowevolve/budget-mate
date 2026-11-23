import type { ComponentProps } from 'react'
import { Button } from '@ui-sdk/react/button'
import { cn } from '../cn'

type RowActionProps = Omit<ComponentProps<typeof Button>, 'className'> & { className?: string }

export function RowAction({ className, ...props }: RowActionProps) {
  return (
    <Button {...props} className={cn(
      'h-auto w-full min-w-0 border-0 bg-transparent text-start text-ink shadow-none',
      'enabled:hover:bg-subtle enabled:focus-visible:outline-2 enabled:focus-visible:-outline-offset-3 enabled:focus-visible:outline-primary',
      'aria-pressed:bg-selected',
      className,
    )} />
  )
}
