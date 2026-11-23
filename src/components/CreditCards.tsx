import { useMemo, useState, type ReactNode } from 'react'
import { useAction, useAtom } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Bell, CalendarPlus, Check, CreditCard } from 'lucide-react'
import {
  calendarDayOffset, creditAccountShortLabel, dueCreditAccounts, getCreditAccounts, plannedAmount,
  type CreditAccount, type CreditReminder,
} from '../credits/creditAccounts'
import CreditEditor from '../credits/CreditEditor'
import { creditCalendarUrl, creditToday, reatomCreditPayment } from '../credits/model'
import { banks, formatDate, money, type Ledger } from '../finance'
import type { Notify } from '../notifications/presentation'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import Notice from './Notice'

function CreditPayment({ account, reminder, today, write, notify, editor }: {
  account: CreditAccount; reminder?: CreditReminder; today: string; write: VaultWrite; notify: Notify; editor: ReactNode
}) {
  const [mutation] = useState(reatomCreditPayment)
  const [ready] = useAtom(mutation.ready)
  const setPaid = useAction(mutation)
  const amount = reminder && plannedAmount(account, reminder)
  const due = reminder && !reminder.paid && reminder.dueOn <= calendarDayOffset(today, 1)
  const title = reminder?.paid ? 'Платёж закрыт' : reminder && reminder.dueOn < today ? 'Срок оплаты прошёл' : 'Платёж до'
  const calendarUrl = reminder && !reminder.paid && reminder.dueOn > today ? creditCalendarUrl(reminder.dueOn) : undefined

  return (
    <div className={reminder ? `grid min-w-0 gap-1.5 rounded-xl p-2.5 ${due ? 'bg-warning-soft text-warning' : 'bg-subtle text-ink'}` : 'min-w-0'}>
      {reminder && <div className="flex min-w-0 items-start gap-2">
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
      </div>}
      {reminder?.paid?.source === 'bank' && <p className="text-xs">Подтверждено выпиской</p>}
      {reminder && !reminder.paid && !amount && <p className="text-xs">Сумма пока неизвестна</p>}
      <div className="flex min-w-0 gap-1.5">
        {reminder && reminder.paid?.source !== 'bank' && (
          <Button className="btn-secondary min-w-0 flex-1 px-2 text-xs whitespace-normal" disabled={!ready} onClick={async () => {
            try {
              await setPaid(write, account.accountKey, reminder.id, !reminder.paid)
              notify(reminder.paid ? 'Напоминание снова активно' : 'Платёж отмечен как оплаченный')
            } catch (error) {
              notify(messageFor(error, 'Не удалось изменить статус платежа.'), 'error')
            }
          }}>
            {reminder.paid ? 'Снова напоминать' : 'Отметить оплату'}
          </Button>
        )}
        {editor}
        {calendarUrl && (
          <Button className="btn-icon min-h-11 self-stretch" aria-label="Добавить в Google Календарь" title="Добавить в Google Календарь"
            render={<a href={calendarUrl} target="_blank" rel="noreferrer" />}>
            <CalendarPlus size={16} className="shrink-0" aria-hidden="true" />
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
  const editor = <CreditEditor account={account} today={today} write={write}
    compactTrigger={Boolean(reminder)} onSaved={(hasDate) => notify(hasDate ? 'Дата напоминания сохранена' : 'Ручное напоминание удалено')} />

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
        <p className="text-xs text-muted">{account.bank === 'ozon' && debtMinor === undefined
          ? 'В выписке нет данных о долге и сроке платежа.'
          : 'Срок платежа в выписке не указан.'}</p>
      )}
      {snapshot?.observedOn && <p className="text-xs text-muted">Выписка от {formatDate(snapshot.observedOn)}</p>}
      <CreditPayment account={account} reminder={reminder} today={today} write={write} notify={notify} editor={editor} />
    </section>
  )
}

export default function CreditCards({ ledger, write, notify, onImport }: {
  ledger: Ledger; write: VaultWrite; notify: Notify; onImport: () => void
}) {
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

  return (
    <div className="mb-3">
      <Notice tone="warning" icon={Bell} title={due.length === 1 ? 'Срок платежа' : 'Сроки платежей'}
        open={{ label: 'Кредитки', onClick: onOpen }}>
        {due.map((account) => (
          <span key={account.accountKey} className="block">{creditAccountShortLabel(account)}</span>
        ))}
      </Notice>
    </div>
  )
}
