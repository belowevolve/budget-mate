import { action, atom, withAsync, wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog'
import { ArrowLeftRight, ChevronRight, Clock, Link2, X } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { CategoryIcon } from '../components/CategoryIcon'
import { Choice } from '../components/Choice'
import { SheetGrip } from '../components/SheetGrip'
import { banks, categories, formatDate, money, needsTransferReview, transactionAccountingAmount, type Category, type Transaction } from '../finance'
import { operationTitle } from '../operationPresentation'
import { isRefundIncome, RefundError, type RefundIndex } from '../refunds'
import { messageFor } from '../vault-ui/vaultModel'
import RefundPicker from './RefundPicker'
import type { OperationPane } from './workspaceState'

type OperationDetailsProps = {
  row: Transaction
  pane: OperationPane
  transactions: Transaction[]
  refunds: RefundIndex
  onClose: () => void
  onOpen: (row: Transaction, pane?: OperationPane) => void
  onSave: (category: Category) => Promise<void>
  onSaveRefund: (expenseId: string | null) => Promise<void>
}

function reatomOperationDetails(initialCategory: Category) {
  const open = atom(true, 'operationDetails.open')
  const category = atom(initialCategory, 'operationDetails.category')
  const close = action(() => open.set(false), 'operationDetails.close')
  const save = action(async (submit: () => Promise<void>) => {
    await wrap(submit())
    close()
  }, 'operationDetails.save').extend(withAsync())
  return { open, close, category, save }
}

function LinkedOperation({ row, onOpen }: { row: Transaction; onOpen: () => void }) {
  const title = operationTitle(row)
  return (
    <Button className="grid h-auto min-h-12 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 rounded-lg border-0 bg-paper px-2 py-1.5 text-left text-ink shadow-none hover:bg-subtle"
      onClick={onOpen}>
      <CategoryIcon category={row.category} />
      <span className="grid min-w-0 gap-px text-sm leading-tight">
        <span className="truncate font-bold" title={title}>{title}</span>
        <time className="truncate text-xs text-muted" dateTime={row.date}>{formatDate(row.date)}</time>
      </span>
      <span className="max-w-24 text-right text-xs font-bold wrap-anywhere tabular-nums">{money(row.amountMinor, row.currency, true)}</span>
      <ChevronRight size={16} className="text-muted" aria-hidden="true" />
    </Button>
  )
}

export default reatomFactoryComponent<OperationDetailsProps>(({ row }) => {
  const model = reatomOperationDetails(row.category)

  return function OperationDetails({ row, pane, transactions, refunds, onClose, onOpen, onSave, onSaveRefund }) {
    const content = useRef<HTMLDivElement>(null)
    useLayoutEffect(() => {
      content.current?.focus({ preventScroll: true })
    }, [pane])

    const category = model.category()
    const pending = model.save.pending() > 0
    const failure = model.save.error()
    const error = failure ? failure instanceof RefundError ? failure.message : messageFor(failure, 'Не удалось сохранить изменение.') : undefined
    const refundTarget = refunds.byIncome.get(row.id)
    const compensation = refunds.byExpense.get(row.id)
    const title = refundTarget ? 'Компенсация расхода' : operationTitle(row)
    const account = row.accountLabel || banks[row.bank]
    const canEditCategory = !refundTarget
    const canMarkTransfer = row.category !== 'transfer' && !compensation && !refundTarget
    const categoryOptions = (Object.keys(categories) as Category[])
      .filter((key) => row.amountMinor > 0 ? key === 'income' || key === 'transfer' : key !== 'income' && (!compensation || key !== 'transfer'))
      .map((value) => ({ value, label: categories[value].label, icon: <CategoryIcon category={value} className="size-7 rounded-lg" /> }))

    function save(submit: () => Promise<void>) {
      return model.save(submit).catch(() => undefined)
    }

    return (
      <Dialog presentation="auto" open={model.open()} onOpenChange={wrap((open, details) => {
        if (model.save.pending() > 0) details.cancel()
        else if (!open) model.close()
      })} onOpenChangeComplete={wrap((open) => { if (!open) onClose() })}>
        <DialogContent ref={content} initialFocus="content" finalFocus={() => (
          document.querySelector<HTMLElement>(`[data-operation-trigger="${CSS.escape(row.id)}"]`)
            ?? document.querySelector<HTMLElement>('nav [aria-current="page"]')
        )} className="compact-dialog grid-rows-[auto_minmax(0,1fr)_auto]">
          {pane === 'refund' ? (
            <RefundPicker row={row} transactions={transactions} refunds={refunds} pending={pending} error={error}
              onBack={wrap(() => onOpen(row))} onSave={wrap((expenseId) => save(() => onSaveRefund(expenseId)))} />
          ) : (
            <>
              <div className="dialog-header">
                <SheetGrip />
                <div className="min-w-0">
                  <DialogTitle className="line-clamp-2 text-lg leading-tight wrap-anywhere">{title}</DialogTitle>
                  <DialogDescription className="mt-0.5 flex min-w-0 flex-wrap gap-x-1.5 text-xs text-muted">
                    <span className="min-w-0 max-w-full truncate" title={account}>{account}</span>
                    <time className="shrink-0" dateTime={row.date}>{formatDate(row.date)}</time>
                  </DialogDescription>
                </div>
                <DialogClose className="btn-icon" aria-label="Закрыть" disabled={pending}><X size={17} aria-hidden="true" /></DialogClose>
              </div>
              <div data-slot="scroll" className="dialog-body grid content-start gap-2 pt-0.5">
                <div>
                  {compensation && <p className="text-xs text-muted">Фактический расход</p>}
                  <p className="text-2xl leading-tight font-extrabold tracking-tight wrap-anywhere tabular-nums" dir="auto">
                    {money(refundTarget ? row.amountMinor : transactionAccountingAmount(row, refunds), row.currency, true)}
                  </p>
                  {row.status === 'pending' && <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-warning"><Clock size={13} aria-hidden="true" /> В обработке</p>}
                </div>
                {!refundTarget && needsTransferReview(row) && <p className="text-xs text-muted">Перевод без подтверждённого получателя</p>}
                {refundTarget && (
                  <section aria-label="Связанный расход" className="grid min-w-0 gap-1.5 rounded-xl bg-transfer-soft p-2 text-transfer">
                    <span className="px-1 text-xs font-bold">Связанный расход</span>
                    <LinkedOperation row={refundTarget} onOpen={wrap(() => onOpen(refundTarget))} />
                  </section>
                )}
                {compensation && (
                  <section aria-label="Компенсации" className="grid min-w-0 gap-1.5 rounded-xl bg-transfer-soft p-2 text-transfer">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-1.5 px-1 text-xs">
                      <span className="font-bold">Компенсации</span>
                      <span>По выписке {money(row.amountMinor, row.currency, true)}</span>
                    </div>
                    <ul className="grid min-w-0 list-none gap-1">
                      {compensation.incomes.map((income) => (
                        <li key={income.id}>
                          <LinkedOperation row={income} onOpen={wrap(() => onOpen(income))} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {canEditCategory && <Choice label="Категория операции" value={category} className="w-full min-w-0" presentation="auto"
                  onChange={wrap((value) => model.category.set(value as Category))} options={categoryOptions} />}
                {(row.description !== title || title.length > 50) && (
                  <details className="min-w-0 text-xs text-muted">
                    <summary className="cursor-pointer py-1 font-bold text-primary">Из выписки</summary>
                    <p className="mt-1 wrap-anywhere">{row.description}</p>
                  </details>
                )}
                {isRefundIncome(row) && <Button className="btn-secondary w-full min-w-0 whitespace-normal" disabled={pending}
                  onClick={wrap(() => onOpen(row, 'refund'))}>
                  <Link2 size={16} className="shrink-0" aria-hidden="true" />{refundTarget ? 'Изменить связь' : 'Привязать к расходу'}
                </Button>}
                {error && <p role="alert" className="error-text">{error}</p>}
              </div>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {canMarkTransfer && <Button className="btn-secondary min-w-0 flex-1 px-2 whitespace-normal" disabled={pending}
                  onClick={wrap(() => save(() => onSave('transfer')))}>
                  <ArrowLeftRight size={16} className="shrink-0" aria-hidden="true" /><span>Свой перевод</span>
                </Button>}
                {canEditCategory && <Button className="btn-primary min-w-0 flex-1 px-2 whitespace-normal" disabled={pending}
                  onClick={wrap(() => save(() => onSave(category)))}>
                  Сохранить
                </Button>}
                {refundTarget && <Button className="btn-secondary min-w-0 flex-1 px-2 whitespace-normal" disabled={pending}
                  onClick={wrap(() => save(() => onSaveRefund(null)))}>
                  Отвязать компенсацию
                </Button>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    )
  }
}, 'OperationDetails')
