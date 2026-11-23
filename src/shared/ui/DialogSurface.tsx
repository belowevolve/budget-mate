import { DialogContent } from '@ui-sdk/react/dialog'
import { cn } from 'cn'
import { createElement, type ComponentProps } from 'react'

type DialogSurfaceProps = Omit<ComponentProps<typeof DialogContent>, 'className'> & { className?: string }

export function DialogSurface({ className, ...props }: DialogSurfaceProps) {
  return (
    <DialogContent {...props} data-sheet-surface className={cn(
      'grid max-h-[min(36rem,calc(var(--visual-viewport-height,100dvh)-0.75rem))] w-[min(27rem,calc(100vw-1rem))] min-w-0 gap-2 overflow-hidden rounded-2xl border border-line bg-paper p-2.5 text-ink backdrop:bg-scrim sm:p-3.5',
      'data-[presentation=dialog]:[transition:opacity_140ms_ease,translate_160ms_ease] motion-reduce:data-[presentation=dialog]:transition-none',
      'data-[presentation=dialog]:[[data-starting-style],[data-ending-style]]:translate-y-2 data-[presentation=dialog]:[[data-starting-style],[data-ending-style]]:opacity-0',
      'data-[presentation=sheet]:w-full data-[presentation=sheet]:max-w-full data-[presentation=sheet]:overflow-clip data-[presentation=sheet]:rounded-b-none',
      'data-[presentation=sheet]:pb-[max(0.75rem,env(safe-area-inset-bottom))] data-[presentation=sheet]:data-list-sheet:pb-[env(safe-area-inset-bottom,0px)]',
      className,
    )} />
  )
}

type DialogBodyProps<Tag extends 'div' | 'ul'> = ComponentProps<Tag> & { as?: Tag }

export function DialogBody<Tag extends 'div' | 'ul' = 'div'>({ as, className, ...props }: DialogBodyProps<Tag>) {
  return createElement(as ?? 'div', {
    ...props,
    'data-slot': 'scroll',
    className: cn('min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain scroll-edges-y in-data-[presentation=sheet]:overscroll-y-auto', className),
  })
}
