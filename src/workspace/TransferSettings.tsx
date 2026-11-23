import { useState } from 'react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Button } from '../shared/ui/Button'

export default function TransferSettings({ maskedPhone, onChange }: {
  maskedPhone?: string
  onChange: (phone: string | null) => Promise<void>
}) {
  const [phone, setPhone] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function save(value: string | null) {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await onChange(value)
      setPhone('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить номер.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="grid gap-1.5" onSubmit={(event) => {
      event.preventDefault()
      if (phone.trim()) void save(phone)
    }} autoComplete="off">
      <Field className="grid min-w-0 gap-2" invalid={error ? true : undefined} disabled={pending}>
        <FieldLabel className="sr-only">{maskedPhone ? 'Новый номер для СБП' : 'Твой номер для СБП'}</FieldLabel>
        <FieldDescription className="text-sm leading-snug text-muted">
          {maskedPhone ? `Текущий номер: ${maskedPhone}` : 'По этому номеру распознаются переводы между своими счетами.'}
        </FieldDescription>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input name="phone" type="tel" inputMode="tel" placeholder="+7 999 123-45-67" autoComplete="off" data-agent-secret
            className="field-input min-w-0 text-base" required value={phone} onValueChange={(value) => {
              setPhone(value)
              setError('')
            }} />
          <Button type="submit" disabled={pending || !phone.trim()}>
            {pending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
        {error && <FieldError match className="error-text" role="alert">{error}</FieldError>}
      </Field>
      {maskedPhone && (
        <Button variant="text" className="justify-self-start" disabled={pending} onClick={() => save(null)}>
          Убрать номер
        </Button>
      )}
    </form>
  )
}
