export type CategoryKind = 'expense' | 'income'
export type CategoryTone = 'groceries' | 'dining' | 'shopping' | 'transport' | 'home' | 'health' | 'other' | 'income' | 'transfer'

export const categories = {
  groceries: { label: 'Продукты и хозтовары', kind: 'expense', tone: 'groceries' },
  dining: { label: 'Кафе, рестораны и доставка', kind: 'expense', tone: 'dining' },
  health: { label: 'Здоровье и спорт', kind: 'expense', tone: 'health' },
  clothes: { label: 'Одежда и обувь', kind: 'expense', tone: 'shopping' },
  transport: { label: 'Транспорт', kind: 'expense', tone: 'transport' },
  gifts: { label: 'Подарки', kind: 'expense', tone: 'shopping' },
  shopping: { label: 'Покупки и развлечения', kind: 'expense', tone: 'shopping' },
  subscriptions: { label: 'Подписки и связь', kind: 'expense', tone: 'transport' },
  home: { label: 'Жильё и коммунальные', kind: 'expense', tone: 'home' },
  savings: { label: 'Накопления и вклады', kind: 'expense', tone: 'home' },
  social: { label: 'Встречи и вечеринки', kind: 'expense', tone: 'dining' },
  fees: { label: 'Комиссии', kind: 'expense', tone: 'other' },
  other: { label: 'Прочее', kind: 'expense', tone: 'other' },
  salary: { label: 'Зарплата', kind: 'income', tone: 'income' },
  cashback: { label: 'Кешбэк', kind: 'income', tone: 'income' },
  interest: { label: 'Проценты по вкладам', kind: 'income', tone: 'income' },
  sale: { label: 'Продажа вещей', kind: 'income', tone: 'income' },
  withdrawal: { label: 'Вывод средств', kind: 'income', tone: 'income' },
  income: { label: 'Другие поступления', kind: 'income', tone: 'income' },
  transfer: { label: 'Свои переводы', kind: 'transfer', tone: 'transfer' },
} as const satisfies Record<string, { label: string; kind: CategoryKind | 'transfer'; tone: CategoryTone }>

export type BuiltinCategory = keyof typeof categories
export type Category = BuiltinCategory | `user:${string}`
export type CategoryAppearance = Pick<CategoryDefinition, 'icon' | 'tone'>

export const categoryIconLabels = {
  ...Object.fromEntries(Object.entries(categories).map(([id, { label }]) => [id, label])) as Record<BuiltinCategory, string>,
  utensils: 'Еда',
  car: 'Автомобиль',
  fuel: 'Топливо',
  plane: 'Путешествия',
  study: 'Образование',
  tools: 'Ремонт',
  pets: 'Животные',
  games: 'Игры',
  electronics: 'Техника',
}

export type CategoryIconId = keyof typeof categoryIconLabels

export const categoryPalette = {
  groceries: 'Зелёный', dining: 'Сиреневый', shopping: 'Песочный', transport: 'Голубой',
  home: 'Розовый', health: 'Золотистый', other: 'Серый', transfer: 'Сине-серый',
} satisfies Record<Exclude<CategoryTone, 'income'>, string>

export interface CategoryOverride {
  id: Exclude<Category, 'transfer'>
  label: string
  kind: CategoryKind
  archived?: boolean
  icon?: CategoryIconId
  tone?: CategoryTone
}

export interface CategoryDefinition {
  label: string
  kind: CategoryKind | 'transfer'
  tone: CategoryTone
  icon: CategoryIconId
  archived?: boolean
}

export type CategoryCatalog = ReadonlyMap<Category, CategoryDefinition>

const builtinCatalog = new Map(
  (Object.keys(categories) as BuiltinCategory[]).map((id) => [id, { ...categories[id], icon: id }]),
)

export function kindForAmount(amountMinor: number): CategoryKind {
  return amountMinor > 0 ? 'income' : 'expense'
}

export function fallbackCategory(kind: CategoryKind) {
  return kind === 'income' ? 'income' : 'other'
}

export function canArchiveCategory(id: Category) {
  return id !== 'income' && id !== 'other' && id !== 'transfer'
}

export function categoryCatalog(overrides?: CategoryOverride[]): CategoryCatalog {
  if (!Array.isArray(overrides) || !overrides.length) return builtinCatalog
  const catalog = new Map<Category, CategoryDefinition>(builtinCatalog)
  for (const override of overrides) {
    if (!override || typeof override.id !== 'string' || typeof override.label !== 'string'
      || (override.kind !== 'income' && override.kind !== 'expense')) continue
    const { id, kind } = override
    const label = override.label.trim().slice(0, 40)
    if (!label) continue
    const builtin = builtinCatalog.get(id as BuiltinCategory)
    if (builtin ? builtin.kind !== kind : !id.startsWith('user:')) continue
    const archived = override.archived === true && canArchiveCategory(id)
    const fallback = fallbackCategory(kind)
    const defaultAppearance = builtin ?? { kind, tone: fallback, icon: fallback }
    const icon = override.icon && Object.hasOwn(categoryIconLabels, override.icon) ? override.icon : defaultAppearance.icon
    const tone = override.tone && (override.tone === 'income' || Object.hasOwn(categoryPalette, override.tone))
      ? override.tone : defaultAppearance.tone
    catalog.set(id, { kind, label, archived, icon, tone })
  }
  return catalog
}

export const defaultCategoryCatalog = categoryCatalog()

export function categoryDefinition(catalog: CategoryCatalog, id: Category, kind: CategoryKind = 'expense'): CategoryDefinition {
  const fallback = fallbackCategory(kind)
  return catalog.get(id) ?? catalog.get(fallback) ?? { ...categories[fallback], icon: fallback }
}

export function categoryOptions(catalog: CategoryCatalog, kind: CategoryKind, selected?: Category) {
  return [...catalog].flatMap(([value, definition]) => definition.kind === kind
    && (!definition.archived || value === selected) ? [{ value, label: definition.label }] : [])
}

export const categoryLabelLimit = 40

export class CategoryError extends Error {}

export function editCategory(
  overrides: CategoryOverride[] | undefined,
  id: Exclude<Category, 'transfer'>,
  kind: CategoryKind,
  label: string,
  archived?: boolean,
  appearance?: CategoryAppearance,
): CategoryOverride[] {
  const catalog = categoryCatalog(overrides)
  const current = catalog.get(id)
  if (current ? current.kind !== kind : !id.startsWith('user:')) {
    throw new CategoryError('Категория недоступна.')
  }
  const name = label.trim().replace(/\s+/g, ' ')
  if (!name || name.length > categoryLabelLimit) throw new CategoryError('Введи название до 40 символов.')
  for (const [otherId, definition] of catalog) {
    if (otherId !== id && definition.kind === kind
      && definition.label.localeCompare(name, 'ru', { sensitivity: 'accent' }) === 0) {
      throw new CategoryError('Категория с таким названием уже есть.')
    }
  }
  return [
    ...(Array.isArray(overrides) ? overrides.filter((entry) => entry?.id !== id) : []),
    {
      id, label: name, kind, archived: canArchiveCategory(id) && (archived ?? current?.archived ?? false),
      icon: appearance?.icon ?? current?.icon, tone: appearance?.tone ?? current?.tone,
    },
  ]
}
