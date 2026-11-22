import { wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Checkbox, CheckboxGroup } from '@ui-sdk/react/checkbox'
import { PenLine, Plus, X } from 'lucide-react'
import { useRef, type FormEvent } from 'react'
import { formatDate, money, type Ledger, type Transaction } from '../finance'
import type { VaultWrite } from '../vault-ui/vaultModel'
import BillLink from './BillLink'
import { billTotals, ownerId, type Bill, type BillItem } from './bill'
import { reatomBillEditor } from './model'

function Items({ draft, totals, edit, remove, removePerson }: {
  draft: Bill
  totals: Map<string, number>
  edit: (item: BillItem) => void
  remove: (id: string) => void
  removePerson: (id: string) => void
}) {
  const groups = new Map<string, BillItem[]>()
  for (const item of draft.items) {
    const items = groups.get(item.personId)
    if (items) items.push(item)
    else groups.set(item.personId, [item])
  }

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {draft.people.map((person) => {
        const items = groups.get(person.id) ?? []
        return (
          <section className="surface-panel card-padding" aria-label={person.name} key={person.id}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2">
              <h2 className="section-heading flex-1">{person.name}</h2>
              <strong className="text-sm font-extrabold tabular-nums">{money(totals.get(person.id) ?? 0, draft.currency, true)}</strong>
              {person.id !== ownerId && !items.length &&
                <Button className="btn-icon size-8" aria-label={`Убрать участника ${person.name}`} onClick={() => removePerson(person.id)}><X size={15} aria-hidden="true" /></Button>}
            </div>
            {items.length > 0 && <ul className="mt-1 divide-y divide-line">
              {items.map((item) => (
                <li className="flex min-w-0 items-center gap-1" key={item.id}>
                  <Button className="flex h-auto min-h-11 min-w-0 flex-1 justify-between gap-1.5 rounded-lg border-0 bg-transparent p-1.5 text-left text-ink shadow-none hover:bg-subtle" onClick={() => edit(item)}>
                    <span className="grid min-w-0">
                      <span className="truncate text-sm font-semibold">{item.name}</span>
                      <span className="text-xs text-muted">{money(item.priceMinor, draft.currency, true)} × {item.quantity}</span>
                    </span>
                    <span className="flex max-w-[45%] items-center gap-1.5 text-right text-sm font-bold wrap-anywhere">
                      {money(item.priceMinor * item.quantity, draft.currency, true)}<PenLine size={14} className="shrink-0 text-muted" aria-hidden="true" />
                    </span>
                  </Button>
                  <Button className="btn-icon size-8" aria-label={`Убрать: ${item.name}`} onClick={() => remove(item.id)}><X size={15} aria-hidden="true" /></Button>
                </li>
              ))}
            </ul>}
          </section>
        )
      })}
    </div>
  )
}

