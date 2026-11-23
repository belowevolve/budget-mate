import { banks, isTechnicalCreditEntry, localDate, type CreditSnapshot, type Ledger } from '../finance'
import type { BankId, ParsedStatement } from '../statements'
import { isCreditRepayment } from '../statements/transfer'

type BankPaymentKind = 'grace' | 'minimum'

export interface CreditReminder {
  id: string
  dueOn: string
  amountMinor?: number
  kind?: BankPaymentKind
  configuredOn: string
  snapshotOn?: string
  paid?: { on: string; source: 'bank' | 'manual' }
}

export interface CreditAccountSettings {
  accountKey: string
  currency: string
  reminder?: CreditReminder
}

interface Account {
  accountKey: string
  accountLabel: string
  bank: BankId
  currency: string
}

export interface CreditAccount extends Account {
  snapshot?: CreditSnapshot
  reminder?: CreditReminder
  debtMinor?: number
}

export function creditAccountShortLabel(account: CreditAccount) {
  const bank = banks[account.bank]
  const lastDigits = /[•*]{2,}\s*(\d{4})$/.exec(account.accountLabel)?.[1]
  return lastDigits ? `${bank} · •••• ${lastDigits}` : bank
}

export function getCreditAccounts(ledger: Ledger) {
  const snapshots = new Map(ledger.credits.map((credit) => [credit.accountKey, credit]))
  const settings = new Map(ledger.creditAccounts?.map((entry) => [entry.accountKey, entry]))
  const accounts = new Map<string, Account>(snapshots)
  const creditCandidates = new Set<string>()
  const ozonCreditAccounts = new Set<string>()
  const net = new Map<string, number>()
  for (const row of ledger.transactions) {
    if (row.vtbCreditFormat || /(?:^| · )Кредит(?:ная карта|ка)(?: · |$)/u.test(row.accountLabel)) {
      creditCandidates.add(row.accountKey)
    }
    const ozon = row.bank === 'ozon'
    const creditRepayment = isCreditRepayment(row)
    if (ozon && row.amountMinor > 0 && creditRepayment) ozonCreditAccounts.add(row.accountKey)
    const account = accounts.get(row.accountKey)
    const preferredCurrency = settings.get(row.accountKey)?.currency ?? 'RUB'
    if (!account || (!snapshots.has(row.accountKey) && account.currency !== preferredCurrency && row.currency === preferredCurrency)) {
      const { accountKey, accountLabel, bank, currency } = row
      accounts.set(accountKey, { accountKey, accountLabel, bank, currency })
    }
    if (ozon || row.status === 'pending' || creditRepayment || isTechnicalCreditEntry(row)) continue
    const key = `${row.accountKey}:${row.currency}`
    net.set(key, (net.get(key) ?? 0) - row.amountMinor)
  }

  const tracked: CreditAccount[] = []
  const available: Account[] = []
  for (const account of accounts.values()) {
    const snapshot = snapshots.get(account.accountKey)
    const setting = settings.get(account.accountKey)
    const ozonCredit = ozonCreditAccounts.has(account.accountKey) || (account.bank === 'ozon' && snapshot !== undefined)
    if (snapshot || setting || ozonCredit) {
      const estimated = net.get(`${account.accountKey}:${account.currency}`)
      tracked.push({
        ...account,
        accountLabel: ozonCredit
          ? account.accountLabel.replace(/(^| · )(?:сч[её]т|кредитка)(?= · |$)/iu, '$1Кредитная карта')
          : account.accountLabel,
        snapshot, reminder: setting?.reminder,
        debtMinor: snapshot?.totalOutstandingAmountMinor ?? (estimated && Number.isSafeInteger(estimated) && estimated > 0 ? estimated : undefined),
      })
    } else if (creditCandidates.has(account.accountKey)) {
      available.push(account)
    }
  }
  available.sort((a, b) => Number(b.bank === 'ozon') - Number(a.bank === 'ozon') || a.accountLabel.localeCompare(b.accountLabel, 'ru'))
  return { tracked, available }
}

function bankPayments(snapshot?: CreditSnapshot) {
  if (!snapshot) return []
  return [
    { kind: 'grace', dueOn: snapshot.gracePeriodEnd, amountMinor: snapshot.gracePaymentAmountMinor },
    { kind: 'minimum', dueOn: snapshot.minimumPaymentDate, amountMinor: snapshot.minimumPaymentAmountMinor },
  ] as const
}

export function upcomingBankPayment(account: CreditAccount, today: string, except?: string) {
  return bankPayments(account.snapshot)
    .filter((payment) => payment.dueOn && payment.dueOn >= today && payment.dueOn !== except && payment.amountMinor !== 0)
    .sort((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? ''))[0]?.dueOn
}

export function plannedAmount(account: CreditAccount, reminder: CreditReminder) {
  if (reminder.amountMinor !== undefined) return { minor: reminder.amountMinor, estimate: false }
  const amount = bankPayments(account.snapshot).find((payment) => payment.dueOn === reminder.dueOn &&
    (!reminder.kind || payment.kind === reminder.kind) && payment.amountMinor !== undefined)
  if (amount?.amountMinor !== undefined) return { minor: amount.amountMinor, estimate: false }
  if (account.debtMinor !== undefined && account.debtMinor > 0) return { minor: account.debtMinor, estimate: true }
}

export function calendarDayOffset(date: string, days: number) {
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}

