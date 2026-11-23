import { createElement, type ComponentProps } from 'react'
import { cn } from '../cn'

type PanelTag = 'section' | 'div' | 'form' | 'main' | 'nav' | 'ul'
type PanelProps<Tag extends PanelTag> = ComponentProps<Tag> & { as?: Tag; padded?: boolean }

export function Panel<Tag extends PanelTag = 'section'>({ as, padded, className, ...props }: PanelProps<Tag>) {
  return createElement(as ?? 'section', {
    ...props,
    className: cn('min-w-0 rounded-[21px] border border-line bg-paper sm:rounded-3xl', padded && 'p-3 sm:p-4', className),
  })
}

export function ListPanel({ className, ...props }: ComponentProps<'div'>) {
  return <Panel as="div" {...props} data-slot="list-panel" className={cn('flex min-h-0 flex-col overflow-hidden', className)} />
}
