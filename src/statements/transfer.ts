import type { StatementTransaction } from './types'
import { normalizeSbpPhone } from './phone'

export function isOwnTransferDescription(text: string) {
  return /между (?:своими|моими|собственными)|с (?:моего|своего) сч[её]та|на (?:свой|мой) сч[её]т|перевод (?:собственных средств|себе)|самому себе|\bme2me\b/i.test(text)
}

export function isSbp(text: string) {
  return /систем[аыуе] быстрых платежей|(?<!\p{L})сбп(?!\p{L})|\bsbp\b/iu.test(text)
}

interface SbpCounterparty {
  kind: NonNullable<StatementTransaction['sbpCounterparty']>
  phone?: string
  phoneText?: string
}

export function getSbpCounterparty(text: string, incoming?: boolean): SbpCounterparty | undefined {
  const template = /^перевод\s+(?:денежных средств\s+)?(?:(?:[сc]\d*\s*)?через\s+|по\s+)?систем[аыуе]\s+быстрых\s+платежей\s+(?:на|от)(?=[\s.]|$)/iu
  const source = text.trim()
  const match = template.exec(source)
  const label = incoming ? /(?<!\p{L})отправитель\s*:/iu : /(?<!\p{L})получатель\s*:/iu
  const labeled = incoming !== undefined && isSbp(source) ? label.exec(source) : null
  const marker = match ?? labeled
  if (!marker) return
  const counterparty = source.slice(marker.index + marker[0].length)
    .replace(/[\s.]*без\s+ндс[\s.]*$/iu, '')
    .replace(/^[\s.]+|[\s.]+$/g, '')
  if (!counterparty) return { kind: 'blank' }
  const phoneMatch = /^(?:тел(?:ефон)?\.?\s*:?\s*)?((?:\+?7|8)[\s()-]*\d{3}[\s()-]*\d{3}[\s()-]*\d{2}[\s()-]*\d{2})(?=$|[\s,.;])/iu.exec(counterparty)
  const phone = phoneMatch?.[1]
  const normalized = phone && normalizeSbpPhone(phone)
  if (normalized && phoneMatch) {
    const extra = counterparty.slice(phoneMatch[0].length).replace(/[\s,.;]+/g, '')
    return { kind: extra ? 'other' : 'phone', phone: normalized, phoneText: phone }
  }
  return { kind: 'other' }
}

export function redactSbpPhone(text: string, phoneText: string | undefined) {
  return phoneText ? text.replaceAll(phoneText, '').replace(/\s{2,}/g, ' ').trim() : text
}

export function isTransferDescription(text: string) {
  return (
    /^(?:(?:входящий|исходящий|внутренний|внутрибанковский|межбанковский) )?перевод(?:\s|$)/i.test(text)
    || (isSbp(text) && /^(?:пополнение|зачисление|списание|сбп|sbp)(?:[\s·-–—:]|$)/i.test(text))
  ) && !/^(?:перевод|сбп)\s+(?:комиссии|процентов|к[эе]шб[эе]ка)/i.test(text)
}

const counterpartBanks: [NonNullable<StatementTransaction['transferBank']>, RegExp][] = [
  ['alfa', /^(?:ао\s+)?[«"]?альфа[-\s]банк(?!\p{L})/iu],
  ['vtb', /^(?:пао\s+|банк\s+)?[«"]?втб(?!\p{L})/iu],
  ['ozon', /^(?:ооо\s+)?[«"]?(?:озон\s+банк|ozon\s+(?:банк|bank))(?!\p{L})/iu],
  ['other', /^[«"]?(?:сбер(?:банк)?|тинькофф|т[-\s]банк|совкомбанк|газпромбанк|райффайзенбанк|росбанк|псб|мтс\s+банк)(?!\p{L})/iu],
]

export function getTransferBank(text: string): StatementTransaction['transferBank'] {
  const markers = text.matchAll(/(?:^|\s)(?:в|из|от|банк (?:получателя|отправителя)\s*:?)\s+/gi)
  const banks = new Set<NonNullable<StatementTransaction['transferBank']>>()
  for (const marker of markers) {
    const tail = text.slice((marker.index ?? 0) + marker[0].length)
    const counterpart = counterpartBanks.find(([, pattern]) => pattern.test(tail))
    if (counterpart) banks.add(counterpart[0])
  }
  return banks.size === 1 ? banks.values().next().value : undefined
}
