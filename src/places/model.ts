import { explicitMcc, isExplicitOwnTransfer, isVtbBrokerageFunding, vtbBrokerageDestination } from '../categories/classify'
import type { Category, CategoryCatalog } from '../categories/catalog'
import type { Transaction } from '../finance'
import { formatNumericDate } from '../shared/format'
import { isCreditRepayment, isSbp, isTransferDescription } from '../statements/transfer'

export interface Place {
  id: string
  name: string
  category: Category
  aliases: string[]
}

export const placeNameLimit = 50
const brokerageDestinationPrefix = 'втб · пополнение брокерского счета · субпозиция '
const brokerageOperationPrefix = 'втб · пополнение брокерского счета · операция '

export class PlaceError extends Error {}

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function nameKey(name: string) {
  return cleanName(name.normalize('NFKC')).toLowerCase().replaceAll('ё', 'е')
}

export function filterPlaces(places: readonly Place[], query: string) {
  const search = nameKey(query)
  return search ? places.filter((place) => nameKey(place.name).includes(search)) : places
}

function normalizeAlias(description: string, merchantCategoryCode?: string) {
  const text = nameKey(description)
  const mcc = merchantCategoryCode && /^\d{4}$/.test(merchantCategoryCode) ? merchantCategoryCode : explicitMcc(text)
  const alias = text
    .replace(/\s*[.,;]?\s*без ндс[.,;]?$/u, '')
    .replace(/(?:\s*\(ap[-– ]\d+\)|\s+(?:mcc|мсс)(?:\s*[-–]?\s*код)?\s*[:#=№-]?\s*\d{4})+\s*$/u, '')
    .replace(/^оплата товаров\s*(?:и|\/)\s*услуг(?:[\s.·,:;–—-]+|$)/u, '')
    .replace(/^[\s.·,:;–—-]+|[\s.·,:;–—-]+$/gu, '')
  if (alias.length < 2 || alias.length > 180 || !/\p{L}/u.test(alias)) return
  if (/^(?:ozon|озон)(?:\s+(?:банк|bank))?$/u.test(alias)
    || /^(?:операция по (?:счету|карте)|оплата(?: картой| покупки)?|покупка|снятие наличных|выдача средств по кредиту|погашение кредита)$/u.test(alias)) return
  // A card processor may report the same name for unrelated expenses in different MCCs.
  return mcc ? `${alias} · mcc ${mcc}` : alias
}

export function isIndividualPlaceAlias(alias: string) {
  return alias.startsWith(brokerageOperationPrefix)
}

export function placeAliasLabel(alias: string) {
  if (isIndividualPlaceAlias(alias)) {
    const date = alias.slice(brokerageOperationPrefix.length, brokerageOperationPrefix.length + 10)
    return `Пополнение брокерского счёта · ${formatNumericDate(date)}`
  }
  if (alias.startsWith(brokerageDestinationPrefix)) {
    return `ВТБ · Брокерская субпозиция № ${alias.slice(brokerageDestinationPrefix.length).toUpperCase()}`
  }
  return alias.replace(' · mcc ', ' · MCC ')
}

export function merchantAlias(row: Transaction, places?: ReadonlyMap<string, Place>) {
  if (row.amountMinor >= 0 || row.category === 'transfer' || row.transferMatchId || row.creditSettlementFor || row.ownPhoneMatch) return
  if (row.bank === 'vtb' && (row.brokerageFunding || isVtbBrokerageFunding(row))) {
    const individual = `${brokerageOperationPrefix}${row.date} ${row.id.toLowerCase()}`
    if (places?.has(individual)) return individual
    const destination = row.brokerageDestination ?? vtbBrokerageDestination(row.description)
    return destination ? brokerageDestinationPrefix + destination : individual
  }
  if (row.sbpCounterparty || row.sbpPhoneToken || isExplicitOwnTransfer(row)
    || isCreditRepayment(row) || isTransferDescription(row.description) || isSbp(row.description)) return
  return normalizeAlias(row.description, row.merchantCategoryCode)
}

export function readPlaces(raw: unknown): Place[] {
  if (!Array.isArray(raw)) return []
  const places: Place[] = []
  const ids = new Set<string>()
  const assigned = new Set<string>()
  for (const place of raw) {
    if (!place || typeof place.id !== 'string' || !place.id || ids.has(place.id) || typeof place.name !== 'string'
      || typeof place.category !== 'string' || place.category === 'transfer' || !Array.isArray(place.aliases)) continue
    const name = cleanName(place.name)
    if (!name || name.length > placeNameLimit) continue
    const aliases: string[] = []
    for (const entry of place.aliases) {
      const alias = typeof entry === 'string' ? normalizeAlias(entry) : undefined
      if (!alias || assigned.has(alias)) continue
      assigned.add(alias)
      aliases.push(alias)
    }
    ids.add(place.id)
    places.push({ id: place.id, name, category: place.category, aliases })
  }
  return places
}

export function indexPlaces(places: readonly Place[]): ReadonlyMap<string, Place> {
  return new Map(places.flatMap((place) => place.aliases.map((alias) => [alias, place] as const)))
}

export function placeForRow(row: Transaction, index: ReadonlyMap<string, Place>) {
  if (!index.size) return
  const alias = merchantAlias(row, index)
  return alias === undefined ? undefined : index.get(alias)
}

export function assignPlace(places: readonly Place[] | undefined, id: string, value: string): Place[] {
  const current = readPlaces(places)
  const alias = normalizeAlias(value)
  const target = current.find((place) => place.id === id)
  if (!target) throw new PlaceError('Место не найдено.')
  if (!alias) throw new PlaceError('В выписке нет отдельного названия места.')
  if (target.aliases.includes(alias)) return current
  return current.map((place) => {
    if (place === target) return { ...place, aliases: [...place.aliases, alias] }
    return place.aliases.includes(alias) ? { ...place, aliases: place.aliases.filter((entry) => entry !== alias) } : place
  })
}

export function unassignPlace(places: readonly Place[] | undefined, value: string): Place[] {
  const alias = normalizeAlias(value)
  return readPlaces(places).map((place) => place.aliases.some((entry) => entry === alias)
    ? { ...place, aliases: place.aliases.filter((entry) => entry !== alias) } : place)
}

export function savePlace(places: readonly Place[] | undefined, catalog: CategoryCatalog, { id, name, category, alias }: {
  id?: string
  name: string
  category: Category
  alias?: string
}): Place[] {
  const current = readPlaces(places)
  const previous = current.find((place) => place.id === id)
  if (id !== undefined && !previous) throw new PlaceError('Место не найдено.')
  const label = cleanName(name)
  if (!label || label.length > placeNameLimit) throw new PlaceError(`Введи название до ${placeNameLimit} символов.`)
  if (current.some((place) => place.id !== id && nameKey(place.name) === nameKey(label))) {
    throw new PlaceError('Место с таким названием уже есть.')
  }
  const definition = catalog.get(category)
  if (definition?.kind !== 'expense' || (definition.archived && previous?.category !== category)) {
    throw new PlaceError('Выбери доступную категорию расходов.')
  }

  const place: Place = { id: id ?? crypto.randomUUID(), name: label, category, aliases: previous ? previous.aliases : [] }
  const next = previous ? current.map((entry) => entry.id === id ? place : entry) : [...current, place]
  return alias === undefined ? next : assignPlace(next, place.id, alias)
}

export function movePlaceAliases(
  places: readonly Place[] | undefined,
  sourceId: string | null,
  aliases: readonly string[],
  targetId: string | null,
): Place[] | undefined {
  if (sourceId === targetId || !aliases.length) return
  const current = readPlaces(places)
  if (targetId !== null && !current.some((place) => place.id === targetId)) return
  const index = indexPlaces(current)
  const selected = new Set(aliases)
  for (const alias of selected) {
    if (normalizeAlias(alias) !== alias || (index.get(alias)?.id ?? null) !== sourceId) return
  }
  return current.map((place) => {
    if (place.id === sourceId) return { ...place, aliases: place.aliases.filter((alias) => !selected.has(alias)) }
    if (place.id === targetId) return { ...place, aliases: [...place.aliases, ...selected] }
    return place
  })
}
