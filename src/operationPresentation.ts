import type { Transaction } from './finance'

export function operationTitle(row: Transaction) {
  if (row.category === 'transfer' && /систем[уеуыо]|сбп|перевод между своими/i.test(row.description)) return 'Перевод между своими счетами'
  const description = row.description
    .replace(/\s*\.?\s*без НДС\.?\s*$/i, '')
    .replace(/^(?:перевод|зачисление|списание)(?: денежных средств)? (?:(?:[сc]\d*\s*)?через|по) систем[еуыо] быстрых платежей\s*/i, row.amountMinor > 0 ? 'Поступление по СБП ' : 'Перевод по СБП ')
    .replace(/\s+(?:на|от|из)\s*[.,;:]*$/, '')
    .trim()
  if (/начислени[ея] кэшб[еэ]ка|cashback|вознаграждение по программе|компенсация покупок/i.test(description)) return 'Кэшбэк'
  return description || 'Операция'
}
