import { CheckboxGroup } from '@ui-sdk/react/checkbox'
import { Dialog, DialogClose, DialogDescription, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog'
import { UserRoundPlus } from 'lucide-react'
import { useState } from 'react'
import { DialogBody, DialogSurface } from '../shared/ui/DialogSurface'
import { Button, buttonVariants } from '../shared/ui/Button'
import { Checkbox, CheckboxLabel } from '../shared/ui/Checkbox'
import { SheetGrip } from '../shared/ui/SheetGrip'
import type { BillPerson } from './bill'
import { SectionHeading, ErrorText } from '../shared/ui/Text'

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
      <DialogTrigger className={buttonVariants({ variant: 'secondary', size: 'icon-sm' })}
        aria-label={`Участники позиции: ${name}`} disabled={disabled}>
        <UserRoundPlus aria-hidden="true" />
      </DialogTrigger>
      <DialogSurface className="grid-rows-[auto_minmax(0,1fr)_auto]" initialFocus="content">
        <div className="grid min-w-0 gap-2">
          <SheetGrip />
          <div className="grid min-w-0 gap-1.5">
            <DialogTitle render={<SectionHeading />}>Участники позиции</DialogTitle>
            <DialogDescription className="m-0 flex min-w-0 items-baseline justify-between gap-3 text-sm leading-snug">
              <span className="min-w-0 wrap-anywhere">{name}</span>
              <span className="shrink-0 whitespace-nowrap"><strong className="text-ink tabular-nums">{price}</strong> / шт.</span>
            </DialogDescription>
          </div>
        </div>
        <DialogBody>
          <CheckboxGroup className="grid min-w-0 gap-1" aria-label="Кому назначена позиция" value={selected} disabled={disabled}
            onValueChange={(ids) => {
              setSelected(ids)
              setFailed(false)
            }}>
            {[...assignedPeople, ...availablePeople].map(({ id, name }) => (
              <CheckboxLabel key={id} className="justify-between gap-3 rounded-xl px-2.5 py-1.5 hover:bg-subtle has-data-checked:bg-selected has-data-checked:text-primary">
                <span className="min-w-0 wrap-anywhere">{name}</span>
                <Checkbox value={id} />
              </CheckboxLabel>
            ))}
          </CheckboxGroup>
        </DialogBody>
        <div className="grid min-w-0 gap-2">
          {failed && <ErrorText role="alert">Не удалось изменить участников позиции.</ErrorText>}
          <div className="grid grid-cols-2 gap-2">
            <DialogClose className={buttonVariants({ variant: 'secondary' })}>Отмена</DialogClose>
            <Button disabled={disabled || !changed || !selected.length} onClick={() => {
              if (onApply(selected)) setOpen(false)
              else setFailed(true)
            }}>Применить</Button>
          </div>
        </div>
      </DialogSurface>
    </Dialog>
  )
}
