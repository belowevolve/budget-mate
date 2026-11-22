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

export function reatomCreditReminderForm(initial: { accountKey: string; dueOn?: string; amountMinor?: number }, write: VaultWrite) {
  const form = reatomForm({
    accountKey: reatomField(initial.accountKey, { validate: ({ state }) => state ? undefined : 'Выбери счёт.' }),
    dueOn: reatomField(initial.dueOn ?? '', {
      validate: ({ state }) => state && !validDate(state) ? 'Укажи дату платежа.' : undefined,
    }),
    amount: reatomField(initial.amountMinor === undefined ? '' : String(initial.amountMinor / 100).replace('.', ','), {
      validate: ({ state }) => state.trim() && parseAmount(state) === undefined ? 'Укажи сумму больше нуля, с точностью до копеек.' : undefined,
    }),
  }, {
    name: 'credit.reminderForm',
    validateBeforeSubmit: ({ dueOn, amount }) => {
      if (amount.trim() && !dueOn) throw new CreditFormError('Укажи дату для этой суммы.')
    },
    onSubmit: async ({ accountKey, dueOn, amount }) => {
      await wrap(write((ledger) => ({ ledger: updateCreditAccount(ledger, accountKey, dueOn, parseAmount(amount)), result: undefined })))
    },
  })
  return form
}

export function downloadCreditReminder(reminder: CreditReminder) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z'
  const date = reminder.dueOn.replaceAll('-', '')
  const content = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//budgetmate//Local reminders//RU',
    'BEGIN:VEVENT', `UID:${reminder.id}@budgetmate.local`, `DTSTAMP:${timestamp}`,
    `DTSTART:${date}T090000`, 'DURATION:PT15M',
    'SUMMARY:Напоминание budgetmate', 'CLASS:PRIVATE',
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY',
    'DESCRIPTION:Проверь напоминание в budgetmate', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'budgetmate-reminder.ics'
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
