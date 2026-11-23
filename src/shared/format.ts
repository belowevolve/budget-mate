const locale = 'ru-RU'
const russianPlural = new Intl.PluralRules(locale)
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

const dateFormatter = utcDateFormatter({ day: 'numeric', month: 'short', year: 'numeric' })
const dayFormatter = utcDateFormatter({ weekday: 'short', day: 'numeric', month: 'short' })
const dayRangeFormatter = utcDateFormatter({ day: 'numeric', month: 'long' })
const monthAbbreviationFormatter = utcDateFormatter({ month: 'short' })

function utcDateFormatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
}

function dateAtUtcMidnight(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`)
}

export function formatDate(date: string) {
  return dateFormatter.format(dateAtUtcMidnight(date))
}

export function formatDayHeading(date: string, currentYear: number) {
  const day = dayFormatter.format(dateAtUtcMidnight(date))
  const year = date.slice(0, 4)
  return year === String(currentYear) ? day : `${day} ${year}`
}

export function formatDayRange(start: Date, end: Date) {
  return dayRangeFormatter.formatRange(start, end)
}

export function formatMonthAbbreviation(date: Date) {
  return monthAbbreviationFormatter.format(date).replace('.', '')
}

export function formatMonth(month: string) {
  if (!month) return 'Весь период'
  const [year, number] = month.split('-')
  return `${months[Number(number) - 1]} ${year}`
}

export function formatNumericDate(date: string) {
  return date.split('-').reverse().join('.')
}

export function pluralRu(count: number, one: string, few: string, many: string) {
  const form = russianPlural.select(count)
  return form === 'one' ? one : form === 'few' ? few : many
}
