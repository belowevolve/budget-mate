import { useMemo, useState } from 'react'
import { useAction, useAtom } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Bell, CalendarPlus, Check, CreditCard } from 'lucide-react'
import {
  calendarDayOffset, dueCreditAccounts, getCreditAccounts, plannedAmount,
  type CreditAccount, type CreditReminder,
} from '../credits/creditAccounts'
import CreditEditor from '../credits/CreditEditor'
import { creditToday, downloadCreditReminder, reatomCreditPayment } from '../credits/model'
import { banks, formatDate, money, type Ledger } from '../finance'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'

type Notify = (message: string, kind?: 'success' | 'info' | 'error') => void

function CreditPayment({ account, reminder, today, write, notify }: {
  account: CreditAccount; reminder: CreditReminder; today: string; write: VaultWrite; notify: Notify
}) {
  const [mutation] = useState(reatomCreditPayment)
  const [ready] = useAtom(mutation.ready)
  const setPaid = useAction(mutation)
  const amount = plannedAmount(account, reminder)
  const due = !reminder.paid && reminder.dueOn <= calendarDayOffset(today, 1)
  const title = reminder.paid ? 'Платёж закрыт' : reminder.dueOn < today ? 'Срок оплаты прошёл' : 'Платёж до'

  return (
    <div className={`grid min-w-0 gap-1.5 rounded-xl p-2.5 ${due ? 'bg-warning-soft text-warning' : 'bg-subtle text-ink'}`}>
      <div className="flex min-w-0 items-start gap-2">
        {reminder.paid ? <Check size={17} className="mt-0.5 shrink-0 text-income" aria-hidden="true" /> : <Bell size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs">{title}</p>
          <strong className="block text-sm wrap-anywhere">{formatDate(reminder.paid?.on ?? reminder.dueOn)}</strong>
        </div>
        {!reminder.paid && amount && (
          <div className="min-w-0 max-w-[45%] text-right">
            <strong className="block text-sm wrap-anywhere tabular-nums">{money(amount.minor, account.currency, true)}</strong>
            {amount.estimate && <span className="text-xs">Оценка</span>}
          </div>
        )}
      </div>
      {reminder.paid?.source === 'bank' && <p className="text-xs">Подтверждено выпиской</p>}
      {!reminder.paid && !amount && <p className="text-xs">Сумма пока неизвестна</p>}
      <div className="flex min-w-0 flex-wrap gap-1">
        {reminder.paid?.source !== 'bank' && (
          <Button className="btn-secondary min-w-0 px-2 whitespace-normal" disabled={!ready} onClick={async () => {
            try {
              await setPaid(write, account.accountKey, reminder.id, !reminder.paid)
            } catch (error) {
              notify(messageFor(error, 'Не удалось изменить статус платежа.'), 'error')
            }
          }}>
            {reminder.paid ? 'Снова напоминать' : 'Отметить оплату'}
          </Button>
        )}
        {!reminder.paid && reminder.dueOn > today && (
          <Button className="btn-secondary min-w-0 px-2 whitespace-normal" onClick={() => {
            downloadCreditReminder(reminder)
            notify('Импортируй файл в календарь для напоминания за день.', 'info')
          }}>
            <CalendarPlus size={16} className="shrink-0" aria-hidden="true" /> В календарь
          </Button>
        )}
      </div>
    </div>
  )
}

function CreditCardDetails({ account, today, write, notify }: {
  account: CreditAccount; today: string; write: VaultWrite; notify: Notify
}) {
  const { snapshot, reminder, debtMinor, currency } = account
  const bank = banks[account.bank]
  const label = account.accountLabel.startsWith(`${bank} · `) ? account.accountLabel.slice(bank.length + 3) : account.accountLabel

  return (
    <section className="surface-panel card-padding grid max-w-full gap-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="dialog-icon"><CreditCard size={17} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="section-heading">{bank}</h2>
          {label && label !== bank && <p className="truncate text-xs text-muted" title={label}>{label}</p>}
        </div>
      </div>
      {(snapshot?.gracePeriodEnd || snapshot?.gracePaymentAmountMinor !== undefined ||
        snapshot?.minimumPaymentDate || snapshot?.minimumPaymentAmountMinor !== undefined || debtMinor !== undefined) && (
        <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,max-content)] items-baseline gap-x-2 gap-y-1.5 text-xs [&>dd]:max-w-[40vw] [&>dd]:text-right [&>dd]:font-bold [&>dd]:wrap-anywhere [&>dd]:tabular-nums [&>dt]:text-muted [&>dt]:wrap-anywhere">
          {snapshot?.gracePeriodEnd && <><dt>Грейс до</dt><dd>{formatDate(snapshot.gracePeriodEnd)}</dd></>}
          {snapshot?.gracePaymentAmountMinor !== undefined && <><dt>Платёж для грейса</dt><dd>{money(snapshot.gracePaymentAmountMinor, currency, true)}</dd></>}
          {snapshot?.minimumPaymentAmountMinor !== undefined && <><dt>Минимальный платёж</dt><dd>{money(snapshot.minimumPaymentAmountMinor, currency, true)}</dd></>}
          {snapshot?.minimumPaymentDate && <><dt>Срок мин. платежа</dt><dd>{formatDate(snapshot.minimumPaymentDate)}</dd></>}
          {debtMinor !== undefined && <>
            <dt>
              {snapshot?.totalOutstandingAmountMinor !== undefined ? 'Долг по выписке' : 'Расходы минус пополнения'}
              {snapshot?.totalOutstandingAsOf && snapshot.totalOutstandingAsOf !== snapshot.observedOn &&
                <span className="block">{formatDate(snapshot.totalOutstandingAsOf)}</span>}
            </dt>
            <dd>{snapshot?.totalOutstandingAmountMinor !== undefined ? '' : '≈ '}{money(debtMinor, currency, true)}</dd>
          </>}
        </dl>
      )}
      {!snapshot?.gracePeriodEnd && !snapshot?.minimumPaymentDate && !reminder && (
        <p className="text-xs text-muted">Срок платежа в выписке не указан.</p>
      )}
      {snapshot?.observedOn && <p className="text-xs text-muted">Выписка от {formatDate(snapshot.observedOn)}</p>}
      {reminder && <CreditPayment account={account} reminder={reminder} today={today} write={write} notify={notify} />}
      <CreditEditor account={account} today={today} write={write} onSaved={() => notify('Настройки кредитки сохранены')} />
    </section>
  )
}

