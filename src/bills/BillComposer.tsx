import { Button } from '@ui-sdk/react/button'
import { Checkbox, CheckboxGroup } from '@ui-sdk/react/checkbox'
import { Dialog, DialogContent, DialogTrigger } from '@ui-sdk/react/dialog'
import { Input } from '@ui-sdk/react/input'
import { Plus, UserPlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { DialogHeader } from '../shared/ui/DialogHeader'
import type { BillPerson } from './bill'
import type { BillItemForm } from './model'

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
    <div className="bill-composer">
      <div className="bill-composer-content">
        <div className="flex min-w-0 items-center gap-2">
          <CheckboxGroup value={targets} onValueChange={onTargetsChange} aria-label="Кому добавить позицию"
            className="bill-participants">
            {people.map((person) => (
              <Checkbox key={person.id} value={person.id} disabled={disabled} className="bill-participant">
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
            <DialogTrigger className="btn-icon rounded-xl" aria-label="Добавить участника" disabled={disabled}>
              <UserPlus size={18} aria-hidden="true" />
            </DialogTrigger>
            <DialogContent initialFocus={() => nameInput.current} className="compact-dialog">
              <DialogHeader title="Добавить участника" />
              <form autoComplete="off" className="grid min-w-0 gap-2" onSubmit={(event) => {
                event.preventDefault()
                if (onAddPerson(personName)) setPersonDialog(false)
                else setPersonError('Введи имя нового участника.')
              }}>
                <Input ref={nameInput} className="field-input text-base" aria-label="Имя участника" placeholder="Имя участника"
                  autoComplete="off" maxLength={40} required value={personName}
                  onValueChange={(value) => { setPersonName(value); setPersonError('') }} />
                {personError && <p className="error-text" role="alert">{personError}</p>}
                <Button className="btn-primary justify-self-end" type="submit">Добавить</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <form autoComplete="off" className="bill-composer-row" onSubmit={(event) => {
          event.preventDefault()
          onAddItem()
        }}>
          <Input className="field-input text-base" aria-label="Новая позиция" placeholder="Позиция" autoComplete="off"
            enterKeyHint="next" maxLength={80} value={fields.name} disabled={disabled}
            onValueChange={(value) => onItemFieldChange('name', value)} />
          <Input className="field-input text-base" aria-label="Цена новой позиции, ₽" placeholder="Цена, ₽" autoComplete="off"
            enterKeyHint="done" inputMode="decimal" maxLength={13} required value={fields.price} disabled={disabled}
            onValueChange={(value) => onItemFieldChange('price', value)} />
          <Button className="bill-add-button" type="submit" aria-label="Добавить позицию" disabled={disabled || !targets.length}>
            <Plus size={20} aria-hidden="true" />
          </Button>
        </form>
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
    </div>
  )
}
