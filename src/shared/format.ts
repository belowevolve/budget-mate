const russianPlural = new Intl.PluralRules('ru-RU')

export function pluralRu(count: number, one: string, few: string, many: string) {
  const form = russianPlural.select(count)
  return form === 'one' ? one : form === 'few' ? few : many
}
