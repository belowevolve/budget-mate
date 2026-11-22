const encoder = new TextEncoder()

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function normalizeSbpPhone(input: string): string | undefined {
  const text = input.trim()
  if (!/^\+?[\d\s().-]+$/.test(text)) return
  const digits = text.replace(/\D/g, '')
  if (digits.length === 10 && !text.startsWith('+')) return `+7${digits}`
  if (digits.length === 11 && /^[78]/.test(digits)) return `+7${digits.slice(1)}`
}

export function createSbpKey() {
  return hex(crypto.getRandomValues(new Uint8Array(32)))
}

export async function createSbpTokenizer(key: string) {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('Не удалось прочитать ключ сверки СБП.')
  const bytes = new Uint8Array(32)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(key.slice(i * 2, i * 2 + 2), 16)
  let signingKey: CryptoKey
  try {
    signingKey = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  } finally {
    bytes.fill(0)
  }
  return async (normalizedPhone: string) => {
    const digest = await crypto.subtle.sign('HMAC', signingKey, encoder.encode(`budgetmate:sbp-phone:v1:${normalizedPhone}`))
    return hex(new Uint8Array(digest))
  }
}
