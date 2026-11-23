import { Button } from '@ui-sdk/react/button'
import { Input } from '@ui-sdk/react/input'
import { NumberInput, NumberInputControl, NumberInputDecrement, NumberInputGroup, NumberInputIncrement } from '@ui-sdk/react/number-input'
import { Minus, Plus, X } from 'lucide-react'
import { money } from '../finance'
import { BillDragItem, BillDragList, BillDragSurface } from './BillDrag'
import BillSharePicker from './BillSharePicker'
import { billItemGroup, ownerId, type BillItem, type BillItemChanges, type BillPerson } from './bill'

const quantityFormat = { useGrouping: false, maximumFractionDigits: 0 }
const priceFormat = { useGrouping: false, maximumFractionDigits: 2 }

export default function BillParticipant({ person, items, subtotal, currency, disabled, itemPeople, people, onUpdateItem, onSetItemPeople, onRemoveItem, onRemovePerson }: {
  person: BillPerson; items: BillItem[]; subtotal: number; currency: string; disabled: boolean
  itemPeople: ReadonlyMap<string, ReadonlySet<string>>; people: BillPerson[]
  onUpdateItem: (id: string, changes: BillItemChanges) => boolean
  onSetItemPeople: (id: string, personIds: string[]) => boolean
  onRemoveItem: (id: string) => void
  onRemovePerson: (id: string) => void
}) {
  return (
    <BillDragList value={person.id} className="bill-item-list">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="section-heading">{person.name}</h2>
        <strong className="min-w-0 text-sm wrap-anywhere tabular-nums">{money(subtotal, currency, true)}</strong>
        {person.id !== ownerId &&
          <Button className="btn-icon ml-auto size-9" aria-label={`Убрать участника ${person.name}`} disabled={disabled}
            onClick={() => onRemovePerson(person.id)}><X size={15} aria-hidden="true" /></Button>}
      </div>
      {items.length > 0 ? <ul className="grid min-w-0 gap-1.5" aria-label={`Позиции участника ${person.name}`}>
        {items.map((item) => {
          const description = item.name || 'Позиция'
          const assigned = itemPeople.get(billItemGroup(item))
          const canMove = !disabled && (items.length > 1 || people.some(({ id }) => id !== person.id && !assigned?.has(id)))
          return (
            <BillDragItem className="bill-item" key={item.id} value={item.id} personId={person.id}
              tabIndex={canMove ? 0 : undefined}
              aria-label={canMove ? `Переместить позицию «${description}»` : undefined}
              aria-description={canMove ? 'Пробел выбирает и отпускает. Стрелки влево и вправо меняют участника, вверх и вниз меняют порядок.' : undefined}>
              <div className="flex min-w-0 items-center gap-1.5">
                <Input className="field-input bill-item-title" aria-label={`Название позиции: ${description}`} autoComplete="off"
                  placeholder="Позиция" disabled={disabled} maxLength={80} value={item.name}
                  onValueChange={(value) => { onUpdateItem(item.id, { name: value }) }} />
                {people.length > 1 && <BillSharePicker name={description} price={money(item.priceMinor, currency, true)}
                  personId={person.id} people={people} assigned={assigned}
                  disabled={disabled} onApply={(personIds) => onSetItemPeople(item.id, personIds)} />}
                <Button className="btn-icon size-9" aria-label={`Убрать: ${description}`} disabled={disabled}
                  onClick={() => onRemoveItem(item.id)}><X size={15} aria-hidden="true" /></Button>
              </div>
              <div className="bill-item-equation">
                <NumberInput className="min-w-0" locale="ru-RU" format={priceFormat} value={item.priceMinor / 100}
                  min={0.01} max={999999999.99} step={0.01} disabled={disabled}
                  onValueChange={(value, details) => {
                    if (value === null || !onUpdateItem(item.id, { priceMinor: Math.round(value * 100) })) details.cancel()
                  }}>
                  <NumberInputGroup className="w-full">
                    <NumberInputControl aria-label={`Цена за штуку: ${description}`} inputMode="decimal" autoComplete="off"
                      className="field-input bill-item-price" />
                  </NumberInputGroup>
                </NumberInput>
                <span className="text-muted" aria-hidden="true">×</span>
                <NumberInput className="min-w-0" format={quantityFormat} value={item.quantity} min={1} max={999} step={1} smallStep={1}
                  disabled={disabled} onValueChange={(value, details) => {
                    if (value === null || !Number.isInteger(value) || !onUpdateItem(item.id, { quantity: value })) details.cancel()
                  }}>
                  <NumberInputGroup className="bill-quantity">
                    <NumberInputDecrement className="bill-step" aria-label={`Убавить: ${description}`}><Minus size={14} aria-hidden="true" /></NumberInputDecrement>
                    <NumberInputControl className="bill-quantity-input" aria-label={`Количество: ${description}`} inputMode="numeric" autoComplete="off" />
                    <NumberInputIncrement className="bill-step" aria-label={`Прибавить: ${description}`}><Plus size={14} aria-hidden="true" /></NumberInputIncrement>
                  </NumberInputGroup>
                </NumberInput>
                <span className="text-muted" aria-hidden="true">=</span>
                <strong className="min-w-0 text-right text-sm wrap-anywhere tabular-nums">{money(item.priceMinor * item.quantity, currency, true)}</strong>
              </div>
              {canMove && <BillDragSurface value={item.id} className="bill-drag-surface" aria-hidden="true" />}
            </BillDragItem>
          )
        })}
      </ul> : <p className="text-sm text-muted">Пока без позиций</p>}
    </BillDragList>
  )
}
