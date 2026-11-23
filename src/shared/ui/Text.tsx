import { cn } from 'cn'
import type { ComponentProps } from 'react'

export function BodyText({ className, ...props }: ComponentProps<'p'>) {
  return <p {...props} className={cn('text-sm leading-relaxed text-muted', className)} />
}

export function ErrorText({ className, ...props }: ComponentProps<'p'>) {
  return <p {...props} className={cn('text-sm leading-relaxed wrap-anywhere text-danger', className)} />
}

export function SectionHeading({ as: Tag = 'h2', className, ...props }: ComponentProps<'h2'> & { as?: 'h2' | 'p' }) {
  return <Tag {...props} className={cn('text-base leading-tight font-extrabold tracking-tight wrap-anywhere sm:text-lg', className)} />
}
