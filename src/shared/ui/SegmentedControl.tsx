import {
  SegmentedControl as SegmentedPrimitive, SegmentedControlIndicator, SegmentedControlItem as SegmentedItemPrimitive,
} from '@ui-sdk/react/segmented-control'
import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'

type SegmentedProps<Value extends string> = Omit<ComponentProps<typeof SegmentedPrimitive<Value>>, 'className' | 'children'> & {
  className?: string
  children: ReactNode
}

export function SegmentedControl<Value extends string>({ className, children, ...props }: SegmentedProps<Value>) {
  return (
    <SegmentedPrimitive {...props} className={cn(
      'relative isolate grid w-full min-w-0 auto-cols-fr grid-flow-col gap-0.5 rounded-xl border-0 bg-subtle p-0.5 [--segment-radius:calc(var(--radius-xl)-0.125rem)]',
      className,
    )}>
      <SegmentedControlIndicator className="rounded-(--segment-radius) border-0 bg-selected shadow-none" />
      {children}
    </SegmentedPrimitive>
  )
}

export function SegmentedControlItem({ className, ...props }: Omit<ComponentProps<typeof SegmentedItemPrimitive>, 'className'> & { className?: string }) {
  return (
    <SegmentedItemPrimitive {...props} className={cn(
      'flex h-auto min-h-10 min-w-0 items-center justify-center gap-1 rounded-(--segment-radius) border-0 bg-transparent px-0.5 py-1 text-center text-xs leading-tight font-bold whitespace-normal text-muted shadow-none hover:bg-selected/50 focus-visible:-outline-offset-2 data-checked:font-extrabold data-checked:text-primary sm:text-sm',
      className,
    )} />
  )
}
