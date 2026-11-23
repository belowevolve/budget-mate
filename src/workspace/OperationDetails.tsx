import { action, atom, withAsync, wrap } from '@reatom/core'
import { reatomFactoryComponent, useAction } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog'
import { ArrowLeftRight, Link2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useCategoryCatalog } from '../categories/categoryContext'
import { categoryDefinition } from '../categories/catalog'
import { CategoryIcon } from '../components/CategoryIcon'
import Entry from '../components/journal/Entry'
import { banks, formatDate, money, needsTransferReview, type Category, type Transaction } from '../finance'
import { operationTitle } from '../operationPresentation'
import type { Place } from '../places/model'
import OperationPlaceEditor from '../places/OperationPlaceEditor'
import { isRefundIncome, RefundError, type RefundIndex } from '../refunds'
import { ChoiceTriggerContent } from '../shared/ui/ChoiceTriggerContent'
import { DialogHeaderFrame } from '../shared/ui/DialogHeader'
import { useDialogBackRecovery } from '../shared/ui/popupBack'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import OperationCategoryDialog from './OperationCategoryDialog'
import RefundPicker from './RefundPicker'
import type { OperationPane } from './workspaceState'

type OperationDetailsProps = {
  row: Transaction
  pane: OperationPane
  transactions: Transaction[]
  places: Place[]
  write: VaultWrite
  refunds: RefundIndex
  onClose: () => void
  onOpen: (row: Transaction, pane?: OperationPane) => void
  onSave: (category: Category) => Promise<void>
  onSaveRefund: (expenseId: string | null) => Promise<void>
}

function reatomOperationDetails() {
  const open = atom(false, 'operationDetails.open')
  const show = action(() => open.set(true), 'operationDetails.show')
  const close = action(() => open.set(false), 'operationDetails.close')
  const save = action(async (submit: () => Promise<void>) => {
    await wrap(submit())
    close()
  }, 'operationDetails.save').extend(withAsync())
  return { open, show, close, save }
}

function RelatedOperations({ label, summary, rows, onSelect }: {
  label: string
  summary?: string
  rows: readonly Transaction[]
  onSelect: (row: Transaction) => void
}) {
  return (
    <section aria-label={label} className="grid min-w-0 gap-0.5 border-t border-line pt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-1.5 px-1 text-xs text-muted">
        <span className="font-bold">{label}</span>
        {summary && <span>{summary}</span>}
      </div>
      <ul className="min-w-0 list-none divide-y divide-line">
        {rows.map((row) => (
          <li key={row.id}><Entry row={row} showDate exactAmount onSelect={onSelect} /></li>
        ))}
      </ul>
    </section>
  )
}