export default function CreditCards({ ledger, write, notify, onImport }: { ledger: Ledger; write: VaultWrite; notify: Notify; onImport: () => void }) {
  const [today] = useAtom(creditToday)
  const { tracked, available } = useMemo(() => getCreditAccounts(ledger), [ledger])
  return (
    <div className="grid min-w-0 gap-3">
      {available.length > 0 && (
        <div className="flex min-w-0 items-center justify-between gap-2">
          {!tracked.length && <p className="min-w-0 flex-1 text-sm text-muted">Выбери счёт из импортированных выписок.</p>}
          <CreditEditor options={available.map(({ accountKey, accountLabel }) => ({ value: accountKey, label: accountLabel }))}
            today={today} write={write} onSaved={() => notify('Кредитка добавлена')} />
        </div>
      )}
      {!tracked.length && !available.length && (
        <section className="surface-panel empty-card">
          <span className="empty-icon"><CreditCard size={19} aria-hidden="true" /></span>
          <h2 className="section-heading">Данных по кредиткам нет</h2>
          <Button className="btn-primary" onClick={onImport}>Импортировать PDF</Button>
        </section>
      )}
      <div className="grid min-w-0 items-start gap-3 min-[570px]:grid-cols-2">
        {tracked.map((account) => <CreditCardDetails key={account.accountKey} account={account} today={today} write={write} notify={notify} />)}
      </div>
    </div>
  )
}

export function CreditOverviewReminders({ ledger, onOpen }: { ledger: Ledger; onOpen: () => void }) {
  const [today] = useAtom(creditToday)
  const { tracked } = useMemo(() => getCreditAccounts(ledger), [ledger])
  const due = dueCreditAccounts(tracked, today)
  if (!due.length) return null
  const names = [...new Set(due.map((account) => banks[account.bank]))].join(', ')

  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-x-2 rounded-xl bg-warning-soft px-2.5 py-1.5 text-sm text-warning">
      <span className="min-w-0 flex-1 basis-40 wrap-anywhere">Срок оплаты кредитки · {names}</span>
      <Button className="btn-text shrink-0 px-2 text-warning" onClick={onOpen}>К платежам</Button>
    </div>
  )
}
