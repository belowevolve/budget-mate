import { action, withAsync, wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog'
import { Listbox, ListboxItem, ListboxItemIndicator } from '@ui-sdk/react/listbox'
import { Check, X } from 'lucide-react'
import { useCategoryCatalog } from '../categories/categoryContext'
import { categoryDefinition, categoryOptions } from '../categories/catalog'
import { CategoryIcon } from '../components/CategoryIcon'
import { SheetGrip } from '../components/SheetGrip'
import { useDialogBack } from '../components/useDialogBack'
import { formatDate, money, needsTransferReview, type Category, type Transaction } from '../finance'
import { operationTitle } from '../operationPresentation'
import { RefundError } from '../refunds'
import { messageFor } from '../vault-ui/vaultModel'

type Props = {
  row: Transaction
  open: boolean
  allowTransfer: boolean
  finalFocus: () => HTMLElement | null
  onClose: () => void
  onCloseComplete?: () => void
  onSave: (category: Category) => Promise<void>
}

export default reatomFactoryComponent<Props>(() => {
  const save = action(async (submit: () => Promise<void>, close: () => void) => {
    await wrap(submit())
    close()
  }, 'operationCategory.save').extend(withAsync())

  return function OperationCategoryDialog({ row, open, allowTransfer, finalFocus, onClose, onCloseComplete, onSave }) {
    const catalog = useCategoryCatalog()
    const back = useDialogBack()
    const pending = save.pending() > 0
    const failure = save.error()
    const error = failure instanceof RefundError ? failure.message : failure && messageFor(failure, 'Не удалось сохранить изменение.')
    const title = operationTitle(row)
    const options = categoryOptions(catalog, row.amountMinor > 0 ? 'income' : 'expense', row.category)
    if (allowTransfer) options.push({ value: 'transfer', label: categoryDefinition(catalog, 'transfer').label })

    return (
      <Dialog presentation="auto" open={open} onOpenChange={wrap((next, details) => {
        if (next) return
        if (save.pending() > 0) {
          details.cancel()
          if (details.reason === 'back') back.rearm()
          return
        }
        onClose()
      })} onOpenChangeComplete={wrap((shown) => {
        if (shown) return
        save.error.set(undefined)
        onCloseComplete?.()
      })}>
        <DialogContent key={back.contentKey} initialFocus="content" finalFocus={finalFocus} data-list-sheet
          className="compact-dialog grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="dialog-header">
            <SheetGrip />
            <div className="min-w-0">
              <DialogTitle className="text-lg leading-tight">Категория операции</DialogTitle>
              <DialogDescription className="mt-0.5 grid min-w-0 text-xs text-muted">
                <span className="truncate font-semibold" title={title}>{title}</span>
                <span>{row.amountMinor > 0 ? '+' : ''}{money(row.amountMinor, row.currency, true)} · {formatDate(row.date)}</span>
              </DialogDescription>
            </div>
            <DialogClose className="dialog-close" aria-label="Закрыть" disabled={pending}><X size={16} aria-hidden="true" /></DialogClose>
          </div>
          <div data-slot="scroll" className="dialog-body">
            <Listbox value={needsTransferReview(row) ? null : row.category} activation="manual" aria-label="Категории"
              disabled={pending} className="w-full border-0 bg-transparent p-0"
              onValueChange={wrap((value) => {
                if (value && save.pending() === 0) void save(() => onSave(value), onClose).catch(() => undefined)
              })}>
              {options.map(({ value, label }) => (
                <ListboxItem key={value} value={value} label={label} className="choice-item focus-visible:outline-offset-[-2px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <CategoryIcon category={value} className="size-7 rounded-lg" />
                    <span>{label}</span>
                  </span>
                  <ListboxItemIndicator className="shrink-0"><Check size={16} aria-hidden="true" /></ListboxItemIndicator>
                </ListboxItem>
              ))}
            </Listbox>
          </div>
          {error && <p role="alert" className="error-text">{error}</p>}
        </DialogContent>
      </Dialog>
    )
  }
}, 'OperationCategoryDialog')
