import { NumberInput, NumberInputControl, NumberInputDecrement, NumberInputGroup, NumberInputIncrement } from '@ui-sdk/react/number-input'
import { Minus, Plus, X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { money } from '../finance'
import { Button } from '../shared/ui/Button'
import { BillDragItem, BillDragList, BillDragSurface } from './BillDrag'
import BillSharePicker from './BillSharePicker'
import { billItemGroup, ownerId, type BillItem, type BillItemChanges, type BillPerson } from './bill'
import { FieldInput, FieldInputElement } from '../shared/ui/FieldInput'
import { SectionHeading } from '../shared/ui/Text'

const quantityFormat = { useGrouping: false, maximumFractionDigits: 0 }
const priceFormat = { useGrouping: false, maximumFractionDigits: 2 }

function QuantityStep({ increment, ...props }: ComponentProps<typeof NumberInputIncrement> & { increment?: boolean }) {
  const Step = increment ? NumberInputIncrement : NumberInputDecrement
  const Icon = increment ? Plus : Minus
  return (
    <Step {...props} className="grid h-9 w-full min-w-0 place-items-center rounded-none border-0 bg-transparent p-0 text-primary shadow-none first:rounded-s-[calc(var(--radius-xl)-1px)] last:rounded-e-[calc(var(--radius-xl)-1px)] focus-visible:-outline-offset-2 enabled:hover:bg-selected disabled:opacity-35">
      <Icon size={14} aria-hidden="true" />
    </Step>
  )
}

export default function BillParticipant({ person, items, subtotal, currency, disabled, itemPeople, people, onUpdateItem, onSetItemPeople, onRemoveItem, onRemovePerson }: {
  person: BillPerson; items: BillItem[]; subtotal: number; currency: string; disabled: boolean
  itemPeople: ReadonlyMap<string, ReadonlySet<string>>; people: BillPerson[]
  onUpdateItem: (id: string, changes: BillItemChanges) => boolean
  onSetItemPeople: (id: string, personIds: string[]) => boolean
  onRemoveItem: (id: string) => void
  onRemovePerson: (id: string) => void
}) {
  return (
    <BillDragList value={person.id}>
      <div className="flex min-w-0 items-center gap-2">
        <SectionHeading>{person.name}</SectionHeading>
        <strong className="min-w-0 text-sm wrap-anywhere tabular-nums">{money(subtotal, currency, true)}</strong>
        {person.id !== ownerId &&
          <Button variant="secondary" size="icon-sm" className="ms-auto" aria-label={`Убрать участника ${person.name}`} disabled={disabled}
            onClick={() => onRemovePerson(person.id)}>
            <X aria-hidden="true" />
          </Button>}
      </div>
      {items.length > 0 ? <ul className="grid min-w-0 gap-1.5" aria-label={`Позиции участника ${person.name}`}>
        {items.map((item) => {
          const description = item.name || 'Позиция'
          const assigned = itemPeople.get(billItemGroup(item))
          const canMove = !disabled && (items.length > 1 || people.some(({ id }) => id !== person.id && !assigned?.has(id)))
          return (
            <BillDragItem key={item.id} value={item.id} personId={person.id}
              tabIndex={canMove ? 0 : undefined}
              aria-label={canMove ? `Переместить позицию «${description}»` : undefined}
              aria-description={canMove ? 'Пробел выбирает и отпускает. Стрелки влево и вправо меняют участника, вверх и вниз меняют порядок.' : undefined}>
              <div className="flex min-w-0 items-center gap-1.5">
                <FieldInput className="h-9 min-h-0 flex-1 px-2.5 text-base font-semibold shadow-none" aria-label={`Название позиции: ${description}`} autoComplete="off"
                  placeholder="Позиция" disabled={disabled} maxLength={80} value={item.name}
                  onValueChange={(value) => { onUpdateItem(item.id, { name: value }) }} />
                {people.length > 1 && <BillSharePicker name={description} price={money(item.priceMinor, currency, true)}
                  personId={person.id} people={people} assigned={assigned}
                  disabled={disabled} onApply={(personIds) => onSetItemPeople(item.id, personIds)} />}
                <Button variant="secondary" size="icon-sm" aria-label={`Убрать: ${description}`} disabled={disabled}
                  onClick={() => onRemoveItem(item.id)}>
                  <X aria-hidden="true" />
                </Button>
              </div>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_6.25rem_auto_minmax(0,1fr)] items-center gap-1">
                <NumberInput className="min-w-0" locale="ru-RU" format={priceFormat} value={item.priceMinor / 100}
                  min={0.01} max={999999999.99} step={0.01} disabled={disabled}
                  onValueChange={(value, details) => {
                    if (value === null || !onUpdateItem(item.id, { priceMinor: Math.round(value * 100) })) details.cancel()
                  }}>
                  <NumberInputGroup className="w-full">
                    <NumberInputControl aria-label={`Цена за штуку: ${description}`} inputMode="decimal" autoComplete="off"
                      render={<FieldInputElement />} className="mx-0 h-9 min-h-0 px-2.5 text-right text-base tabular-nums" />
                  </NumberInputGroup>
                </NumberInput>
                <span className="text-muted" aria-hidden="true">×</span>
                <NumberInput className="min-w-0" format={quantityFormat} value={item.quantity} min={1} max={999} step={1} smallStep={1}
                  disabled={disabled} onValueChange={(value, details) => {
                    if (value === null || !Number.isInteger(value) || !onUpdateItem(item.id, { quantity: value })) details.cancel()
                  }}>
                  <NumberInputGroup className="grid grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] gap-0 rounded-xl border border-field-line bg-field">
                    <QuantityStep aria-label={`Убавить: ${description}`} />
                    <NumberInputControl
                      className="mx-0 h-9 w-full min-w-0 rounded-none border-0 border-x border-line bg-transparent px-0 text-center text-base tabular-nums shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                      aria-label={`Количество: ${description}`} inputMode="numeric" autoComplete="off" />
                    <QuantityStep increment aria-label={`Прибавить: ${description}`} />
                  </NumberInputGroup>
                </NumberInput>
                <span className="text-muted" aria-hidden="true">=</span>
                <strong className="min-w-0 text-right text-sm wrap-anywhere tabular-nums">{money(item.priceMinor * item.quantity, currency, true)}</strong>
              </div>
              {canMove && <BillDragSurface value={item.id} aria-hidden="true" />}
            </BillDragItem>
          )
        })}
      </ul> : <p className="text-sm text-muted">Пока без позиций</p>}
    </BillDragList>
  )
}