export interface CreditReminderPlan {
  dueOn: string
  untilPaid: boolean
}

function accountReminderPlan(account: CreditAccount): CreditReminderPlan[] {
  const manual = account.reminder
  const plan: CreditReminderPlan[] = manual && !manual.paid ? [{ dueOn: manual.dueOn, untilPaid: true }] : []
  for (const { dueOn, amountMinor } of bankPayments(account.snapshot)) {
    if (dueOn && amountMinor !== 0 && dueOn !== manual?.dueOn && !plan.some((item) => item.dueOn === dueOn)) {
      plan.push({ dueOn, untilPaid: false })
    }
  }
  return plan
}

export function creditReminderPlan(ledger: Ledger) {
  return getCreditAccounts(ledger).tracked.flatMap((account) => {
    const accountLabel = creditAccountShortLabel(account)
    return accountReminderPlan(account).map((item) => ({ ...item, accountLabel }))
  }).sort(
    (a, b) => a.dueOn.localeCompare(b.dueOn) || Number(a.untilPaid) - Number(b.untilPaid),
  )
}

export function isCreditReminderDue({ dueOn, untilPaid }: CreditReminderPlan, today: string, tomorrow: string) {
  return dueOn <= tomorrow && (untilPaid || dueOn >= today)
}

export function dueCreditAccounts(accounts: CreditAccount[], today: string) {
  const tomorrow = calendarDayOffset(today, 1)
  return accounts.filter((account) => accountReminderPlan(account).some((item) => isCreditReminderDue(item, today, tomorrow)))
}

function snapshotDate(snapshot?: Pick<CreditSnapshot, 'observedOn' | 'asOf'>) {
  return snapshot?.observedOn ?? snapshot?.asOf
}

export function updateCreditAccount(ledger: Ledger, accountKey: string, dueOn: string, amountMinor?: number): Ledger {
  const { tracked, available } = getCreditAccounts(ledger)
  const existing = tracked.find((account) => account.accountKey === accountKey)
  const account = existing ?? available.find((account) => account.accountKey === accountKey)
  if (!account) throw new Error('Счёт больше не найден.')
  const before = existing?.reminder
  const samePayment = before?.dueOn === dueOn && before?.amountMinor === amountMinor
  const kind = amountMinor === undefined ? bankPayments(existing?.snapshot)
    .find((payment) => payment.dueOn === dueOn && payment.amountMinor !== undefined)?.kind : undefined
  const reminder = !dueOn ? undefined : samePayment ? before : {
    id: crypto.randomUUID(), dueOn, amountMinor, kind, configuredOn: localDate(),
    snapshotOn: snapshotDate(existing?.snapshot),
  }
  const entry = { accountKey, currency: account.currency, reminder }
  return { ...ledger, creditAccounts: [...(ledger.creditAccounts ?? []).filter((saved) => saved.accountKey !== accountKey), entry] }
}

export function updateCreditPayment(ledger: Ledger, accountKey: string, reminderId: string, paid: boolean): Ledger {
  const entries = ledger.creditAccounts ?? []
  const current = entries.find((entry) => entry.accountKey === accountKey)
  const reminder = current?.reminder
  if (!reminder || reminder.id !== reminderId || reminder.paid?.source === 'bank') return ledger
  return {
    ...ledger,
    creditAccounts: entries.map((entry) => entry === current ? {
      ...entry,
      reminder: { ...reminder, paid: paid ? { on: localDate(), source: 'manual' } : undefined },
    } : entry),
  }
}

export function confirmCreditRemindersFromStatement(ledger: Ledger, statements: ParsedStatement[]): Ledger {
  if (!ledger.creditAccounts?.length || !statements.some((statement) => statement.credit)) return ledger
  let changed = false
  const creditAccounts = ledger.creditAccounts.map((entry) => {
    const reminder = entry.reminder
    if (!reminder || reminder.paid) return entry
    const snapshot = ledger.credits.find((credit) => credit.accountKey === entry.accountKey && credit.currency === entry.currency)
    const observedOn = snapshotDate(snapshot)
    if (!snapshot || !observedOn || observedOn <= (reminder.snapshotOn ?? '') || observedOn < reminder.configuredOn) return entry
    const zeroBalance = snapshot.totalOutstandingAmountMinor === 0 &&
      (snapshot.totalOutstandingAsOf ?? observedOn) >= reminder.configuredOn
    const zeroPayment = (data: NonNullable<ParsedStatement['credit']>) => reminder.kind === 'grace'
      ? data.gracePeriodEnd === reminder.dueOn && data.gracePaymentAmountMinor === 0
      : reminder.kind === 'minimum' && data.minimumPaymentDate === reminder.dueOn && data.minimumPaymentAmountMinor === 0
    if (!statements.some((statement) => {
      const credit = statement.credit
      return statement.accountKey === entry.accountKey && credit?.currency === entry.currency &&
        (credit.asOf ?? statement.periodEnd) === observedOn && (
          (zeroBalance && credit.totalOutstandingAmountMinor === 0 &&
            (credit.totalOutstandingAsOf ?? observedOn) >= reminder.configuredOn) ||
          (zeroPayment(snapshot) && zeroPayment(credit))
        )
    })) return entry
    changed = true
    return { ...entry, reminder: { ...reminder, paid: { on: observedOn, source: 'bank' as const } } }
  })
  return changed ? { ...ledger, creditAccounts } : ledger
}
