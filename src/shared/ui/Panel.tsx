import { cn } from 'cn'
import { createElement, type ComponentProps } from 'react'

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

const listStyles = 'min-h-0 w-full min-w-0 list-none divide-y divide-line overflow-y-auto overscroll-y-contain scroll-edges-y rounded-none border-0 bg-transparent p-0'

export function PanelList({ className, ...props }: ComponentProps<'ul'>) {
  return <ul {...props} className={cn(listStyles, className)} />
}

export function PanelListboxBody({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn(listStyles, className)} />
}

const emptyStateStyles = 'flex flex-col items-center justify-center gap-2 px-3 py-5 text-center sm:px-4 sm:py-6'

export function EmptyPanel({ className, ...props }: ComponentProps<'section'>) {
  return <Panel {...props} className={cn(emptyStateStyles, className)} />
}

export function EmptyState({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn(emptyStateStyles, className)} />
}

export function PanelIcon({ className, large, ...props }: ComponentProps<'span'> & { large?: boolean }) {
  return <span {...props} className={cn(
    'inline-grid shrink-0 place-items-center bg-subtle text-primary',
    large ? 'mb-1 size-11 rounded-2xl' : 'size-8 rounded-xl',
    className,
  )} />
}
