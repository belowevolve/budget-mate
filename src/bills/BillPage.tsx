import { wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Dialog, DialogClose, DialogTrigger } from '@ui-sdk/react/dialog'
import { FilePlus, History, Save } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { DialogBody, DialogSurface } from '../shared/ui/DialogSurface'
import { Button, buttonVariants } from '../shared/ui/Button'
import { DialogHeader } from '../shared/ui/DialogHeader'
import { money, type Ledger, type Transaction } from '../finance'
import { formatDate } from '../shared/format'
import type { VaultWrite } from '../vault-ui/vaultModel'
import BillComposer from './BillComposer'
import { BillDrag } from './BillDrag'
import BillLink from './BillLink'
import BillParticipant from './BillParticipant'
import { billTotals, type Bill } from './bill'
import { reatomBillEditor } from './model'
import { FieldInput } from '../shared/ui/FieldInput'

function BillHistory({ bills, selected, onSelect }: { bills: Bill[]; selected: string; onSelect: (bill: Bill) => void }) {
  return (
    <Dialog presentation="auto">
      <DialogTrigger className={buttonVariants({ variant: 'secondary', size: 'icon', className: 'rounded-xl' })}
        aria-label="История счетов" disabled={!bills.length}>
        <History aria-hidden="true" />
      </DialogTrigger>
      <DialogSurface initialFocus="content" className="grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader title="История счетов" />
        <DialogBody as="ul" className="divide-y divide-line">
          {bills.map((bill) => (
            <li key={bill.id}>
              <DialogClose onClick={() => onSelect(bill)}
                className="flex h-auto min-h-11 w-full min-w-0 justify-between gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-sm text-ink shadow-none hover:bg-subtle"
                aria-current={selected === bill.id ? 'true' : undefined}>
                <span className="grid min-w-0">
                  <span className="truncate font-bold">{bill.title || 'Счёт'}</span>
                  <time className="text-xs text-muted" dateTime={bill.date}>{formatDate(bill.date)}</time>
                </span>
                <strong className="max-w-[45%] text-right wrap-anywhere tabular-nums">{money(billTotals(bill).total, bill.currency, true)}</strong>
              </DialogClose>
            </li>
          ))}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

export default reatomFactoryComponent<{
  ledger: Ledger; write: VaultWrite; notify: (message: string) => void; onOpenOperation: (row: Transaction) => void
  notifyWithUndo: (id: string, message: string, undo: () => Promise<boolean>) => void
}>(() => {
  const model = reatomBillEditor()

  return ({ ledger, write, notify, notifyWithUndo, onOpenOperation }) => {
    const scrollArea = useRef<HTMLDivElement>(null)
    useEffect(() => {
      const area = scrollArea.current
      if (!area) return
      const observer = new ResizeObserver(() => {
        const field = document.activeElement
        if (!(field instanceof HTMLInputElement) || !area.contains(field)) return
        const viewport = area.getBoundingClientRect()
        const bounds = field.getBoundingClientRect()
        if (bounds.bottom > viewport.bottom - 8) area.scrollTop += bounds.bottom - viewport.bottom + 8
        else if (bounds.top < viewport.top + 8) area.scrollTop -= viewport.top - bounds.top + 8
      })
      observer.observe(area)
      return () => observer.disconnect()
    }, [])

    const draft = model.draft()
    const { byPerson, total } = model.totals()
    const itemPeople = model.itemPeople()
    const saved = ledger.bills?.find((bill) => bill.id === draft.id)
    const ready = model.save.ready()
    const canSave = saved ? model.changed() : draft.items.length > 0

    return (
      <div className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
        <div ref={scrollArea} data-slot="scroll" className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain scroll-edges-y">
          <BillDrag key={draft.id} bill={draft} onMove={wrap(model.moveItem)} disabled={!ready}
            className="mx-auto grid w-full max-w-lg content-start gap-3 px-3 pt-3 pb-5 sm:px-5" aria-label="Позиции в счёте">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-1.5">
              <FieldInput className="text-base font-bold" aria-label="Название счёта" autoComplete="off"
                placeholder="Название счёта" maxLength={80} value={draft.title}
                onValueChange={wrap(model.setTitle)} disabled={!ready} />
              <Button variant="secondary" size="icon" className="rounded-xl" aria-label="Сохранить счёт" disabled={!canSave || !ready}
                onClick={wrap(() => model.save(write, notify))}>
                <Save aria-hidden="true" />
              </Button>
              <Button variant="secondary" size="icon" className="rounded-xl" aria-label="Новый счёт" disabled={!ready}
                onClick={wrap(() => model.openBill())}>
                <FilePlus aria-hidden="true" />
              </Button>
              <BillHistory bills={ledger.bills ?? []} selected={draft.id} onSelect={wrap(model.openBill)} />
            </div>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <time className="text-xs text-muted" dateTime={draft.date}>{formatDate(draft.date)}</time>
              <p className="text-sm font-medium wrap-anywhere">Итого <strong className="ml-1 text-lg font-extrabold tabular-nums">{money(total, draft.currency, true)}</strong></p>
            </div>
            {draft.people.map((person) => (
              <BillParticipant key={person.id} person={person} items={draft.items.filter((item) => item.personId === person.id)}
                subtotal={byPerson.get(person.id) ?? 0} currency={draft.currency} disabled={!ready}
                itemPeople={itemPeople} people={draft.people}
                onUpdateItem={wrap(model.updateItem)} onSetItemPeople={wrap(model.setItemPeople)} onRemoveItem={wrap(model.removeItem)}
                onRemovePerson={wrap((personId) => {
                  const removed = model.removePerson(personId)
                  if (!removed) return
                  const restore = wrap(() => model.restorePerson(removed))
                  notifyWithUndo(`bill-participant-${personId}`, 'Участник удалён', async () => restore())
                })} />
            ))}
            {saved && saved.items.length > 0 && !model.changed() &&
              <div className="border-t border-line pt-2">
                <BillLink key={saved.id} bill={saved} ledger={ledger} write={write} notify={notify} onOpenOperation={onOpenOperation} />
              </div>}
          </BillDrag>
        </div>

        <BillComposer people={draft.people} targets={model.targets()} fields={model.itemForm()} disabled={!ready} error={model.error()}
          onTargetsChange={wrap(model.setTargets)} onItemFieldChange={wrap(model.setItemField)}
          onAddItem={wrap(model.addItem)} onAddPerson={wrap(model.addPerson)} />
      </div>
    )
  }
}, 'BillPage')
