import { useState } from 'react'
import { useAction, useAtom } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Bell, Plus, X } from 'lucide-react'
import { Choice, type ChoiceOption } from '../components/Choice'
import { SheetGrip } from '../components/SheetGrip'
import { banks } from '../finance'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import { upcomingBankPayment, type CreditAccount } from './creditAccounts'
import { CreditFormError, reatomCreditReminderForm } from './model'

interface EditorProps {
  account?: CreditAccount
  options?: ChoiceOption[]
  today: string
  write: VaultWrite
  onSaved: () => void
}

function CreditForm({ account, options, today, write, onSaved }: EditorProps) {
  const [form] = useState(() => reatomCreditReminderForm({
    accountKey: account?.accountKey ?? options?.[0]?.value ?? '',
    dueOn: account?.reminder?.dueOn ?? (account && upcomingBankPayment(account, today)),
    amountMinor: account?.reminder?.amountMinor,
  }, write))
  const [accountKey] = useAtom(form.fields.accountKey)
  const [dueOn] = useAtom(form.fields.dueOn)
  const [amount] = useAtom(form.fields.amount)
  const [validation] = useAtom(form.validation)
  const [ready] = useAtom(form.submit.ready)
  const [error] = useAtom(form.submit.error)
  const setAccountKey = useAction(form.fields.accountKey.change)
  const setDueOn = useAction(form.fields.dueOn.change)
  const setAmount = useAction(form.fields.amount.change)
  const submit = useAction(form.submit)
  const validationMessage = validation.errors[0]?.message ?? (error instanceof CreditFormError ? error.message : undefined)

  return (
    <form className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-2.5" onSubmit={async (event) => {
      event.preventDefault()
      if (!ready) return
      try {
        await submit()
        onSaved()
      } catch {
        // Reatom exposes the submit error below.
      }
    }}>
      <div className="dialog-body grid content-start gap-2.5" data-slot="scroll">
        {options && <Choice label="Кредитный счёт" value={accountKey} options={options} onChange={setAccountKey} className="w-full min-w-0" />}
        {account && <p className="truncate text-xs text-muted" title={account.accountLabel}>{account.accountLabel || banks[account.bank]}</p>}
        <Field className="grid min-w-0 gap-1">
          <FieldLabel className="text-sm font-bold">Оплатить до</FieldLabel>
          <Input className="field-input min-w-0 text-base" type="date" value={dueOn} onValueChange={setDueOn} disabled={!ready} />
        </Field>
        <Field className="grid min-w-0 gap-1">
          <FieldLabel className="text-sm font-bold">Сумма платежа</FieldLabel>
          <Input className="field-input min-w-0 text-base" inputMode="decimal" placeholder="По выписке, если есть" value={amount} onValueChange={setAmount} disabled={!ready} />
        </Field>
        {dueOn && (
          <Button type="button" className="btn-text justify-self-start px-1" disabled={!ready} onClick={() => { setDueOn(''); setAmount('') }}>
            Убрать дату напоминания
          </Button>
        )}
        {validationMessage && <p className="error-text" role="alert">{validationMessage}</p>}
        {error && !validationMessage && <p className="error-text" role="alert">{messageFor(error, 'Не удалось сохранить настройки кредитки.')}</p>}
      </div>
      <Button type="submit" disabled={!ready} className="btn-primary min-w-0 whitespace-normal">
        {ready ? account ? 'Сохранить' : 'Добавить кредитку' : 'Сохраняем…'}
      </Button>
    </form>
  )
}

export default function CreditEditor(props: EditorProps) {
  const [open, setOpen] = useState(false)
  const title = props.account ? 'Напоминание о платеже' : 'Добавить кредитный счёт'
  return (
    <Dialog open={open} onOpenChange={setOpen} presentation="auto">
      <DialogTrigger className="btn-secondary min-w-0 justify-self-start whitespace-normal">
        {props.account ? <Bell size={16} className="shrink-0" aria-hidden="true" /> : <Plus size={17} className="shrink-0" aria-hidden="true" />}
        {props.account ? props.account.reminder ? 'Изменить напоминание' : 'Напоминание' : 'Добавить счёт'}
      </DialogTrigger>
      <DialogContent initialFocus="content" className="compact-dialog grid-rows-[auto_minmax(0,1fr)]">
        <div className="dialog-header">
          <SheetGrip />
          <DialogTitle className="min-w-0 text-lg leading-tight wrap-anywhere">{title}</DialogTitle>
          <DialogClose className="btn-icon" aria-label="Закрыть"><X size={17} aria-hidden="true" /></DialogClose>
        </div>
        <CreditForm {...props} onSaved={() => { props.onSaved(); setOpen(false) }} />
      </DialogContent>
    </Dialog>
  )
}
