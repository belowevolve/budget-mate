export function normalizeSearch(text: string) {
  return text.normalize('NFC').toLowerCase().replaceAll('ё', 'е')
}

export function parseOperationSearch(query: string) {
  const text = normalizeSearch(query.trim())
  const amount = text.replace(/[\s₽]/g, '').replace(',', '.').replace(/^[-+−]/, '')
  return { text, amount: /^\d+(?:\.\d{0,2})?$/.test(amount) ? amount : undefined }
}
