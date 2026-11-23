import { rowText, textIn, type StatementPage, type TextCell, type TextRow } from './layout'
import { explicitMcc, isVtbBrokerageFunding, vtbBrokerageDestination } from '../categories/classify'
import { StatementError } from './errors'
import { createSbpTokenizer } from './phone'
import { getSbpCounterparty, getTransferBank, isCreditRepayment, isOwnTransferDescription, isTransferDescription, redactSbpPhone } from './transfer'
import type { BankId, CreditSnapshot, ParsedStatement, StatementTransaction } from './types'

const datePattern = /\b\d{2}\.\d{2}\.\d{4}\b/g
const amountPattern = /^([+−-]?)\s*(\d+(?: \d{3})*)[,.](\d{2})(?:\s*(RUB|RUR|руб\.?|₽|USD|EUR))?$/i

interface RawTransaction extends StatementTransaction {
  sbpPhone?: string
}

interface RawStatement {
  bank: BankId
  accountIdentifier: string
  accountLabel: string
  periodStart?: string
  periodEnd?: string
  transactions: RawTransaction[]
  pendingSnapshot?: ParsedStatement['pendingSnapshot']
  credit?: CreditSnapshot
  warnings: string[]
}

interface PendingTransaction {
  date: string
  amountMinor: number
  currency: string
  description: string[]
  reference?: string
  status?: 'pending'
}

const bankLabels: Record<BankId, string> = {
  alfa: 'Альфа-Банк',
  vtb: 'ВТБ',
  ozon: 'Ozon Банк',
}

function toDate(text: string): string | undefined {
  const [day, month, year] = text.split('.')
  const date = `${year}-${month}-${day}`
  const parsed = new Date(date + 'T00:00:00Z')
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) return
  return date
}

function datesIn(text: string): string[] {
  return Array.from(text.matchAll(datePattern), (date) => toDate(date[0])).filter(
    (date): date is string => Boolean(date),
  )
}

function dateAtStart(text: string): string | undefined {
  const value = /^\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/.exec(text)
  if (value) return datesIn(value[0])[0]
}

function amount(text: string): { amountMinor: number; currency?: string } | undefined {
  const match = amountPattern.exec(text)
  if (!match) return
  const [, sign, whole, fraction, currency] = match
  const magnitude = Number(whole.replaceAll(' ', '')) * 100 + Number(fraction)
  if (!Number.isSafeInteger(magnitude)) return
  return {
    amountMinor: sign === '-' || sign === '−' ? -magnitude : magnitude,
    currency: currency ? normalizeCurrency(currency) : undefined,
  }
}

function normalizeCurrency(text: string): string | undefined {
  if (/^(?:rub|rur|руб\.?|₽|российский рубль)$/i.test(text.trim())) return 'RUB'
  if (/^(?:usd|доллар сша)$/i.test(text.trim())) return 'USD'
  if (/^(?:eur|евро)$/i.test(text.trim())) return 'EUR'
}

function fieldValue(page: StatementPage, label: RegExp): string {
  for (const row of page) {
    const index = row.findIndex((cell) => label.test(cell.text))
    if (index >= 0) return row[index + 1]?.text ?? ''
  }
  return ''
}

function inlineFieldValue(page: StatementPage, label: RegExp): string {
  const cell = page.flat().find((cell) => label.test(cell.text))
  return cell?.text.replace(label, '').trim() ?? ''
}

function period(page: StatementPage, label: RegExp): [string?, string?] {
  const row = page.find((row) => label.test(rowText(row)))
  const [start, end] = datesIn(row ? rowText(row) : '')
  return [start, end]
}

