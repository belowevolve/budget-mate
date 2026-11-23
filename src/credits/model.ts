import { action, atom, onEvent, reatomField, reatomForm, withAsync, withConnectHook, wrap } from '@reatom/core'
import { localDate } from '../finance'
import type { VaultWrite } from '../vault-ui/vaultModel'
import { updateCreditAccount, updateCreditPayment, type CreditReminder } from './creditAccounts'

export const creditToday = atom(localDate(), 'credit.today').extend(withConnectHook((today) => {
  const refresh = () => today.set(localDate())
  refresh()
  onEvent(document, 'visibilitychange', refresh)
  const timer = window.setInterval(wrap(refresh), 60_000)
  return () => window.clearInterval(timer)
}))

export class CreditFormError extends Error {}

const creditCalendarTitle = 'Напоминание budget mate'

function parseAmount(value: string): number | undefined {
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(value.trim().replace(/\s+/g, ''))
  if (!match) return
  const amount = Number(match[1]) * 100 + Number(match[2]?.padEnd(2, '0') ?? 0)
  if (Number.isSafeInteger(amount) && amount > 0) return amount
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function reatomCreditReminderForm(name: string) {
  return reatomForm((name) => ({
    accountKey: reatomField('', { name: `${name}.accountKey`, validate: ({ state }) => state ? undefined : 'Выбери счёт.' }),
    dueOn: reatomField('', {
      name: `${name}.dueOn`,
      validate: ({ state }) => state && !validDate(state) ? 'Укажи дату платежа.' : undefined,
    }),
    amount: reatomField('', {
      name: `${name}.amount`,
      validate: ({ state }) => state.trim() && parseAmount(state) === undefined ? 'Укажи сумму больше нуля, с точностью до копеек.' : undefined,
    }),
  }), {
    name,
    validateBeforeSubmit: ({ dueOn, amount }) => {
      if (amount.trim() && !dueOn) throw new CreditFormError('Укажи дату для этой суммы.')
    },
    onSubmit: async ({ accountKey, dueOn, amount }, write: VaultWrite) => {
      await wrap(write((ledger) => ({ ledger: updateCreditAccount(ledger, accountKey, dueOn, parseAmount(amount)), result: undefined })))
      return { hasDate: Boolean(dueOn) }
    },
  }).extend((form) => ({
    clearDueOn: action(() => {
      form.fields.dueOn.change('')
      form.fields.amount.change('')
    }, `${name}.clearDueOn`),
  }))
}

function calendarTimestamp(date: Date) {
  return date.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z'
}

export function creditCalendarUrl(dueOn: string) {
  if (!validDate(dueOn)) return
  const start = calendarTimestamp(new Date(`${dueOn}T09:00:00`))
  const end = calendarTimestamp(new Date(`${dueOn}T09:15:00`))
  const url = new URL('https://calendar.google.com/calendar/r/eventedit')
  url.search = new URLSearchParams({
    action: 'TEMPLATE',
    text: creditCalendarTitle,
    dates: `${start}/${end}`,
  }).toString()
  return url.href
}

export function downloadCreditReminder(reminder: CreditReminder) {
  const timestamp = calendarTimestamp(new Date())
  const date = reminder.dueOn.replaceAll('-', '')
  const content = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//budget mate//Local reminders//RU',
    'BEGIN:VEVENT', `UID:${reminder.id}@budgetmate.local`, `DTSTAMP:${timestamp}`,
    `DTSTART:${date}T090000`, 'DURATION:PT15M',
    `SUMMARY:${creditCalendarTitle}`, 'CLASS:PRIVATE',
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY',
    'DESCRIPTION:Проверь напоминание в budget mate', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'budget-mate-reminder.ics'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function reatomCreditPayment() {
  return action(async (write: VaultWrite, accountKey: string, reminderId: string, paid: boolean) => {
    await wrap(write((ledger) => {
      const updated = updateCreditPayment(ledger, accountKey, reminderId, paid)
      if (updated === ledger) throw new Error('Платёж уже изменился.')
      return { ledger: updated, result: undefined }
    }))
  }, 'credit.setPaid').extend(withAsync())
}
