import { useState, type FormEvent } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { ChevronRight, Phone, X } from 'lucide-react'
import { SheetGrip } from '../components/SheetGrip'

export default function TransferSettings({ maskedPhone, onChange, open, onOpenChange, showTrigger = true }: {
  maskedPhone?: string
  onChange: (phone: string | null) => Promise<void>
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const [result, setResult] = useState({ pending: false, error: '' })

  function changeOpen(value: boolean) {
    if (open === undefined) setLocalOpen(value)
    onOpenChange?.(value)
  }

  async function save(phone: string | null) {
    if (result.pending) return
    setResult({ pending: true, error: '' })
    try {
      await onChange(phone)
      setResult({ pending: false, error: '' })
      changeOpen(false)
    } catch (error) {
      setResult({ pending: false, error: error instanceof Error ? error.message : 'Не удалось сохранить номер.' })
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const phone = String(new FormData(event.currentTarget).get('phone') ?? '')
    void save(phone)
  }

  return (
    <Dialog presentation="auto" open={open ?? localOpen} onOpenChange={(next, details) => {
      if (result.pending) details.cancel()
      else {
        setResult({ pending: false, error: '' })
        changeOpen(next)
      }
    }}>
      {showTrigger && !maskedPhone && (
        <DialogTrigger className="grid h-auto min-h-11 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-field-line bg-subtle px-2.5 py-1.5 text-left text-sm leading-tight font-bold text-ink hover:bg-selected">
          <Phone size={16} className="text-primary" aria-hidden="true" />
          <span className="min-w-0 wrap-anywhere">Добавить свой номер для СБП</span>
          <ChevronRight size={15} className="text-primary" aria-hidden="true" />
        </DialogTrigger>
      )}
      <DialogContent initialFocus="content" finalFocus={showTrigger ? undefined : '#workspace-actions'}
        className="compact-dialog grid-rows-[auto_minmax(0,1fr)]">
        <div className="dialog-header">
          <SheetGrip />
          <div className="min-w-0">
            <DialogTitle className="text-lg leading-tight">Номер для СБП</DialogTitle>
            <DialogDescription className="mt-0.5 truncate text-xs text-muted">{maskedPhone ?? 'Для распознавания своих переводов'}</DialogDescription>
          </div>
          <DialogClose className="btn-icon" aria-label="Закрыть" disabled={result.pending}><X size={17} aria-hidden="true" /></DialogClose>
        </div>
        <form onSubmit={submit} className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-2.5">
          <div data-slot="scroll" className="dialog-body grid content-start gap-1.5 pt-0.5">
            <Field className="grid min-w-0 gap-1">
              <FieldLabel className="text-sm font-bold">{maskedPhone ? 'Новый номер' : 'Твой номер'}</FieldLabel>
              <Input name="phone" type="tel" inputMode="tel" placeholder="+7 999 123-45-67" autoComplete="off" data-agent-secret
                className="field-input min-w-0 text-base" required disabled={result.pending} />
            </Field>
            {result.error && <p className="error-text" role="alert">{result.error}</p>}
          </div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {maskedPhone && <Button className="btn-text min-w-0 px-2 whitespace-normal" disabled={result.pending} onClick={() => save(null)}>Убрать номер</Button>}
            <Button type="submit" className="btn-primary min-w-0 flex-1 px-2 whitespace-normal" disabled={result.pending}>Сохранить</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
