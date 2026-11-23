import { useMemo, useState, type ReactNode } from 'react'
import { useAction, useAtom } from '@reatom/react'
import { Bell, CalendarPlus, Check, CreditCard } from 'lucide-react'
import {
  calendarDayOffset, creditAccountShortLabel, dueCreditAccounts, getCreditAccounts, plannedAmount,
  type CreditAccount, type CreditReminder,
} from '../credits/creditAccounts'
import CreditEditor from '../credits/CreditEditor'
import { creditCalendarUrl, creditToday, reatomCreditPayment } from '../credits/model'
import { banks, money, type Ledger } from '../finance'
import { cn } from '../shared/cn'
import { formatDate } from '../shared/format'
import { Button } from '../shared/ui/Button'
import type { Notify } from '../shared/ui/feedback'
import { Panel } from '../shared/ui/Panel'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import Notice from '../shared/ui/Notice'
import './CreditCards.css'

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
      <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5',
        reminder && '[&>:is(button,a)]:flex-none [&>:is(button,a)]:bg-paper [&>:is(button,a)]:hover:bg-selected')}>
        {reminder && reminder.paid?.source !== 'bank' && (
          <Button variant="secondary" size="compact" disabled={!ready} onClick={async () => {
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
          <Button variant="secondary" size="icon-lg" aria-label="Добавить в Google Календарь" title="Добавить в Google Календарь"
            render={<a href={calendarUrl} target="_blank" rel="noreferrer" />}>
            <CalendarPlus aria-hidden="true" />
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
    <Panel padded className="credit-card">
      <div className="grid min-w-0 content-start gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="dialog-icon"><CreditCard size={17} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="section-heading">{bank}</h2>
            {label && label !== bank && <p className="text-xs text-muted wrap-anywhere">{label}</p>}
          </div>
        </div>
        {(snapshot?.gracePeriodEnd || snapshot?.gracePaymentAmountMinor !== undefined ||
          snapshot?.minimumPaymentDate || snapshot?.minimumPaymentAmountMinor !== undefined || debtMinor !== undefined) && (
          <dl className="credit-facts">
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
      </div>
      <CreditPayment account={account} reminder={reminder} today={today} write={write} notify={notify} editor={editor} />
    </Panel>
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
        <Panel className="empty-card">
          <span className="empty-icon"><CreditCard size={19} aria-hidden="true" /></span>
          <h2 className="section-heading">Данных по кредиткам нет</h2>
          <Button onClick={onImport}>Импортировать PDF</Button>
        </Panel>
      )}
      {tracked.length > 0 && (
        <div className="credit-cards">
          {tracked.map((account) => <CreditCardDetails key={account.accountKey} account={account} today={today} write={write} notify={notify} />)}
        </div>
      )}
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
