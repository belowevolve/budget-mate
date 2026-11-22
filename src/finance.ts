import type { RefundAllocation, RefundIndex } from './refunds'
import type { BankId, ParsedStatement, StatementTransaction } from './statements'
import type { CreditAccountSettings } from './credits/creditAccounts'
import type { Bill } from './bills/bill'
import { createSbpKey, createSbpTokenizer, normalizeSbpPhone } from './statements/phone'
import { mergePending, type PendingCoverage } from './statements/pending'
import { getSbpCounterparty, getTransferBank, isOwnTransferDescription, isTransferDescription, redactSbpPhone } from './statements/transfer'

export const banks = { alfa: 'Альфа-Банк', vtb: 'ВТБ', ozon: 'Ozon Банк' } satisfies Record<BankId, string>

export const categories = {
  groceries: { label: 'Продукты' },
  dining: { label: 'Кафе и рестораны' },
  shopping: { label: 'Покупки' },
  transport: { label: 'Транспорт' },
  home: { label: 'Дом и услуги' },
  health: { label: 'Здоровье' },
  other: { label: 'Прочее' },
  income: { label: 'Поступления' },
  transfer: { label: 'Свои переводы' },
}

export type Category = keyof typeof categories

export interface Transaction extends StatementTransaction {
  id: string
  bank: BankId
  accountKey: string
  accountLabel: string
  category: Category
  categoryEdited?: boolean
  transferMatchId?: string
  creditSettlementFor?: string
  ownPhoneMatch?: true
  pendingObservedOn?: string
}

export interface ImportEntry {
  id: string
  bank: BankId
  accountLabel: string
  periodStart?: string
  periodEnd?: string
  added: number
  importedAt: string
}

export interface CreditSnapshot extends NonNullable<ParsedStatement['credit']> {
  bank: BankId
  accountKey: string
  accountLabel: string
  observedOn?: string
}

export interface Ledger {
  version: 1
  transactions: Transaction[]
  imports: ImportEntry[]
  credits: CreditSnapshot[]
  creditAccounts?: CreditAccountSettings[]
  sbp?: { key: string; ownPhone?: { token: string; label: string } }
  refunds?: RefundAllocation[]
  pendingCoverage?: PendingCoverage[]
  bills?: Bill[]
}

export const emptyLedger: Ledger = { version: 1, transactions: [], imports: [], credits: [] }

export function ensureSbpKey(ledger: Ledger): Ledger {
  return ledger.sbp ? ledger : { ...ledger, sbp: { key: createSbpKey() } }
}

export async function setOwnSbpPhone(ledger: Ledger, phone: string | null): Promise<Ledger> {
  if (phone === null) {
    if (!ledger.sbp?.ownPhone) return ledger
    return reconcileLedger({ ...ledger, sbp: { key: ledger.sbp.key } })
  }

  const normalized = normalizeSbpPhone(phone)
  if (!normalized) throw new Error('Введи российский номер целиком, например +7 900 000-00-00.')
  const key = ledger.sbp?.key ?? createSbpKey()
  const tokenFor = await createSbpTokenizer(key)
  const token = await tokenFor(normalized)
  if (ledger.sbp?.ownPhone?.token === token) return ledger
  const label = `+7 ••• ••• ${normalized.slice(-4, -2)} ${normalized.slice(-2)}`
  return reconcileLedger({ ...ledger, sbp: { key, ownPhone: { token, label } } })
}

export const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const moneyFormatters = new Map<string, Intl.NumberFormat>()

