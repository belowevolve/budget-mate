import { Button } from '@ui-sdk/react/button'
import { Checkbox, CheckboxGroup, CheckboxIndicator } from '@ui-sdk/react/checkbox'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog'
import { Check, UserRoundPlus } from 'lucide-react'
import { useState } from 'react'
import { SheetGrip } from '../components/SheetGrip'
import type { BillPerson } from './bill'

export default function BillSharePicker({ name, price, personId, people, assigned, disabled, onApply }: {
  name: string
  price: string
  personId: string
  people: BillPerson[]
  assigned?: ReadonlySet<string>
  disabled: boolean
  onApply: (personIds: string[]) => boolean
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [failed, setFailed] = useState(false)
  const assignedIds = new Set(assigned ?? [personId])
  const assignedPeople = people.filter(({ id }) => assignedIds.has(id))
  const availablePeople = people.filter(({ id }) => !assignedIds.has(id))
  const changed = people.some(({ id }) => selected.includes(id) !== assignedIds.has(id))

  return (
    <Dialog presentation="auto" open={open} onOpenChange={(next) => {
      if (next) {
        setSelected(assignedPeople.map(({ id }) => id))
        setFailed(false)
      }
      setOpen(next)
    }}>
      <DialogTrigger className="btn-icon size-9" aria-label={`Участники позиции: ${name}`} disabled={disabled}>
        <UserRoundPlus size={16} aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="compact-dialog grid-rows-[auto_minmax(0,1fr)_auto]" initialFocus="content">
        <div className="grid min-w-0 gap-2">
          <SheetGrip />
          <div className="grid min-w-0 gap-1.5">
            <DialogTitle className="section-heading">Участники позиции</DialogTitle>
            <DialogDescription className="m-0 flex min-w-0 items-baseline justify-between gap-3 text-sm leading-snug">
              <span className="min-w-0 wrap-anywhere">{name}</span>
              <span className="shrink-0 whitespace-nowrap"><strong className="text-ink tabular-nums">{price}</strong> / шт.</span>
            </DialogDescription>
          </div>
        </div>
        <div data-slot="scroll" className="dialog-body">
          <CheckboxGroup className="grid min-w-0 gap-1" aria-label="Кому назначена позиция" value={selected} disabled={disabled}
            onValueChange={(ids) => {
              setSelected(ids)
              setFailed(false)
            }}>
            {[...assignedPeople, ...availablePeople].map(({ id, name }) => (
              <label key={id} className="bill-share-option">
                <span className="min-w-0 wrap-anywhere">{name}</span>
                <Checkbox value={id} className="checkbox-control">
                  <CheckboxIndicator><Check size={13} aria-hidden="true" /></CheckboxIndicator>
                </Checkbox>
              </label>
            ))}
          </CheckboxGroup>
        </div>
        <div className="grid min-w-0 gap-2">
          {failed && <p className="error-text" role="alert">Не удалось изменить участников позиции.</p>}
          <div className="grid grid-cols-2 gap-2">
            <DialogClose className="btn-secondary">Отмена</DialogClose>
            <Button className="btn-primary" disabled={disabled || !changed || !selected.length} onClick={() => {
              if (onApply(selected)) setOpen(false)
              else setFailed(true)
            }}>Применить</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
