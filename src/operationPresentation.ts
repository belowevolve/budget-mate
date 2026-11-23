import { inferIncomeCategory, isVtbBrokerageFunding } from './categories/classify'
import type { Transaction } from './finance'

export function operationTitle(row: Transaction) {
  if (row.placeName) return row.placeName
  if (row.brokerageFunding || (row.category === 'transfer' && isVtbBrokerageFunding(row))) return 'Пополнение брокерского счёта'
  if (row.category === 'transfer' && /систем[уеуыо]|сбп|перевод между своими/i.test(row.description)) return 'Перевод между своими счетами'
  const description = row.description
    .replace(/\s*\.?\s*без НДС\.?\s*$/i, '')
    .replace(/^(?:перевод|зачисление|списание)(?: денежных средств)? (?:(?:[сc]\d*\s*)?через|по) систем[еуыо] быстрых платежей\s*/i, row.amountMinor > 0 ? 'Поступление по СБП ' : 'Перевод по СБП ')
    .replace(/\s+(?:на|от|из)\s*[.,;:]*$/, '')
    .trim()
  if (row.amountMinor > 0 && row.category !== 'transfer') {
    const category = inferIncomeCategory(description)
    if (category === 'cashback') return 'Кешбэк'
    if (category === 'interest') return 'Проценты по вкладу'
    if (category === 'salary') {
      if (/отпускные/i.test(description)) return 'Отпускные'
      if (/командировочные/i.test(description)) return 'Командировочные'
      return /^аванс/i.test(description) ? 'Аванс' : 'Зарплата'
    }
  }
  const merchant = /^оплата товаров и услуг\.\s+(\p{L}.*)$/iu.exec(description)?.[1]
  if (merchant) return merchant
  return description || 'Операция'
}
