import type { ComponentProps } from 'react'
import { Button } from '@ui-sdk/react/button'
import './rowAction.css'

type RowActionProps = Omit<ComponentProps<typeof Button>, 'className'> & { className?: string }

export function RowAction({ className, ...props }: RowActionProps) {
  return <Button className={className ? `row-action ${className}` : 'row-action'} {...props} />
}