export default reatomFactoryComponent<OperationDetailsProps>(() => {
  const model = reatomOperationDetails()

  return function OperationDetails({ row, pane, transactions, places, write, refunds, onClose, onOpen, onSave, onSaveRefund }) {
    const content = useRef<HTMLDivElement>(null)
    const [categoryOpen, setCategoryOpen] = useState(false)
    const categoryTrigger = useRef<HTMLElement | null>(null)
    const entryCategoryTrigger = useRef<HTMLElement | null>(null)
    const catalog = useCategoryCatalog()
    const back = useDialogBackRecovery()
    const show = useAction(model.show)
    // An initially open ui-sdk sheet mounts at its final snap point.
    useEffect(() => { show() }, [show])
    useLayoutEffect(() => {
      const focused = document.activeElement
      entryCategoryTrigger.current = focused instanceof HTMLElement && focused.dataset.operationCategoryTrigger === row.id
        ? focused
        : null
    }, [row.id])
    useLayoutEffect(() => {
      content.current?.focus({ preventScroll: true })
    }, [pane])

    const category = row.category
    const pending = model.save.pending() > 0
    const failure = model.save.error()
    const error = failure ? failure instanceof RefundError ? failure.message : messageFor(failure, 'Не удалось сохранить изменение.') : undefined
    const refundTarget = refunds.byIncome.get(row.id)
    const compensation = refunds.byExpense.get(row.id)
    const requiresReview = !refundTarget && needsTransferReview(row)
    const title = refundTarget ? 'Компенсация расхода' : operationTitle(row)
    const account = row.accountLabel || banks[row.bank]
    const canEditCategory = !refundTarget
    const canMarkTransfer = row.category !== 'transfer' && !compensation && !refundTarget
    const canRefund = isRefundIncome(row)
    const hasFooter = pane === 'refund' || (pane === 'details' && (canMarkTransfer || canRefund))
    const kind = row.amountMinor > 0 ? 'income' : 'expense'

    function save(submit: () => Promise<void>) {
      return model.save(submit).catch(() => undefined)
    }

    function openCategory(trigger: HTMLElement | null) {
      categoryTrigger.current = trigger
      setCategoryOpen(true)
    }

    function restoreJournalFocus() {
      return (entryCategoryTrigger.current?.isConnected ? entryCategoryTrigger.current : null)
        ?? (pane === 'category' ? document.querySelector<HTMLElement>(`[data-operation-category-trigger="${CSS.escape(row.id)}"]`) : null)
        ?? document.querySelector<HTMLElement>(`[data-operation-trigger="${CSS.escape(row.id)}"]`)
        ?? document.querySelector<HTMLElement>('nav [aria-current="page"]')
    }

    if (pane === 'category') {
      return <OperationCategoryDialog row={row} open={model.open()} allowTransfer={!compensation} onSave={onSave}
        finalFocus={restoreJournalFocus} onClose={wrap(model.close)} onCloseComplete={onClose} />
    }

    return (
      <Dialog presentation="auto" open={model.open()}
        onOpenChange={wrap((open, details) => {
          if (open) return
          const saving = model.save.pending() > 0
          const nativeBack = details.reason === 'back'
          const backToDetails = pane === 'refund' && (nativeBack || details.reason === 'escape-key')
          if (saving || backToDetails) {
            details.cancel()
            back.onCanceledClose(details.reason)
            if (!saving) onOpen(row)
            return
          }
          model.close()
        })} onOpenChangeComplete={wrap((open) => { if (!open) onClose() })}>
        <DialogContent key={back.contentKey} ref={content} initialFocus="content" finalFocus={restoreJournalFocus}
          className={`compact-dialog ${hasFooter ? 'grid-rows-[auto_minmax(0,1fr)_auto]' : 'grid-rows-[auto_minmax(0,1fr)]'}`}>
          {pane === 'refund' ? (
            <RefundPicker row={row} transactions={transactions} refunds={refunds} pending={pending} error={error}
              onBack={wrap(() => onOpen(row))} onSave={wrap((expenseId) => save(() => onSaveRefund(expenseId)))} />
          ) : (
            <>
              <DialogHeaderFrame closeDisabled={pending}>
                <div className="min-w-0">
                  <DialogTitle className="sr-only">{title}</DialogTitle>
                  <DialogDescription className="sr-only">{account} · {formatDate(row.date)}</DialogDescription>
                  <Entry row={row} caption={account} showDate exactAmount refundTarget={refundTarget} refundMinor={compensation?.totalMinor}
                    onChangeCategory={canEditCategory ? () => openCategory(content.current?.querySelector('[data-operation-category-trigger]') ?? null) : undefined} />
                </div>
              </DialogHeaderFrame>
              <div data-slot="scroll" className="dialog-body grid content-start gap-2">
                {requiresReview && <p className="text-xs text-muted">Неопознанный перевод. Сумма пока вне итогов.</p>}
                {refundTarget && (
                  <RelatedOperations label="Связанный расход" rows={[refundTarget]} onSelect={wrap(onOpen)} />
                )}
                {compensation && (
                  <RelatedOperations label="Компенсации" summary={`По выписке ${money(row.amountMinor, row.currency, true)}`}
                    rows={compensation.incomes} onSelect={wrap(onOpen)} />
                )}
                {canEditCategory && (
                  <Button aria-label="Категория операции" className="choice-trigger w-full min-w-0 text-start"
                    onClick={(event) => openCategory(event.currentTarget)} disabled={pending}>
                    <ChoiceTriggerContent icon={<CategoryIcon category={category} className="size-7 rounded-lg" />} direction="next">
                      {categoryDefinition(catalog, category, kind).label}
                    </ChoiceTriggerContent>
                  </Button>
                )}
                <OperationPlaceEditor row={row} places={places} write={write} disabled={pending} />
                {row.description && (row.description !== title || title.length > 50) && (
                  <dl className="grid min-w-0 gap-0.5 text-xs text-muted">
                    <dt className="font-bold">Из выписки</dt>
                    <dd className="wrap-anywhere">{row.description}</dd>
                  </dl>
                )}
                {error && <p role="alert" className="error-text">{error}</p>}
              </div>
              {hasFooter && <div className="flex min-w-0 flex-wrap gap-1.5">
                {canRefund && <Button className="btn-text min-w-0 px-2 whitespace-normal" disabled={pending}
                  onClick={wrap(() => onOpen(row, 'refund'))}>
                  <Link2 size={16} className="shrink-0" aria-hidden="true" />К расходу
                </Button>}
                {canMarkTransfer && <Button className="btn-secondary min-w-0 flex-1 px-2 whitespace-normal" disabled={pending}
                  onClick={wrap(() => save(() => onSave('transfer')))}>
                  <ArrowLeftRight size={16} className="shrink-0" aria-hidden="true" /><span>Свой перевод</span>
                </Button>}
              </div>}
              <OperationCategoryDialog row={row} open={categoryOpen} allowTransfer={!compensation} onSave={onSave}
                finalFocus={() => categoryTrigger.current?.isConnected ? categoryTrigger.current : content.current}
                onClose={() => setCategoryOpen(false)} />
            </>
          )}
        </DialogContent>
      </Dialog>
    )
  }
}, 'OperationDetails')
