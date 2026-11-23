import { DialogClose, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog'
import { cn } from 'cn'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { SheetGrip } from './SheetGrip'

type CloseProps = { closeDisabled?: boolean; closeLabel?: string }

export function DialogHeaderFrame({ children, closeDisabled, closeLabel = 'Закрыть' }: CloseProps & { children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 has-[>[data-slot=dialog-close]:not(:focus-visible)]:grid-cols-1">
      <SheetGrip />
      {children}
      <DialogClose aria-label={closeLabel} disabled={closeDisabled}
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg border-0 bg-transparent p-0 text-muted shadow-none not-focus-visible:sr-only hover:bg-subtle hover:text-ink',
          'in-data-[presentation=sheet]:focus-visible:w-auto in-data-[presentation=sheet]:focus-visible:px-2 in-data-[presentation=sheet]:focus-visible:text-xs in-data-[presentation=sheet]:focus-visible:font-bold in-data-[presentation=sheet]:focus-visible:after:content-[attr(aria-label)]',
        )}>
        <X className="pointer-events-none size-4.5 shrink-0 in-data-[presentation=sheet]:hidden" aria-hidden="true" />
      </DialogClose>
    </div>
  )
}

export function DialogHeader({ title, description, ...close }: CloseProps & { title: string; description?: ReactNode }) {
  return (
    <DialogHeaderFrame {...close}>
      <div className="min-w-0">
        <DialogTitle className="text-lg leading-tight wrap-anywhere">{title}</DialogTitle>
        {description != null && (
          <DialogDescription className="mt-0.5 text-xs leading-snug wrap-anywhere text-muted">{description}</DialogDescription>
        )}
      </div>
    </DialogHeaderFrame>
  )
}