export default reatomFactoryComponent<{ ledger: Ledger; write: VaultWrite; notify: (message: string) => void; onOpenOperation: (row: Transaction) => void }>(() => {
  const model = reatomBillEditor()

  return ({ ledger, write, notify, onOpenOperation }) => {
    const itemForm = useRef<HTMLFormElement>(null)
    const draft = model.draft()
    const { byPerson, total } = model.totals()
    const saved = ledger.bills?.find((bill) => bill.id === draft.id)
    const fields = model.itemForm()
    const editing = model.editing()
    const ready = model.save.ready()
    const canSave = saved ? model.changed() : draft.items.length > 0

    return (
      <div className="grid min-w-0 gap-3">
        <section className="surface-panel card-padding grid min-w-0 gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold text-muted">Всего по счёту</h2>
              <p className="text-2xl font-extrabold tracking-tight wrap-anywhere tabular-nums">{money(total, draft.currency, true)}</p>
            </div>
            <Button className="btn-secondary" disabled={!ready} onClick={wrap(() => model.openBill())}><Plus size={17} aria-hidden="true" /> Новый</Button>
          </div>
          <Input className="field-input text-base" aria-label="Название счёта" autoComplete="off"
            placeholder="Название счёта" maxLength={80} value={draft.title}
            onValueChange={wrap(model.setTitle)} disabled={!ready} />
        </section>

        <form className="surface-panel card-padding grid gap-1.5" onSubmit={wrap((event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          const person = String(new FormData(event.currentTarget).get('person') ?? '')
          if (model.addPerson(person)) event.currentTarget.reset()
        })}>
          <label htmlFor="bill-person" className="text-sm font-bold">Участники</label>
          <div className="flex min-w-0 items-center gap-2">
            <Input className="field-input flex-1 text-base" id="bill-person" name="person" placeholder="Имя" autoComplete="off" maxLength={40} required disabled={!ready} />
            <Button type="submit" className="btn-secondary px-3" disabled={!ready}>Добавить</Button>
          </div>
        </form>

        <form ref={itemForm} className="surface-panel card-padding grid min-w-0 gap-2.5" onSubmit={wrap((event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          model.addItem()
        })}>
          <h2 className="section-heading">{editing ? 'Изменить позицию' : 'Добавить позицию'}</h2>
          {!editing && <CheckboxGroup value={model.targets()} onValueChange={wrap(model.setTargets)}
            aria-label="Кому добавить позицию" className="flex min-w-0 flex-wrap gap-1.5">
            {draft.people.map((person) => (
              <Checkbox key={person.id} value={person.id} disabled={!ready}
                className="btn-text min-h-10 w-auto max-w-full rounded-xl border border-line px-3 data-checked:bg-selected">
                <span className="truncate">{person.name}</span>
              </Checkbox>
            ))}
          </CheckboxGroup>}
          <Field className="grid min-w-0 gap-1">
            <FieldLabel className="text-sm font-bold">Позиция</FieldLabel>
            <Input className="field-input text-base" autoComplete="off" placeholder="Например, кофе" maxLength={80} value={fields.name} disabled={!ready}
              onValueChange={wrap((value) => model.setItemField('name', value))} />
          </Field>
          <div className="grid min-w-0 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-2">
            <Field className="grid min-w-0 gap-1">
              <FieldLabel className="text-sm font-bold">Цена за шт., ₽</FieldLabel>
              <Input className="field-input text-base" autoComplete="off" inputMode="decimal" placeholder="0,00" maxLength={13} required value={fields.price} disabled={!ready}
                onValueChange={wrap((value) => model.setItemField('price', value))} />
            </Field>
            <Field className="grid min-w-0 gap-1">
              <FieldLabel className="text-sm font-bold">Количество</FieldLabel>
              <Input className="field-input text-base" autoComplete="off" inputMode="numeric" maxLength={3} required value={fields.quantity} disabled={!ready}
                onValueChange={wrap((value) => model.setItemField('quantity', value))} />
            </Field>
          </div>
          {model.error() && <p className="error-text" role="alert">{model.error()}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {editing && <Button className="btn-text" onClick={wrap(() => model.editItem())}>Отмена</Button>}
            <Button className="btn-primary" type="submit" disabled={!ready}>{editing ? 'Сохранить позицию' : 'Добавить позицию'}</Button>
          </div>
        </form>

        <Items draft={draft} totals={byPerson} edit={wrap((item) => {
          model.editItem(item)
          itemForm.current?.scrollIntoView({ block: 'nearest' })
        })} remove={wrap(model.removeItem)} removePerson={wrap(model.removePerson)} />

        {(draft.items.length > 0 || saved) && (
          <section className="surface-panel card-padding grid min-w-0 gap-2">
            <Button className="btn-primary justify-self-start"
              disabled={!canSave || !ready}
              onClick={wrap(() => model.save(write, notify))}>{canSave ? 'Сохранить счёт' : 'Счёт сохранён'}</Button>
            {saved && saved.items.length > 0 && !model.changed() && <BillLink key={saved.id} bill={saved} ledger={ledger} write={write} notify={notify} onOpenOperation={onOpenOperation} />}
          </section>
        )}

        {!!ledger.bills?.length && <section className="surface-panel card-padding">
          <h2 className="section-heading">Сохранённые счета</h2>
          <ul className="mt-1 divide-y divide-line">
            {ledger.bills.map((bill) => (
              <li key={bill.id}>
                <Button className="flex h-auto min-h-11 w-full min-w-0 justify-between gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-ink shadow-none hover:bg-subtle data-selected:bg-selected"
                  aria-current={draft.id === bill.id ? 'true' : undefined} data-selected={draft.id === bill.id || undefined}
                  disabled={!ready} onClick={wrap(() => model.openBill(bill))}>
                  <span className="grid min-w-0">
                    <span className="truncate text-sm font-bold">{bill.title || 'Счёт'}</span>
                    <span className="text-xs text-muted">{formatDate(bill.date)}</span>
                  </span>
                  <strong className="max-w-[45%] text-right text-sm wrap-anywhere tabular-nums">{money(billTotals(bill).total, bill.currency, true)}</strong>
                </Button>
              </li>
            ))}
          </ul>
        </section>}
      </div>
    )
  }
}, 'BillPage')