export function localDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date.slice(0, 10)}T00:00:00Z`))
}

export function formatMonth(month: string) {
  if (!month) return 'Весь период'
  const [year, number] = month.split('-')
  return `${months[Number(number) - 1]} ${year}`
}

export function money(amountMinor: number, currency = 'RUB', exact = false) {
  const decimals = exact && amountMinor % 100 !== 0 ? 2 : 0
  const key = `${currency}:${decimals}`
  let formatter = moneyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    moneyFormatters.set(key, formatter)
  }
  return formatter.format(amountMinor / 100)
}

function legacyCategory(transaction: StatementTransaction): Category {
  const text = transaction.description.toLowerCase()
  if (transaction.kind === 'transfer') return 'transfer'
  if (/между своими|перевод между (моими|собственными)|с (моего|своего) сч[её]та|на (свой|мой) сч[её]т|перевод собственных средств/.test(text)) return 'transfer'
  if (transaction.amountMinor > 0) return 'income'
  if (/супермаркет|продукт|пят[её]рочка|вкусвилл|перекр[её]сток|\b(?:lenta|vkusvill|pyaterochka|magnit|perekrestok)\b|лента|дискаунтер/.test(text)) return 'groceries'
  if (/ресторан|кафе|кофейн|столовая|пекарня|бург|додо|\b(?:coffee|restoran|restaurant|vkusno|dodo|burger|kfc)\b/.test(text)) return 'dining'
  if (/транспорт|метро|такси|проезд|парковк|\b(?:yandex go|uber|taxi|metro|rzd)\b|азс|ржд/.test(text)) return 'transport'
  if (/аптек|медицин|стоматол|клиника|\b(?:apteka|pharmacy)\b/.test(text)) return 'health'
  if (/жкх|коммуналь|электроэнерг|интернет провайдер|оплата услуг связи/.test(text)) return 'home'
  if (/маркетплейс|магазин|\b(?:ozon|wildberries|lamoda)\b|вайлдберриз|ламода/.test(text)) return 'shopping'
  return 'other'
}

export function classify(transaction: StatementTransaction): Category {
  if (isOwnTransferDescription(transaction.description)) return 'transfer'
  return legacyCategory(transaction)
}

function userSelectedCategory(row: Transaction) {
  return row.categoryEdited ?? (
    !row.transferMatchId && !row.ownPhoneMatch && row.category !== classify(row) && row.category !== legacyCategory(row)
  )
}

export function needsTransferReview(row: Transaction) {
  if (row.status === 'pending' || row.bank !== 'alfa' || row.category === 'transfer' || userSelectedCategory(row)) return false
  const counterparty = row.sbpCounterparty ?? getSbpCounterparty(row.description)?.kind
  if (counterparty === 'phone' && row.amountMinor > 0 && row.sbpPhoneToken) return false
  return counterparty === 'blank' || counterparty === 'phone'
}

export function isBudgetTransaction(row: Transaction) {
  return row.category !== 'transfer' && !needsTransferReview(row)
}

function isCreditDraw(row: Transaction) {
  return /^Выдача средств по кредиту$/i.test(row.description)
}

export function isCreditRepayment(row: Transaction) {
  return /^Погашение кредита$/i.test(row.description)
}

export function isTechnicalCreditEntry(row: Transaction) {
  return row.category === 'transfer' && (isCreditDraw(row) || !!row.creditSettlementFor)
}

type TransferRole = 'self' | 'peer' | 'repayment'

function matchesOwnPhone(row: Transaction, ownPhoneToken: string | undefined) {
  return ownPhoneToken !== undefined && row.sbpPhoneToken === ownPhoneToken
}

function transferRole(row: Transaction, ownPhoneToken: string | undefined): TransferRole | undefined {
  const edited = userSelectedCategory(row)
  if (edited && row.category !== 'transfer') return
  if (isCreditDraw(row)) return
  if (isCreditRepayment(row)) return 'repayment'
  if ((edited && row.category === 'transfer') || matchesOwnPhone(row, ownPhoneToken) || classify(row) === 'transfer') return 'self'
  if (isTransferDescription(row.description)) return 'peer'
}

interface TransferCandidate {
  row: Transaction
  role: TransferRole
  bankHint: StatementTransaction['transferBank']
}

function matchScore(outgoing: TransferCandidate, incoming: TransferCandidate) {
  if (outgoing.row.accountKey === incoming.row.accountKey || outgoing.role === 'repayment') return 0
  const outgoingHint = outgoing.bankHint === incoming.row.bank
  const incomingHint = incoming.bankHint === outgoing.row.bank
  if ((outgoing.bankHint && !outgoingHint) || (incoming.bankHint && !incomingHint)) return 0
  const namedBank = outgoingHint || incomingHint
  const exactDate = outgoing.row.date === incoming.row.date
  const bothSelf = outgoing.role === 'self' && incoming.role === 'self'
  if (!exactDate && !namedBank && !bothSelf) return 0
  if (outgoing.role === 'peer' && incoming.role === 'peer' && !namedBank) return 0
  const evidence = bothSelf ? 6
    : outgoingHint && incomingHint ? 5
    : namedBank ? 4
    : incoming.role === 'repayment' ? 2
    : 3
  return evidence * 2 + Number(exactDate)
}

function transferLookupKey(amountMinor: number, currency: string, date: string) {
  return `${currency}:${Math.abs(amountMinor)}:${date}`
}

function adjacentDates(date: string) {
  const time = Date.parse(date)
  return [date, new Date(time - 86_400_000).toISOString().slice(0, 10), new Date(time + 86_400_000).toISOString().slice(0, 10)]
}

function markCreditSettlements(rows: Transaction[]): Transaction[] {
  const deposits = new Map<string, string | null>()
  const repayments = new Map<string, string | null>()
  for (const row of rows) {
    if (row.status === 'pending' || row.category !== 'transfer') continue
    const entries = row.amountMinor > 0 && row.transferMatchId ? deposits
      : row.amountMinor < 0 && isCreditRepayment(row) ? repayments
      : undefined
    if (!entries) continue
    const key = `${row.accountKey}:${transferLookupKey(row.amountMinor, row.currency, row.date)}`
    entries.set(key, entries.has(key) ? null : row.id)
  }

  const settlements = new Map<string, string>()
  for (const [key, repayment] of repayments) {
    const deposit = deposits.get(key)
    if (repayment && deposit) settlements.set(repayment, deposit)
  }

  let updated = false
  const marked = rows.map((row) => {
    const creditSettlementFor = settlements.get(row.id)
    if (row.creditSettlementFor === creditSettlementFor) return row
    updated = true
    return { ...row, creditSettlementFor }
  })
  return updated ? marked : rows
}

export function reconcileTransactions(rows: Transaction[], ownPhoneToken?: string): Transaction[] {
  const incoming = new Map<string, TransferCandidate[]>()
  const outgoing: TransferCandidate[] = []
  for (const row of rows) {
    if (!row.amountMinor || row.status === 'pending') continue
    const role = transferRole(row, ownPhoneToken)
    if (!role) continue
    const candidate = { row, role, bankHint: row.transferBank ?? getTransferBank(row.description) }
    if (row.amountMinor < 0) outgoing.push(candidate)
    else {
      const key = transferLookupKey(row.amountMinor, row.currency, row.date)
      const others = incoming.get(key)
      if (others) others.push(candidate)
      else incoming.set(key, [candidate])
    }
  }

  const best = new Map<string, { peer: string; score: number; ambiguous: boolean }>()
  function recordMatch(id: string, peer: string, score: number) {
    const previous = best.get(id)
    if (!previous || score > previous.score) best.set(id, { peer, score, ambiguous: false })
    else if (score === previous.score) previous.ambiguous = true
  }

  for (const debit of outgoing) {
    const { id, amountMinor, currency, date } = debit.row
    for (const day of adjacentDates(date)) {
      const credits = incoming.get(transferLookupKey(amountMinor, currency, day)) ?? []
      for (const credit of credits) {
        const score = matchScore(debit, credit)
        if (!score) continue
        recordMatch(id, credit.row.id, score)
        recordMatch(credit.row.id, id, score)
      }
    }
  }

  let updated = false
  const reconciled = rows.map((row): Transaction => {
    const pair = best.get(row.id)
    const back = pair ? best.get(pair.peer) : undefined
    const transferMatchId = pair && !pair.ambiguous && back?.peer === row.id && !back.ambiguous
      ? (row.amountMinor < 0 ? row.id : pair.peer)
      : undefined
    const categoryEdited = userSelectedCategory(row) ? true : row.categoryEdited
    const ownPhoneMatch = !categoryEdited && matchesOwnPhone(row, ownPhoneToken) ? true : undefined
    const category = categoryEdited ? row.category : transferMatchId || ownPhoneMatch ? 'transfer' : classify(row)
    if (category === row.category && categoryEdited === row.categoryEdited &&
        transferMatchId === row.transferMatchId && ownPhoneMatch === row.ownPhoneMatch) return row
    updated = true
    return { ...row, category, categoryEdited, transferMatchId, ownPhoneMatch }
  })
  return markCreditSettlements(updated ? reconciled : rows)
}

export function reconcileLedger(ledger: Ledger): Ledger {
  const transactions = reconcileTransactions(ledger.transactions, ledger.sbp?.ownPhone?.token)
  return transactions === ledger.transactions ? ledger : { ...ledger, transactions }
}

function privateDescription(row: StatementTransaction) {
  return redactSbpPhone(row.description, getSbpCounterparty(row.description, row.amountMinor > 0)?.phoneText)
}

function operationKey(accountKey: string, row: StatementTransaction) {
  const identity = row.reference ?? privateDescription(row).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
  return JSON.stringify([accountKey, row.date, row.amountMinor, row.currency, identity])
}

export function mergeStatements(ledger: Ledger, statements: ParsedStatement[]) {
  const ownPhoneToken = ledger.sbp?.ownPhone?.token
  const reconciled = reconcileTransactions(ledger.transactions, ownPhoneToken)
  const transactions = reconciled.filter((row) => row.status !== 'pending')
  let pending = reconciled.filter((row) => row.status === 'pending')
  const previousCoverage = ledger.pendingCoverage ?? []
  let coverage = previousCoverage
  const positions = new Map<string, number[]>()
  for (const [index, row] of transactions.entries()) {
    const key = operationKey(row.accountKey, row)
    const matching = positions.get(key)
    if (matching) matching.push(index)
    else positions.set(key, [index])
  }
  const imports = [...ledger.imports]
  const credits = new Map(ledger.credits.map((credit) => [credit.accountKey, credit]))
  let added = 0
  let skipped = 0
  let updatedCredits = 0

  for (const statement of statements) {
    const keyOf = (row: StatementTransaction) => operationKey(statement.accountKey, row)
    const makeTransaction = (row: StatementTransaction, hold?: Transaction): Transaction => ({
      ...row,
      id: hold?.id ?? crypto.randomUUID(),
      bank: statement.bank,
      accountKey: statement.accountKey,
      accountLabel: statement.accountLabel,
      category: hold?.categoryEdited ? hold.category : classify(row),
      categoryEdited: hold?.categoryEdited,
    })
    const heldKeys = new Set(statement.transactions.filter((row) => row.status === 'pending').map(keyOf))
    const seen = new Map<string, number>()
    let newRows = 0
    let newCredit = false
    for (const row of statement.transactions) {
      if (row.status === 'pending') continue
      const key = keyOf(row)
      const occurrence = (seen.get(key) ?? 0) + 1
      seen.set(key, occurrence)
      const matching = positions.get(key) ?? []
      const existingIndex = matching[occurrence - 1]
      if (existingIndex !== undefined) {
        const existing = transactions[existingIndex]
        const description = privateDescription(existing)
        if ((row.kind && row.kind !== existing.kind) || (row.transferBank && row.transferBank !== existing.transferBank)
            || (row.sbpCounterparty && row.sbpCounterparty !== existing.sbpCounterparty)
            || (row.sbpPhoneToken && row.sbpPhoneToken !== existing.sbpPhoneToken) || description !== existing.description) {
          const refreshed = {
            ...existing,
            description,
            kind: row.kind ?? existing.kind,
            transferBank: row.transferBank ?? existing.transferBank,
            sbpCounterparty: row.sbpCounterparty ?? existing.sbpCounterparty,
            sbpPhoneToken: row.sbpPhoneToken ?? existing.sbpPhoneToken,
          }
          if (!refreshed.categoryEdited) refreshed.category = classify(refreshed)
          transactions[existingIndex] = refreshed
        }
        skipped++
        continue
      }

      matching.push(transactions.length)
      positions.set(key, matching)
      const observedOn = statement.pendingSnapshot?.observedOn
      const holdIndex = observedOn && !heldKeys.has(key) ? pending.findIndex((hold) => hold.accountKey === statement.accountKey
        && (hold.pendingObservedOn ?? '') <= observedOn && keyOf(hold) === key) : -1
      const [hold] = holdIndex >= 0 ? pending.splice(holdIndex, 1) : []
      if (!hold) newRows++
      transactions.push(makeTransaction(row, hold))
    }
    const pendingMerge = mergePending(pending, coverage, statement, keyOf, makeTransaction,
      (key) => positions.get(key)?.length ?? 0)
    pending = pendingMerge.transactions
    coverage = pendingMerge.coverage
    newRows += pendingMerge.added

    if (statement.credit) {
      const observedOn = statement.credit.asOf ?? statement.periodEnd
      const current = credits.get(statement.accountKey)
      if ((!current || (observedOn ?? '') >= (current.observedOn ?? '')) &&
          (!current || JSON.stringify(statement.credit) !== JSON.stringify(
            Object.fromEntries(Object.keys(statement.credit).map((key) => [key, current[key as keyof CreditSnapshot]])),
          ) || current.observedOn !== observedOn)) {
        credits.set(statement.accountKey, {
          ...statement.credit,
          bank: statement.bank,
          accountKey: statement.accountKey,
          accountLabel: statement.accountLabel,
          observedOn,
        })
        newCredit = true
        updatedCredits++
      }
    }

    if (newRows || newCredit) {
      imports.unshift({
        id: crypto.randomUUID(),
        bank: statement.bank,
        accountLabel: statement.accountLabel,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        added: newRows,
        importedAt: localDate(),
      })
    }
    added += newRows
  }

  const saved = reconcileTransactions([...transactions, ...pending], ownPhoneToken)
  const existing = new Map(ledger.transactions.map((row) => [row.id, row]))
  const updatedTransactions = saved.filter((row) => existing.has(row.id) && existing.get(row.id) !== row).length
  const savedIds = new Set(saved.map((row) => row.id))
  const removedTransactions = ledger.transactions.filter((row) => row.status === 'pending' && !savedIds.has(row.id)).length
  saved.sort((a, b) => b.date.localeCompare(a.date))
  return {
    ledger: {
      ...ledger,
      transactions: saved,
      imports,
      credits: [...credits.values()],
      pendingCoverage: coverage === previousCoverage ? ledger.pendingCoverage : coverage,
    },
    added,
    skipped,
    updatedCredits,
    updatedTransactions,
    removedTransactions,
    updatedPendingCoverage: coverage !== previousCoverage,
  }
}

export function transactionAccountingAmount(row: Transaction, refunds?: RefundIndex) {
  if (refunds?.byIncome.has(row.id)) return 0
  return row.amountMinor + (refunds?.byExpense.get(row.id)?.totalMinor ?? 0)
}

export function summarize(transactions: Transaction[], refunds?: RefundIndex) {
  let income = 0
  let expenses = 0
  const spending = new Map<Category, number>()
  for (const row of transactions) {
    if (!isBudgetTransaction(row)) continue
    const amount = transactionAccountingAmount(row, refunds)
    if (amount > 0) income += amount
    if (amount < 0) {
      expenses -= amount
      spending.set(row.category, (spending.get(row.category) ?? 0) - amount)
    }
  }
  return { income, expenses, spending: [...spending].sort((a, b) => b[1] - a[1]) }
}
