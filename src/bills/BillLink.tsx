import { action, atom, withAsync, wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Dialog, DialogContent, DialogTrigger } from '@ui-sdk/react/dialog'
import { Link2 } from 'lucide-react'
import { useMemo } from 'react'
import { Button, buttonVariants } from '../shared/ui/Button'
import { DialogHeader } from '../shared/ui/DialogHeader'
import Entry from '../components/journal/Entry'
import { groupJournalEntries } from '../components/journal/model'
import { VirtualOperationList } from '../components/journal/VirtualOperationList'
import type { Ledger, Transaction } from '../finance'
import { formatDate } from '../shared/format'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import { billExpenseOptions, setBillExpense, type Bill } from './bill'

export default reatomFactoryComponent<{
  bill: Bill; ledger: Ledger; write: VaultWrite
  notify: (message: string) => void; onOpenOperation: (row: Transaction) => void
}>(() => {
  const open = atom(false, 'billLink.open')
  const selected = atom<string | undefined>(undefined, 'billLink.selected')
  const error = atom('', 'billLink.error')

  const save = action(async (write: VaultWrite, billId: string, notify: (message: string) => void, expenseId?: string) => {
    error.set('')
    try {
      await wrap(write((current) => ({ ledger: setBillExpense(current, billId, expenseId), result: undefined })))
      open.set(false)
      notify(expenseId ? 'Операция привязана' : 'Операция отвязана')
    } catch (cause) {
      error.set(messageFor(cause, cause instanceof Error ? cause.message : 'Не удалось сохранить связь.'))
    }
  }, 'billLink.save').extend(withAsync())

  return ({ bill, ledger, write, notify, onOpenOperation }) => {
    const options = useMemo(() => billExpenseOptions(ledger, bill), [ledger, bill])
    const groups = useMemo(() => groupJournalEntries(options.map((row) => ({ row }))), [options])
    const linked = options.find((row) => row.id === bill.expenseId)
    const ready = save.ready()
    const chosenId = selected()

    return (
      <div className="grid min-w-0 gap-1.5">
        {linked && <>
          <h3 className="text-sm font-bold">Операция из выписки <span className="text-xs font-semibold text-muted">· {formatDate(linked.date)}</span></h3>
          <ul className="overflow-hidden rounded-xl border border-line bg-paper">
            <li><Entry row={linked} onSelect={onOpenOperation} exactAmount /></li>
          </ul>
        </>}
        <div className="flex flex-wrap gap-2">
          {options.length > 0 && (
            <Dialog presentation="auto" open={open()} onOpenChange={wrap((value, details) => {
              if (!save.ready()) details.cancel()
              else {
                if (value) {
                  selected.set(bill.expenseId)
                  error.set('')
                }
                open.set(value)
              }
            })}>
              <DialogTrigger className={buttonVariants({ variant: 'secondary' })} disabled={!ready}>
                <Link2 data-icon="inline-start" aria-hidden="true" /> {linked ? 'Изменить связь' : 'Связать с операцией'}
              </DialogTrigger>
              <DialogContent initialFocus="content" className="compact-dialog grid-rows-[auto_minmax(0,1fr)_auto]">
                <DialogHeader title="Операция из выписки" description="На сумму счёта или твоей доли" closeDisabled={!ready} />
                <div className="dialog-body" data-slot="scroll">
                  <VirtualOperationList groups={groups} ariaLabel="Подходящие операции" resetKey={bill.id}
                    renderEntry={(entry) => (
                      <Entry {...entry} exactAmount selection={{ selected: entry.row.id === chosenId, disabled: !ready }}
                        onSelect={wrap((row) => selected.set(row.id))} />
                    )}
                  />
                </div>
                <div className="grid gap-1">
                  {error() && <p className="error-text" role="alert">{error()}</p>}
                  <Button disabled={!ready || !chosenId || chosenId === bill.expenseId}
                    onClick={wrap(() => save(write, bill.id, notify, chosenId))}>Привязать</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {bill.expenseId && <Button variant="text" disabled={!ready} onClick={wrap(() => save(write, bill.id, notify))}>Отвязать</Button>}
        </div>
        {!options.length && <p className="text-xs text-muted">Связь появится после импорта операции на ту же сумму.</p>}
        {!open() && error() && <p className="error-text" role="alert">{error()}</p>}
      </div>
    )
  }
}, 'BillLink')
