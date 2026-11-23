import { useState, type FormEvent } from 'react'
import { action, atom, wrap } from '@reatom/core'
import { bindField, reatomComponent, reatomFactoryComponent } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import {
  CalendarDay, CalendarGrid, CalendarHeading, CalendarNext, CalendarPrevious, CalendarWeekday, CalendarWeekdays, CalendarWeeks,
  createDatePickerController, DatePicker, DatePickerContent, DatePickerInput, DatePickerTrigger,
} from '@ui-sdk/react/date-picker'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Download, Plus, X } from 'lucide-react'
import { Choice, type ChoiceOption } from '../shared/ui/Choice'
import { SheetGrip } from '../shared/ui/SheetGrip'
import { banks } from '../finance'
import { useAndroidPopupBack } from '../shared/ui/popupBack'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import { upcomingBankPayment, type CreditAccount } from './creditAccounts'
import { CreditFormError, downloadCreditReminder, reatomCreditReminderForm } from './model'

interface EditorProps {
  account?: CreditAccount
  options?: ChoiceOption[]
  today: string
  write: VaultWrite
  onSaved: (hasDate: boolean) => void
  compactTrigger?: boolean
}

function ReminderDateField({ value, disabled, onChange }: {
  value: string
  disabled: boolean
  onChange: (date: string) => void
}) {
  const [controller] = useState(createDatePickerController)
  const watchBack = useAndroidPopupBack(() => { controller.close({ reason: 'back' }) })

  return (
    <Field name="dueOn" className="grid min-w-0 gap-1">
      <FieldLabel className="text-sm font-bold">Оплатить до</FieldLabel>
      <DatePicker controller={controller} value={value || null} disabled={disabled} locale="ru-RU" presentation="auto" fixedWeeks
        className="w-full min-w-0" onValueChange={(date) => onChange(typeof date === 'string' ? date : '')} onOpenChange={watchBack}>
        <div className="relative min-w-0">
          <DatePickerInput className="field-input pe-12 text-base" placeholder="ДД.ММ.ГГГГ" inputMode="numeric" autoComplete="off" />
          <span className="absolute inset-y-0 end-1 flex items-center">
            <DatePickerTrigger aria-label="Выбрать дату платежа" className="btn-icon rounded-lg bg-transparent focus-visible:outline-offset-[-2px] data-open:bg-subtle">
              <CalendarDays size={18} aria-hidden="true" />
            </DatePickerTrigger>
          </span>
        </div>
        <DatePickerContent aria-label="Календарь платежа" align="end" sideOffset={6} collisionPadding={10} className="choice-popover">
          <SheetGrip />
          <div className="mx-auto grid min-h-0 w-full max-w-84 grid-rows-[auto_minmax(0,1fr)] gap-1 pb-1">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <CalendarPrevious aria-label="Предыдущий месяц" className="btn-icon">
                <ChevronLeft size={18} aria-hidden="true" />
              </CalendarPrevious>
              <CalendarHeading className="text-sm font-bold first-letter:uppercase" />
              <CalendarNext aria-label="Следующий месяц" className="btn-icon">
                <ChevronRight size={18} aria-hidden="true" />
              </CalendarNext>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-y-auto scroll-edges-y">
              <CalendarGrid className="w-full table-fixed">
                <CalendarWeekdays>{(index) => <CalendarWeekday index={index} />}</CalendarWeekdays>
                <CalendarWeeks>{(cell) => <CalendarDay value={cell.date} className="h-11 rounded-lg focus-visible:outline-offset-[-2px]" />}</CalendarWeeks>
              </CalendarGrid>
            </div>
          </div>
        </DatePickerContent>
      </DatePicker>
    </Field>
  )
}

type CreditFormProps = Pick<EditorProps, 'account' | 'options' | 'write' | 'onSaved'> & {
  form: ReturnType<typeof reatomCreditReminderForm>
}

