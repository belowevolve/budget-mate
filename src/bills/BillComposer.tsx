import { Checkbox, CheckboxGroup } from '@ui-sdk/react/checkbox'
import { Dialog, DialogTrigger } from '@ui-sdk/react/dialog'
import { Plus, UserPlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { DialogSurface } from '../shared/ui/DialogSurface'
import { Button, buttonVariants } from '../shared/ui/Button'
import { DialogHeader } from '../shared/ui/DialogHeader'
import type { BillPerson } from './bill'
import type { BillItemForm } from './model'
import { FieldInput } from '../shared/ui/FieldInput'
import { ErrorText } from '../shared/ui/Text'

export default function BillComposer({ people, targets, fields, disabled, error, onTargetsChange, onItemFieldChange, onAddItem, onAddPerson }: {
  people: BillPerson[]; targets: string[]; fields: BillItemForm; disabled: boolean; error: string
  onTargetsChange: (ids: string[]) => void; onItemFieldChange: (name: keyof BillItemForm, value: string) => void
  onAddItem: () => boolean; onAddPerson: (name: string) => boolean
}) {
  const nameInput = useRef<HTMLInputElement>(null)
  const [personDialog, setPersonDialog] = useState(false)
  const [personName, setPersonName] = useState('')
  const [personError, setPersonError] = useState('')

  return (
    <div className="border-t border-line bg-paper">
      <div className="mx-auto grid w-full max-w-lg gap-1.5 px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <CheckboxGroup value={targets} onValueChange={onTargetsChange} aria-label="Кому добавить позицию"
            className="-ms-3 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain scroll-edges-x scroll-ps-3 scroll-pe-2 py-1 ps-3 pe-2 sm:ms-0 sm:scroll-ps-2 sm:ps-2">
            {people.map((person) => (
              <Checkbox key={person.id} value={person.id} disabled={disabled}
                className="inline-flex h-auto min-h-10 w-auto max-w-40 shrink-0 items-center rounded-xl border border-field-line bg-paper px-2.5 text-sm font-bold text-ink shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary data-checked:border-primary data-checked:bg-selected data-checked:text-primary">
                <span className="truncate">{person.name}</span>
              </Checkbox>
            ))}
          </CheckboxGroup>
          <Dialog presentation="auto" open={personDialog} onOpenChange={(open) => {
            if (open) {
              setPersonName('')
              setPersonError('')
            }
            setPersonDialog(open)
          }} onOpenChangeComplete={(open) => {
            const input = nameInput.current
            // SDK moves touch-opened dialogs to the content to avoid opening the keyboard.
            if (open && input && document.activeElement === input.closest('[role="dialog"]')) input.focus({ preventScroll: true })
          }}>
            <DialogTrigger className={buttonVariants({ variant: 'secondary', size: 'icon', className: 'rounded-xl' })}
              aria-label="Добавить участника" disabled={disabled}>
              <UserPlus aria-hidden="true" />
            </DialogTrigger>
            <DialogSurface initialFocus={() => nameInput.current}>
              <DialogHeader title="Добавить участника" />
              <form autoComplete="off" className="grid min-w-0 gap-2" onSubmit={(event) => {
                event.preventDefault()
                if (onAddPerson(personName)) setPersonDialog(false)
                else setPersonError('Введи имя нового участника.')
              }}>
                <FieldInput ref={nameInput} className="text-base" aria-label="Имя участника" placeholder="Имя участника"
                  autoComplete="off" maxLength={40} required value={personName}
                  onValueChange={(value) => { setPersonName(value); setPersonError('') }} />
                {personError && <ErrorText role="alert">{personError}</ErrorText>}
                <Button className="justify-self-end" type="submit">Добавить</Button>
              </form>
            </DialogSurface>
          </Dialog>
        </div>
        <form autoComplete="off" className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(5rem,0.5fr)_auto] items-center gap-1.5" onSubmit={(event) => {
          event.preventDefault()
          onAddItem()
        }}>
          <FieldInput className="text-base" aria-label="Новая позиция" placeholder="Позиция" autoComplete="off"
            enterKeyHint="next" maxLength={80} value={fields.name} disabled={disabled}
            onValueChange={(value) => onItemFieldChange('name', value)} />
          <FieldInput className="text-base" aria-label="Цена новой позиции, ₽" placeholder="Цена, ₽" autoComplete="off"
            enterKeyHint="done" inputMode="decimal" maxLength={13} required value={fields.price} disabled={disabled}
            onValueChange={(value) => onItemFieldChange('price', value)} />
          <Button size="icon-lg" className="rounded-xl" type="submit" aria-label="Добавить позицию" disabled={disabled || !targets.length}>
            <Plus aria-hidden="true" />
          </Button>
        </form>
        {error && <ErrorText role="alert">{error}</ErrorText>}
      </div>
    </div>
  )
}
