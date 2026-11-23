import { Button as ButtonPrimitive } from '@ui-sdk/react/button'
import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

type ButtonProps = Omit<ComponentProps<typeof ButtonPrimitive>, 'className' | 'children' | 'size'> & {
  variant?: 'primary' | 'secondary' | 'text' | 'danger' | 'icon'
  size?: 'compact' | 'large'
  icon?: LucideIcon
  className?: string
  children?: ReactNode
}

export function Button({ variant = 'primary', size, icon: Icon, className, children, ...props }: ButtonProps) {
  const classes = [`btn-${variant}`, size && `btn-${size}`, className].filter(Boolean).join(' ')

  return (
    <ButtonPrimitive {...props} className={classes}>
      {Icon && <Icon aria-hidden="true" data-icon={variant === 'icon' ? undefined : 'inline-start'} />}
      {Icon && children != null ? <span className="min-w-0">{children}</span> : children}
    </ButtonPrimitive>
  )
}