function operationDescription(parts: string[], bank: BankId, incoming: boolean, owner?: RegExp): Pick<RawTransaction, 'description' | 'kind' | 'transferBank' | 'sbpCounterparty' | 'sbpPhone' | 'merchantCategoryCode'> {
  const original = parts.join(' ').replace(/\s+/g, ' ').trim()
  const merchantCategoryCode = explicitMcc(original)
  if (/предоставление транша/i.test(original)) {
    return { description: 'Выдача средств по кредиту', kind: 'transfer' }
  }
  if (/погашение (?:од дог\.|дог\.|кредита|транша|основного долга|задолженности по кредитной карте)/i.test(original)) {
    return { description: 'Погашение кредита', kind: 'transfer' }
  }
  const explicitlyOwn = /перевод между своими счетами/i.test(original)
  const matchedOwner = /(?:внутренний|внутрибанковский) перевод между счетами/i.test(original) && owner?.test(original)
  if (explicitlyOwn || matchedOwner) {
    return { description: 'Перевод между своими счетами', kind: 'transfer' }
  }

  if (bank === 'ozon' && /^Оплата товаров\s*\/\s*услуг/i.test(original)) {
    // The ledger often identifies only the order and the marketplace, without a merchant.
    return { description: original.includes('Ozon') ? 'Оплата товаров и услуг · Ozon' : 'Оплата товаров и услуг', merchantCategoryCode }
  }

  const transfer = isTransferDescription(original)
  const transferBank = transfer ? getTransferBank(original) : undefined
  const sbp = transfer ? getSbpCounterparty(original, incoming) : undefined
  const partyLabel = incoming
    ? /(?:систем[аыуе] быстрых платежей от|отправитель:)\s+(.+)/i
    : /(?:систем[аыуе] быстрых платежей на|получатель:)\s+(.+)/i
  const counterparty = partyLabel.exec(original)?.[1]
  const matchesOwner = owner && counterparty && owner.exec(counterparty)?.index === 0
  const self = transfer && (isOwnTransferDescription(original) || matchesOwner)
  let description = redactSbpPhone(original, sbp?.phoneText)
  const cardLocation = /место совершения операции:\s*([^,]+)/i.exec(description)?.[1]
  if (cardLocation) {
    description = cardLocation.split('\\').slice(3).join(' ').trim() || 'Операция по карте'
  }
  if (owner) description = description.replace(owner, '')
  description = description
    .replace(/(?:^|\s)[А-ЯЁ]{2,}(?:-[А-ЯЁ]{2,})?\s+[А-ЯЁ]{2,}\s+[А-ЯЁ]+(?:ИЧ|ОВНА|ЕВНА|ИЧНА)(?=\s|[.,;()]|$)/gu, ' ')
    .replace(/\+?\d{6}[+*]{4,}\d{4}/g, '')
    .replace(/(?:\+7|8)[\s()-]*\d{3}[\s()-]*\d{3}[\s()-]*\d{2}[\s()-]*\d{2}(?!\d)/g, '')
    .replace(/(?:\d[ -]?){12,22}(?!\d)/g, '')
    .replace(/(?:код авторизации|чек|плат[её]жное поручение)\s*(?:№|N|#|:)?\s*\d+(?:\s+от\s+\d{2}\.\d{2}\.\d{4})?\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:\s*[.,;:№()]+\s*)+$/u, '')
    .trim()
  return {
    description: description.slice(0, 180) || 'Операция по счёту',
    kind: self ? 'transfer' : undefined,
    transferBank,
    sbpCounterparty: sbp?.kind,
    sbpPhone: sbp?.phone,
    merchantCategoryCode,
  }
}

function finish(
  pending: PendingTransaction | undefined,
  transactions: RawTransaction[],
  bank: BankId,
  owner?: RegExp,
) {
  if (!pending) return
  const { date, amountMinor, currency, description, reference, status } = pending
  const paymentPurpose = description.join(' ').trim()
  const brokerageFunding = isVtbBrokerageFunding({ bank, amountMinor, description: paymentPurpose }) || undefined
  const brokerageDestination = brokerageFunding ? vtbBrokerageDestination(paymentPurpose) : undefined
  const row: RawTransaction = {
    date, amountMinor, currency, reference, status, brokerageFunding, brokerageDestination,
    ...operationDescription(description, bank, amountMinor > 0, owner),
  }
  transactions.push(row)
  return row
}

function ownerPattern(name: string): RegExp | undefined {
  const parsed = /^([\p{L}-]+)\s+([\p{L}-]+)\s+([\p{L}-]+)$/u.exec(name)
  if (!parsed) return
  const [, last, first, patronymic] = parsed
  return new RegExp(
    `(?:^|\\s|['«])${last}\\s+(?:${first}\\s+${patronymic}|${first[0]}[. ]*${patronymic[0]}\\.?)(?=$|[^\\p{L}])`,
    'iu',
  )
}

function makeLabel(bank: BankId, type: string, identifier: string): string {
  const lastDigits = identifier.match(/\d{4}$/)?.[0]
  return [bankLabels[bank], type, lastDigits ? `•••• ${lastDigits}` : ''].filter(Boolean).join(' · ')
}

function amountsRead(transactions: StatementTransaction[]): { incoming: number; outgoing: number } {
  let incoming = 0
  let outgoing = 0
  for (const { amountMinor } of transactions) {
    incoming += Math.max(amountMinor, 0)
    outgoing -= Math.min(amountMinor, 0)
  }
  return { incoming, outgoing }
}

function alfaHold(parts: string[], value: ReturnType<typeof amount>, currency: string, owner?: RegExp) {
  const detail = /^Неподтвержд[её]нная операция:\s*(.*?)\s*,?\s*дата операции:\s*(\d{2}\.\d{2}\.\d{4})\b/iu.exec(parts.join(' '))
  if (!value || !detail) return
  const date = toDate(detail[2])
  if (!date || (value.currency && value.currency !== currency) || value.amountMinor > 0) return
  const cumulative = /^Кумулятивная сумма$/iu.test(detail[1])
  const description = cumulative ? 'Операции в обработке' : detail[1]
    .replace(/^[a-z\d]{6}\s+\d{8}\s+[a-z]{2}\s+/iu, '')
    .replace(/-\s*$/u, '')
  const row: RawTransaction = {
    date, amountMinor: value.amountMinor, currency, status: 'pending',
    ...operationDescription([description], 'alfa', false, owner),
  }
  return { row, cumulative }
}

function parseAlfa(pages: StatementPage[]): RawStatement {
  const first = pages[0]
  const identifier = fieldValue(first, /^Номер сч[её]та$/i)
  const [periodStart, periodEnd] = period(first, /^За период с /i)
  const currency = normalizeCurrency(fieldValue(first, /^Валюта сч[её]та$/i))
  if (!/^\d{20}$/.test(identifier) || !currency || !periodStart || !periodEnd) {
    throw new StatementError('В выписке Альфа-Банка не удалось прочитать номер счёта, валюту или период.')
  }
  const isCredit = first.some((row) => row.some((cell) => /^Сч[её]т кредитной карты$/i.test(cell.text)))
  const asOf = datesIn(fieldValue(first, /^Дата формирования$/i))[0]
  const owner = ownerPattern(fieldValue(first, /^Клиент$/i))
  const totalOutstanding = amount(fieldValue(first, /^Общая задолженность к погашению$/i))
  const transactions: RawTransaction[] = []
  const holds: RawTransaction[] = []
  let cumulative: RawTransaction | undefined
  const warnings: string[] = []
  let unreadRows = 0
  let unreadHolds = 0

  for (const page of pages) {
    let inTable = false
    let pending: PendingTransaction | undefined
    let hold: { value: ReturnType<typeof amount>; description: string[] } | undefined
    const finishHold = () => {
      if (!hold) return
      const result = alfaHold(hold.description, hold.value, currency, owner)
      hold = undefined
      if (!result) unreadHolds++
      else if (result.cumulative) {
        if (cumulative) unreadHolds++
        cumulative = result.row
      } else if (result.row.amountMinor) holds.push(result.row)
    }
    for (const row of page) {
      if (row.some((item) => /^Дата проводки$/i.test(item.text))) {
        inTable = true
        continue
      }
      if (!inTable) continue
      const firstColumn = textIn(row, 20, 80)
      const date = dateAtStart(firstColumn)
      const description = textIn(row, 155, 485)
      const atBoundary = firstColumn || row.some((item) => item.x >= 485) || row[0].y < 130
      if (hold && !atBoundary) {
        if (description) hold.description.push(description)
        continue
      }
      finishHold()
      if (/^HOLD$/i.test(firstColumn)) {
        finish(pending, transactions, 'alfa', owner)
        pending = undefined
        hold = { value: amount(textIn(row, 485, 595)), description: [description] }
        continue
      }
      if (date) {
        finish(pending, transactions, 'alfa', owner)
        pending = undefined
        const value = amount(textIn(row, 485, 595))
        if (!value) {
          unreadRows++
          continue
        }
        pending = {
          date,
          amountMinor: value.amountMinor,
          currency: value.currency ?? currency,
          description: [description],
        }
      } else if (firstColumn || row.some((item) => item.x >= 485) || (pending && row[0].y < 130)) {
        finish(pending, transactions, 'alfa', owner)
        pending = undefined
      } else if (pending && description) {
        pending.description.push(description)
      }
    }
    finishHold()
    finish(pending, transactions, 'alfa', owner)
  }

  const { incoming, outgoing } = amountsRead(transactions)
  const printedIncoming = amount(fieldValue(first, /^Поступления$/i))
  const printedOutgoing = amount(fieldValue(first, /^Расходы$/i))
  const unconfirmed = amount(fieldValue(first, /^Неподтвержд[её]нные операции$/i))
  const unconfirmedTotal = unconfirmed && (!unconfirmed.currency || unconfirmed.currency === currency)
    ? Math.abs(unconfirmed.amountMinor)
    : undefined
  const knownHoldTotal = amountsRead(holds).outgoing
  if (cumulative && !unreadHolds && unconfirmedTotal === -cumulative.amountMinor && unconfirmedTotal > knownHoldTotal) {
    holds.push({ ...cumulative, amountMinor: -(unconfirmedTotal - knownHoldTotal) })
  }
  const completePending = !unreadHolds && unconfirmedTotal === amountsRead(holds).outgoing
  if (unreadHolds || (unconfirmedTotal !== undefined && !completePending) || (holds.length && !asOf)) {
    warnings.push('В выписке Альфа-Банка не удалось сверить все операции в обработке.')
  }
  const incomingMismatch = printedIncoming && printedIncoming.amountMinor !== incoming
  const outgoingMismatch = printedOutgoing && printedOutgoing.amountMinor !== outgoing
    && printedOutgoing.amountMinor !== outgoing + (unconfirmedTotal ?? 0)
  if (incomingMismatch || outgoingMismatch) {
    warnings.push('Суммы проведённых операций отличаются от итогов выписки Альфа-Банка.')
  }
  if (unreadRows) warnings.push(`Выписка Альфа-Банка: не удалось прочитать строк операций — ${unreadRows}.`)
  return {
    bank: 'alfa',
    accountIdentifier: identifier,
    accountLabel: makeLabel('alfa', isCredit ? 'Кредитная карта' : 'Счёт', identifier),
    periodStart,
    periodEnd,
    transactions: asOf ? [...transactions, ...holds] : transactions,
    pendingSnapshot: asOf && (unconfirmedTotal !== undefined || holds.length)
      ? { observedOn: asOf, complete: completePending }
      : undefined,
    credit: isCredit ? {
      currency,
      asOf,
      totalOutstandingAmountMinor: totalOutstanding?.amountMinor,
      totalOutstandingAsOf: totalOutstanding ? asOf : undefined,
    } : undefined,
    warnings,
  }
}

function vtbAmountAt(row: TextRow, header: TextCell) {
  const right = header.x + header.width
  for (const cell of row) {
    if (Math.abs(cell.x + cell.width - right) > 6) continue
    const value = amount(cell.text)
    if (value) return value.amountMinor
  }
}

function vtbAccountMovement(row: TextRow, inflow: TextCell, outflow: TextCell) {
  const incoming = vtbAmountAt(row, inflow)
  const outgoing = vtbAmountAt(row, outflow)
  if (incoming === undefined && outgoing === undefined) return
  return (incoming ?? 0) - Math.abs(outgoing ?? 0)
}

function vtbAmountWarnings(first: StatementPage, transactions: StatementTransaction[], unreadRows: number) {
  const { incoming, outgoing } = amountsRead(transactions.filter((row) => row.status !== 'pending'))
  const printedIncoming = amount(fieldValue(first, /^Поступления$/i))
  const printedOutgoing = amount(fieldValue(first, /^Расходные операции$/i))
  const warnings: string[] = []
  if (printedIncoming && printedIncoming.amountMinor !== incoming) {
    warnings.push('Сумма поступлений в таблице отличается от итога выписки ВТБ.')
  }
  if (printedOutgoing && Math.abs(printedOutgoing.amountMinor) !== outgoing) {
    warnings.push('Сумма списаний в таблице отличается от итога выписки ВТБ.')
  }
  if (unreadRows) warnings.push(`Выписка ВТБ: не удалось прочитать строк операций — ${unreadRows}.`)
  return warnings
}

function vtbAccountText(rows: TextRow[], dateRows: TextRow[], minX: number, maxX: number) {
  const result = new Map<TextRow, string[]>()
  let dateIndex = 0
  let lines: string[] = []
  let top = 0
  let bottom = 0

  function finishCell() {
    // The date is centered vertically in the operation, alongside the whole cell.
    while (dateIndex < dateRows.length && dateRows[dateIndex][0].y > top + 2) dateIndex++
    const dateRow = dateRows[dateIndex]
    if (dateRow && dateRow[0].y >= bottom - 2) {
      result.set(dateRow, lines)
      dateIndex++
    }
    lines = []
  }

  for (const row of rows) {
    const y = row[0].y
    if (y <= 55) break
    const text = textIn(row, minX, maxX)
    if (!text) continue
    // Wrapped lines are about 8 pt apart, with a larger gap between operations.
    if (lines.length && bottom - y > 10) finishCell()
    if (!lines.length) top = y
    lines.push(text)
    bottom = y
  }
  if (lines.length) finishCell()
  return result
}

function parseVtbAccount(pages: StatementPage[]): RawStatement {
  const first = pages[0]
  const numberField = fieldValue(first, /^Номер сч[её]та$/i)
  const match = /^(\d{20})\s*\((.+)\)$/u.exec(numberField)
  const currency = match && normalizeCurrency(match[2])
  const [periodStart, periodEnd] = period(first, /^Период выписки/i)
  if (!match || !currency || !periodStart || !periodEnd) {
    throw new StatementError('В выписке ВТБ не удалось прочитать номер счёта, валюту или период.')
  }
  const accountIdentifier = match[1]
  const owner = ownerPattern(rowText(first[0]))
  const transactions: RawTransaction[] = []
  let unreadRows = 0
  let pending: (PendingTransaction & { previousDescription: string[]; previousName: string[] }) | undefined
  const finishRow = () => {
    if (!pending) return
    const previousParts = pending.previousDescription.length ? pending.previousDescription : pending.previousName
    const parts = pending.description.length ? pending.description : previousParts
    const autoTopup = pending.amountMinor > 0 && /^Переводы через СБП\.\s+Автопополнение\.?$/iu.test(parts.join(' '))
    const description = autoTopup ? ['Автопополнение'] : parts
    const row = finish({ ...pending, description }, transactions, 'vtb', owner)
    const previous = operationDescription(previousParts, 'vtb', pending.amountMinor > 0, owner).description
    if (row && previous !== row.description) row.vtbAccountPreviousDescription = previous
  }

  for (const page of pages) {
    const headerIndex = page.findIndex((row) => row.some((cell) => /^Приход$/i.test(cell.text))
      && row.some((cell) => /^Расход$/i.test(cell.text)))
    const inflow = page[headerIndex]?.find((cell) => /^Приход$/i.test(cell.text))
    const outflow = page[headerIndex]?.find((cell) => /^Расход$/i.test(cell.text))
    if (!inflow || !outflow) continue

    const rows = page.slice(headerIndex + 1)
    const dates = new Map(rows.flatMap((row) => {
      const date = dateAtStart(textIn(row, 20, 79))
      return date ? [[row, date] as const] : []
    }))
    const dateRows = [...dates.keys()]
    const descriptions = vtbAccountText(rows, dateRows, 390, 503)
    const names = vtbAccountText(rows, dateRows, 503, 595)
    for (const row of rows) {
      const date = dates.get(row)
      if (date) {
        finishRow()
        pending = undefined
        const amountMinor = vtbAccountMovement(row, inflow, outflow)
        if (amountMinor === undefined || !dateAtStart(textIn(row, 79, 153))) {
          unreadRows++
          continue
        }
        const description = descriptions.get(row) ?? names.get(row) ?? []
        pending = { date, amountMinor, currency, description, previousDescription: [], previousName: [] }
      }
      if (!pending || row[0].y <= 55) continue
      // Keep the old date-to-date text as a lookup alias for existing imports.
      const previousDescription = textIn(row, 390, 503)
      const previousName = textIn(row, 503, 595)
      if (previousDescription) pending.previousDescription.push(previousDescription)
      if (previousName) pending.previousName.push(previousName)
    }
  }
  finishRow()

  return {
    bank: 'vtb',
    accountIdentifier,
    accountLabel: makeLabel('vtb', 'Счёт', accountIdentifier),
    periodStart,
    periodEnd,
    transactions,
    warnings: vtbAmountWarnings(first, transactions, unreadRows),
  }
}

function vtbDocumentDate(text: string): string | undefined {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ]
  const date = /^(\d{1,2})\s+([а-яё]+)\s+(\d{4})\b/i.exec(text)
  if (!date) return datesIn(text)[0]
  const month = months.indexOf(date[2].toLowerCase()) + 1
  if (!month) return
  return toDate([date[1].padStart(2, '0'), String(month).padStart(2, '0'), date[3]].join('.'))
}

function parseVtb(pages: StatementPage[]): RawStatement {
  const first = pages[0]
  const identifier = fieldValue(first, /^Номер договора$/i)
  const card = fieldValue(first, /^Номер карты$/i)
  const account = fieldValue(first, /^Номер сч[её]та$/i)
  const [periodStart, periodEnd] = period(first, /^Период выписки/i)
  const [gracePeriodStart, gracePeriodEnd] = datesIn(fieldValue(first, /^Беспроцентный период$/i))
  const asOf = vtbDocumentDate(rowText(first[0]))
  const minimumPayment = amount(fieldValue(first, /^Минимальный плат[её]ж$/i))
  const minimumPaymentDate = datesIn(fieldValue(first, /^Дата минимального плат[её]жа$/i))[0]
  const totalOutstanding = amount(fieldValue(first, /^Общая сумма задолженности\*?$/i))
  const balance = amount(fieldValue(first, /^Баланс на конец периода$/i))
  const currency = minimumPayment?.currency ?? balance?.currency
  if (!identifier || !periodStart || !periodEnd || !currency) {
    throw new StatementError('В выписке ВТБ не удалось прочитать договор, валюту или период.')
  }
  const transactions: RawTransaction[] = []
  const vtbCreditFormat = card ? 'card' : 'account'
  let unreadRows = 0
  let unreadPending = 0
  let pendingSection = false
  let hasPendingTable = false
  let pending: PendingTransaction | undefined

  for (const page of pages) {
    let columns: { inflow: TextCell; outflow: TextCell; raw: TextCell; descriptionX: number; headerY: number; booked: boolean } | undefined
    for (const row of page) {
      if (/^Операции в обработке$/i.test(rowText(row))) pendingSection = true
      if (row.some((item) => /^Проведена$/i.test(item.text) && item.x < 65)) {
        const inflow = row.find((item) => /^Поступление$/i.test(item.text))
        const outflow = row.find((item) => /^Расход$/i.test(item.text))
        const raw = row.find((item) => /^В валюте$/i.test(item.text))
        const description = row.find((item) => /^Описание(?: операции)?$/i.test(item.text))
        const processed = row.some((item) => /^Обработана$/i.test(item.text))
        const booked = row.some((item) => /^Задолжен-?$/i.test(item.text))
        columns = processed && inflow && outflow && raw && description && (booked || (asOf && pendingSection)) ? {
          inflow, outflow, raw, descriptionX: booked ? 505 : description.x - 5, headerY: row[0].y, booked,
        } : undefined
        if (columns && !booked) hasPendingTable = true
        if (booked) pendingSection = false
        continue
      }
      if (!columns || row[0].y >= columns.headerY - 16) continue
      const firstColumn = textIn(row, 20, 100)
      const date = dateAtStart(firstColumn)
      const description = textIn(row, columns.descriptionX, 590)
      if (date) {
        finish(pending, transactions, 'vtb')
        pending = undefined
        const accountAmount = vtbAccountMovement(row, columns.inflow, columns.outflow) ?? vtbAmountAt(row, columns.raw)
        if (accountAmount === undefined || (columns.booked && !dateAtStart(textIn(row, 100, 175)))) {
          if (columns.booked) unreadRows++
          else unreadPending++
          continue
        }
        pending = { date, amountMinor: accountAmount, currency, description: [description], status: columns.booked ? undefined : 'pending' }
      } else if (pending && description && row[0].y > 55) {
        pending.description.push(description)
      }
    }
  }
  finish(pending, transactions, 'vtb')
  const warnings = vtbAmountWarnings(first, transactions, unreadRows)
  if (unreadPending) warnings.push(`Выписка ВТБ: пропущено операций в обработке — ${unreadPending}.`)

  return {
    bank: 'vtb',
    accountIdentifier: identifier,
    accountLabel: makeLabel('vtb', gracePeriodEnd || minimumPayment ? 'Кредитная карта' : card ? 'Карта' : 'Счёт', card || account || identifier),
    periodStart,
    periodEnd,
    transactions: transactions.map((row) => ({ ...row, vtbCreditFormat })),
    pendingSnapshot: asOf && hasPendingTable ? { observedOn: asOf, complete: unreadPending === 0 } : undefined,
    credit: gracePeriodEnd || minimumPayment ? {
      currency,
      asOf,
      gracePeriodStart,
      gracePeriodEnd,
      minimumPaymentAmountMinor: minimumPayment?.amountMinor,
      minimumPaymentDate,
      totalOutstandingAmountMinor: totalOutstanding?.amountMinor,
      totalOutstandingAsOf: totalOutstanding ? periodEnd : undefined,
    } : undefined,
    warnings,
  }
}

function parseOzon(pages: StatementPage[]): RawStatement {
  const first = pages[0]
  const hasCreditProduct = first.some((row) => /^(?:(?:тип (?:сч[её]та|карты|договора|продукта)|продукт):?\s*)?кредитн(?:ая карта|ый сч[её]т)(?:\s|$)/i.test(rowText(row)))
  const contractRow = first.find((row) => /^Номер договора:/i.test(rowText(row)))
  const identifier = /Номер договора:\s*№?\s*([\p{L}\d-]+)/iu.exec(contractRow ? rowText(contractRow) : '')?.[1]
  const [periodStart, periodEnd] = period(first, /^Период выписки:/i)
  const currency = normalizeCurrency(rowText(first.find((row) => /^Валюта:/i.test(rowText(row))) ?? []).replace(/^Валюта:\s*/i, ''))
  if (!identifier || !periodStart || !periodEnd || !currency) {
    throw new StatementError('В выписке Ozon Банка не удалось прочитать договор, валюту или период.')
  }

  const transactions: RawTransaction[] = []
  const warnings: string[] = []
  let unreadRows = 0
  for (const page of pages) {
    let pending: PendingTransaction | undefined
    for (const row of page) {
      const firstColumn = textIn(row, 53, 155)
      const date = dateAtStart(firstColumn)
      const description = textIn(row, 215, 341)
      const document = textIn(row, 150, 211)
      if (date && /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/.test(firstColumn)) {
        finish(pending, transactions, 'ozon')
        pending = undefined
        const value = amount(textIn(row, 345, 465))
        if (!value) {
          unreadRows++
          continue
        }
        pending = {
          date,
          amountMinor: value.amountMinor,
          currency: value.currency ?? currency,
          reference: /^\d+$/.test(document) ? document : undefined,
          description: [description],
        }
      } else if (firstColumn) {
        finish(pending, transactions, 'ozon')
        pending = undefined
      } else if (pending && row[0].y > 45) {
        if (description) pending.description.push(description)
        if (pending.reference && /^\d{1,3}$/.test(document)) pending.reference += document
      }
    }
    finish(pending, transactions, 'ozon')
  }

  const last = pages.at(-1) ?? []
  const { incoming, outgoing } = amountsRead(transactions)
  const printedIncoming = amount(inlineFieldValue(last, /^Итого зачислений за период:?\s*/i))
  const printedOutgoing = amount(inlineFieldValue(last, /^Итого списаний за период:?\s*/i))
  if ((printedIncoming && printedIncoming.amountMinor !== incoming)
      || (printedOutgoing && Math.abs(printedOutgoing.amountMinor) !== outgoing)) {
    warnings.push('Суммы проведённых операций отличаются от итогов выписки Ozon Банка.')
  }
  if (unreadRows) warnings.push(`Выписка Ozon Банка: не удалось прочитать строк операций — ${unreadRows}.`)
  const isCredit = hasCreditProduct || transactions.some((row) => row.amountMinor > 0 && isCreditRepayment(row))
  return {
    bank: 'ozon',
    accountIdentifier: identifier,
    accountLabel: makeLabel('ozon', isCredit ? 'Кредитная карта' : 'Счёт', identifier),
    periodStart,
    periodEnd,
    transactions,
    credit: isCredit ? { currency, asOf: periodEnd } : undefined,
    warnings,
  }
}

async function hash(text: string): Promise<string> {
  const value = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function parseStatementText(pages: StatementPage[], sbpKey?: string): Promise<ParsedStatement> {
  const first = pages[0]?.map(rowText) ?? []
  if (first.length === 0) throw new StatementError('В PDF не найден текст выписки. Для импорта нужен PDF с текстом из банка.')

  let parsed: RawStatement
  if (first.some((line) => /^Справка о движении средств$/i.test(line))
      && first.some((line) => /[«"]Озон Банк[»"]/i.test(line))) {
    parsed = parseOzon(pages)
  } else if (first.some((line) => /^Выписка по (?:карте|сч[её]ту)$/i.test(line))
      && first.some((line) => /^Номер договора /i.test(line))) {
    parsed = parseVtb(pages)
  } else if (first.some((line) => /^Номер сч[её]та \d{20}\s*\(/i.test(line))
      && first.some((line) => /^Операции по сч[её]ту$/i.test(line))
      && first.some((line) => /^Дата и время Дата обработки /i.test(line))) {
    parsed = parseVtbAccount(pages)
  } else if (first.some((line) => /^Выписка по сч[её]ту$/i.test(line))
      && first.some((line) => /^Валюта сч[её]та /i.test(line))) {
    parsed = parseAlfa(pages)
  } else {
    throw new StatementError('Формат выписки не распознан. Поддерживаются выписки Альфа-Банка, ВТБ и Ozon Банка.')
  }

  const { accountIdentifier, transactions: rawTransactions, ...statement } = parsed
  const accountKey = await hash(`${statement.bank}:account:${accountIdentifier}`)
  const sbpToken = sbpKey ? await createSbpTokenizer(sbpKey) : undefined
  const transactions = await Promise.all(rawTransactions.map(async ({ reference, sbpPhone, ...transaction }) => ({
    ...transaction,
    reference: reference ? await hash(`${accountKey}:operation:${reference}`) : undefined,
    sbpPhoneToken: sbpPhone && sbpToken ? await sbpToken(sbpPhone) : undefined,
  })))
  return { ...statement, accountKey, transactions }
}
