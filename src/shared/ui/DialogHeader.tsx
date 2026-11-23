import { DialogClose, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { SheetGrip } from './SheetGrip'

type CloseProps = { closeDisabled?: boolean; closeLabel?: string }

export function DialogHeaderFrame({ children, closeDisabled, closeLabel = 'Закрыть' }: CloseProps & { children: ReactNode }) {
  return (
    <div className="dialog-header">
      <SheetGrip />
      {children}
      <DialogClose className="dialog-close" aria-label={closeLabel} disabled={closeDisabled}>
        <X aria-hidden="true" />
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