const CreditForm = reatomComponent<CreditFormProps>(({ account, options, form, write, onSaved }) => {
  const { fields, submit } = form
  const dueOn = fields.dueOn()
  const amount = bindField(fields.amount)
  const ready = submit.ready()
  const error = submit.error()
  const validationMessage = form.validation().errors[0]?.message ?? (error instanceof CreditFormError ? error.message : undefined)
  const reminder = account?.reminder

  const save = wrap(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!submit.ready()) return
    const saved = await wrap(submit(write).catch(() => undefined))
    if (saved) onSaved(saved.hasDate)
  })

  return (
    <form className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-2.5" onSubmit={save}>
      <div className="dialog-body grid content-start gap-2.5" data-slot="scroll">
        {options && <Choice label="Кредитный счёт" value={fields.accountKey()} options={options} onChange={wrap(fields.accountKey.change)}
          className="w-full min-w-0" />}
        {account && <p className="truncate text-xs text-muted" title={account.accountLabel}>{account.accountLabel || banks[account.bank]}</p>}
        <ReminderDateField value={dueOn} disabled={!ready} onChange={wrap(fields.dueOn.change)} />
        <Field name="amount" className="grid min-w-0 gap-1">
          <FieldLabel className="text-sm font-bold">Сумма платежа</FieldLabel>
          <Input className="field-input min-w-0 text-base" inputMode="decimal" placeholder="По выписке, если есть" disabled={!ready}
            value={amount.value} onValueChange={amount.onChange} onBlur={amount.onBlur} onFocus={amount.onFocus} />
        </Field>
        {dueOn && (
          <Button type="button" className="btn-text justify-self-start px-1" disabled={!ready} onClick={wrap(form.clearDueOn)}>
            Убрать дату напоминания
          </Button>
        )}
        {reminder && !reminder.paid && reminder.dueOn === dueOn && (
          <Button className="btn-secondary justify-self-start" onClick={() => downloadCreditReminder(reminder)}>
            <Download size={16} aria-hidden="true" />
            Скачать событие (.ics)
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
}, 'CreditForm')

export default reatomFactoryComponent<EditorProps>((_, { name }) => {
  const open = atom(false, `${name}.open`)
  const form = reatomCreditReminderForm(`${name}.form`)
  const openEditor = action(({ account, options, today }: EditorProps) => {
    const reminder = account?.reminder
    form.reset({
      accountKey: account?.accountKey ?? options?.[0]?.value ?? '',
      dueOn: reminder?.dueOn ?? (account && upcomingBankPayment(account, today)) ?? '',
      amount: reminder?.amountMinor === undefined ? '' : String(reminder.amountMinor / 100).replace('.', ','),
    })
    open.set(true)
  }, `${name}.openEditor`)

  return function CreditEditor(props) {
    const { account, options, write, compactTrigger } = props
    const title = account ? 'Напоминание о платеже' : 'Добавить кредитный счёт'
    return (
      <Dialog open={open()} presentation="auto"
        onOpenChange={wrap((nextOpen) => {
          if (nextOpen) openEditor(props)
          else open.set(false)
        })}>
        <DialogTrigger className={`btn-secondary min-w-0 whitespace-normal ${compactTrigger ? 'flex-1 px-2 text-xs' : 'justify-self-start'}`}
          aria-label={compactTrigger ? 'Изменить напоминание' : undefined}>
          {account ? <Bell size={16} className="shrink-0" aria-hidden="true" /> : <Plus size={17} className="shrink-0" aria-hidden="true" />}
          {account ? compactTrigger ? 'Изменить' : account.reminder ? 'Изменить напоминание' : 'Напоминание' : 'Добавить счёт'}
        </DialogTrigger>
        <DialogContent initialFocus="content" className="compact-dialog grid-rows-[auto_minmax(0,1fr)]">
          <div className="dialog-header">
            <SheetGrip />
            <DialogTitle className="min-w-0 text-lg leading-tight wrap-anywhere">{title}</DialogTitle>
            <DialogClose className="dialog-close" aria-label="Закрыть"><X size={17} aria-hidden="true" /></DialogClose>
          </div>
          <CreditForm account={account} options={options} write={write} form={form}
            onSaved={(hasDate) => { props.onSaved(hasDate); open.set(false) }} />
        </DialogContent>
      </Dialog>
    )
  }
}, 'CreditEditor')
