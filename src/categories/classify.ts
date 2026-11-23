import type { BankId, StatementTransaction } from '../statements/types'
import { isOwnTransferDescription } from '../statements/transfer'
import type { BuiltinCategory } from './catalog'

export type CategoryInput = StatementTransaction & { bank?: BankId }

const mccCategories: Partial<Record<string, BuiltinCategory>> = {
  '4111': 'transport', '4112': 'transport', '4121': 'transport', '4131': 'transport',
  '4784': 'transport', '5541': 'transport', '5542': 'transport', '7523': 'transport',
  '4814': 'subscriptions', '4816': 'subscriptions', '4841': 'subscriptions',
  '4899': 'subscriptions', '5968': 'subscriptions',
  '4900': 'home', '5211': 'home', '6513': 'home',
  '5411': 'groceries', '5422': 'groceries', '5441': 'groceries',
  '5451': 'groceries', '5462': 'groceries', '5499': 'groceries',
  '5611': 'clothes', '5621': 'clothes', '5631': 'clothes', '5641': 'clothes', '5651': 'clothes',
  '5655': 'clothes', '5661': 'clothes', '5691': 'clothes', '5699': 'clothes',
  '5811': 'dining', '5812': 'dining', '5814': 'dining', '5813': 'social',
  '5311': 'shopping', '5331': 'shopping', '5399': 'shopping',
  '5732': 'shopping', '5942': 'shopping', '5945': 'shopping', '7832': 'shopping',
  '7994': 'shopping', '7996': 'shopping', '7998': 'shopping',
  '5947': 'gifts', '5992': 'gifts',
  '5912': 'health', '7298': 'health', '7941': 'health', '7997': 'health', '8011': 'health',
  '8021': 'health', '8041': 'health', '8042': 'health', '8043': 'health', '8062': 'health',
  '8071': 'health', '8099': 'health',
}

const incomeDescriptions: [BuiltinCategory, RegExp][] = [
  ['salary', /заработн\p{L}+\s+плат|зарплат|оплата труда|отпускные|командировочные|\b(?:salary|payroll)\b/u],
  ['cashback', /к[еэ]шб[еэ]к|cash\s?back|альфа[- ]выгодно|выплата за операции покупок|компенсация покупок/u],
  ['interest', /(?:процент|доход по)\p{L}*.{0,40}(?:вклад|депозит|накопительн)|(?:вклад|депозит|накопительн).{0,40}выплата процентов/u],
  ['sale', /оплата за (?:продажу|проданный|проданную)|выплата за продажу/u],
]

const expenseDescriptions: [BuiltinCategory, RegExp][] = [
  ['fees', /(?:^|\s)комисси[яию](?:\s|$)|взимание платы|плата за обслуживание/u],
  ['groceries', /супермаркет|продукт|пят[её]рочка|вкусвилл|перекр[её]сток|магнит|хозтовар|(?<!\p{L})(?:lenta|magnit|pyater(?:ochka)?|perekrestok|vkusvill|лента|дикси|dixy|fix price|fixprice|семишагофф)(?!\p{L})/u],
  ['dining', /ресторан|кафе|кофейн|столовая|пекарня|додо|dodopizza|(?:бургер\s*кинг|burger\s*king)|\b(?:coffee|coffeehouse|restaurant|restoran|rostics|kfc|dodo|burger|yandex\s+eda)\b|доставка еды|вкусно\s*[—–-]\s*и точка/u],
  ['health', /аптек|медицин|стоматол|клиник|фитнес|\b(?:apteka|pharmacy|fitness|invitro|helix)\b|инвитро|хеликс|спортклуб/u],
  ['clothes', /магазин одежды|магазин обуви|ламода|\b(?:lamoda|gloria jeans|sportmaster|kari|zenden|reserved|uniqlo)\b|спортмастер/u],
  ['transport', /транспорт|метро|такси|проезд|парковк|азс|ржд|\b(?:yandex go|uber|taxi|metro|rzd|aeroflot|belkacar|delimobil)\b|аэрофлот|делимобиль/u],
  ['gifts', /цветочн|магазин подарков|flowwow|букет/u],
  ['subscriptions', /подписк[аиу]|абонентская плата|интернет[- ]провайдер|услуг[аи]\s+связи|мобильная связь|\b(?:yota|tele2|beeline|megafon)\b|ростелеком|билайн|мегафон/u],
  ['home', /жкх|коммуналь|электроэнерг|квартплата|аренда квартир/u],
  ['social', /(?:^|[^\p{L}])(?:бар|паб|pub|nightclub)(?!\p{L})|ночной клуб/u],
  ['shopping', /маркетплейс|магазин|кинотеатр|билеты в кино|\b(?:ozon|wildberries|steam|kinomax)\b|вайлдберриз|яндекс[ .-]маркет/u],
]

export function explicitMcc(text: string): string | undefined {
  return /(?:^|[^\p{L}\d])(?:mcc|мсс)(?:\s*[-–]?\s*код)?\s*[:#=№-]?\s*(\d{4})(?![\p{L}\d])/iu.exec(text)?.[1]
}

export function isExplicitOwnTransfer(transaction: StatementTransaction) {
  return transaction.kind === 'transfer' || isOwnTransferDescription(transaction.description)
}

export function vtbBrokerageDestination(description: string): string | undefined {
  const purpose = description.replace(/^перевод между своими счетами\.\s*перечисление дс для приобретения ценных бумаг\.\s*/iu, '')
  const subposition = /^основной\s+рынок\s*\.\s*субпозиция\s*(?:№|no)\s*([\p{L}\d-]+)(?=[\s(.,]|$)/iu.exec(purpose)?.[1]
  return subposition?.normalize('NFKC').toLowerCase()
}

export function isVtbBrokerageFunding({ bank, amountMinor, description }: Pick<CategoryInput, 'bank' | 'amountMinor' | 'description'>) {
  return bank === 'vtb' && amountMinor < 0
    && vtbBrokerageDestination(description) !== undefined
    && (/(?<!\p{L})переводы\s+через\s+сбп(?!\p{L})/iu.test(description) || isOwnTransferDescription(description))
    && !/(?<!\p{L})(?:оплата\s+услуг|(?:взимание|удержание|списание|оплата)\s+комисси\p{L}*)(?!\p{L})/iu.test(description)
}

export function inferIncomeCategory(description: string) {
  const text = description.normalize('NFKC').toLowerCase()
  return incomeDescriptions.find(([, pattern]) => pattern.test(text))?.[0] ?? 'income'
}

export function inferCategory(transaction: CategoryInput): BuiltinCategory {
  if (transaction.brokerageFunding && transaction.amountMinor < 0) return 'savings'
  if (isExplicitOwnTransfer(transaction)) return 'transfer'
  if (transaction.amountMinor > 0) return inferIncomeCategory(transaction.description)
  const text = transaction.description.normalize('NFKC').toLowerCase()
  const code = transaction.merchantCategoryCode ?? explicitMcc(text)
  const byCode = code ? mccCategories[code] : undefined
  return byCode ?? expenseDescriptions.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other'
}
