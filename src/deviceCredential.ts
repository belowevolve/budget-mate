const requestTimeout = 60_000
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
const securityKeyTransports: AuthenticatorTransport[] = ['usb', 'nfc', 'ble']

export type DeviceKeyMode = 'platform' | 'security-key'

export interface DeviceCredential {
  credentialId: ArrayBuffer
  prfSalt: ArrayBuffer
  origin: string
  mode?: DeviceKeyMode
}

interface RegisteredDeviceCredential {
  credential: DeviceCredential
  key: CryptoKey
}

export interface DeviceUnlockConfirmation {
  confirm(signal?: AbortSignal): Promise<RegisteredDeviceCredential>
}

export class DeviceCredentialError extends Error {}

function canRequestCredential(): boolean {
  const host = globalThis.location?.hostname
  return globalThis.isSecureContext && !!host && !/^(?:[\d.]+|\[.*\])$/.test(host) &&
    typeof PublicKeyCredential !== 'undefined' && !!navigator.credentials
}

export async function deviceUnlockAvailable(mode: DeviceKeyMode = 'platform'): Promise<boolean> {
  if (!canRequestCredential()) return false
  try {
    if (typeof PublicKeyCredential.getClientCapabilities === 'function') {
      const capabilities = await PublicKeyCredential.getClientCapabilities().catch(() => null)
      if (capabilities?.['extension:prf'] === false) return false
    }
    return mode === 'security-key' || await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

function requireCredentialSupport(): void {
  if (!canRequestCredential()) {
    throw new DeviceCredentialError('Открой budgetmate на localhost или HTTPS-домене в браузере с поддержкой ключей доступа.')
  }
}

function base64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function equalBytes(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((byte, index) => byte === second[index])
}

function credentialHint(mode: DeviceKeyMode): { hints: string[] } {
  return { hints: [mode === 'security-key' ? 'security-key' : 'client-device'] }
}

function verifyClientData(response: AuthenticatorResponse, type: 'webauthn.create' | 'webauthn.get', challenge: ArrayBuffer): void {
  let client: { type?: unknown; origin?: unknown; challenge?: unknown; crossOrigin?: unknown } | undefined
  try {
    client = JSON.parse(decoder.decode(response.clientDataJSON))
  } catch {
    // Invalid browser responses are rejected below.
  }
  if (!client || client.type !== type || client.origin !== location.origin ||
      client.challenge !== base64Url(challenge) || client.crossOrigin === true) {
    throw new DeviceCredentialError('Получен ответ от другого приложения или сеанса. Повтори вход.')
  }
}

async function requestCredential(
  request: () => Promise<Credential | null>,
  action: 'create' | 'get',
  mode: DeviceKeyMode,
): Promise<PublicKeyCredential> {
  const label = action === 'create' ? 'Создание ключа' : 'Подтверждение ключа'
  let result: Credential | null
  try {
    result = await request()
  } catch (error) {
    if (error instanceof DOMException) {
      if (['AbortError', 'NotAllowedError'].includes(error.name)) {
        throw new DeviceCredentialError(`${label} отменено, истекло по времени или недоступно у выбранного провайдера.`)
      }
      if (error.name === 'SecurityError') {
        throw new DeviceCredentialError('Браузер запретил ключ для этого адреса. Открой budgetmate на localhost или HTTPS-домене отдельной вкладкой.')
      }
      if (error.name === 'NotSupportedError') {
        throw new DeviceCredentialError('Браузер или провайдер не поддерживает параметры ключа. Выбери совместимый ключ с WebAuthn PRF.')
      }
    }
    throw new DeviceCredentialError(`${label} завершилось ошибкой браузера. Попробуй снова.`)
  }
  if (!(result instanceof PublicKeyCredential)) {
    throw new DeviceCredentialError(`${label} не вернуло ключ доступа.`)
  }
  if (mode === 'platform' && result.authenticatorAttachment === 'cross-platform') {
    throw new DeviceCredentialError('Выбери ключ доступа в менеджере этого устройства.')
  }
  if (mode === 'security-key' && result.authenticatorAttachment === 'platform') {
    throw new DeviceCredentialError('Выбери аппаратный ключ FIDO2 в диалоге браузера.')
  }
  return result
}

export async function prepareDeviceUnlock(
  mode: DeviceKeyMode = 'platform',
  signal?: AbortSignal,
): Promise<DeviceUnlockConfirmation> {
  requireCredentialSupport()
  const challenge = crypto.getRandomValues(new Uint8Array(32)).buffer
  const userId = crypto.getRandomValues(new Uint8Array(32)).buffer
  const result = await requestCredential(() => navigator.credentials.create({
    signal,
    publicKey: {
      challenge,
      rp: { id: location.hostname, name: 'budgetmate' },
      user: { id: userId, name: 'budgetmate', displayName: 'Хранилище budgetmate' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: mode === 'security-key' ? 'cross-platform' : 'platform',
        residentKey: mode === 'security-key' ? 'discouraged' : 'preferred',
        userVerification: 'required',
      },
      ...credentialHint(mode),
      attestation: 'none',
      timeout: requestTimeout,
      extensions: { prf: {} },
    },
  }), 'create', mode)
  verifyClientData(result.response, 'webauthn.create', challenge)
  if (result.getClientExtensionResults().prf?.enabled === false) {
    throw new DeviceCredentialError('Выбранный ключ не поддерживает шифрование WebAuthn PRF. Выбери другой ключ или провайдер.')
  }
  if (mode === 'security-key') {
    const transports = (result.response as AuthenticatorAttestationResponse).getTransports?.() ?? []
    if (!securityKeyTransports.some((transport) => transports.includes(transport))) {
      throw new DeviceCredentialError('Браузер не подтвердил USB, NFC или Bluetooth-ключ FIDO2.')
    }
  }

  const credential: DeviceCredential = {
    credentialId: result.rawId,
    prfSalt: crypto.getRandomValues(new Uint8Array(32)).buffer,
    origin: location.origin,
    mode,
  }
  return {
    async confirm(confirmationSignal) {
      return { credential, key: await readDeviceKey(credential, confirmationSignal) }
    },
  }
}

export async function readDeviceKey(credential: DeviceCredential, signal?: AbortSignal): Promise<CryptoKey> {
  requireCredentialSupport()
  if (credential.origin !== location.origin) {
    throw new DeviceCredentialError('Этот ключ доступа создан для другого адреса приложения.')
  }

  const mode = credential.mode ?? 'platform'
  const challenge = crypto.getRandomValues(new Uint8Array(32)).buffer
  const transports: AuthenticatorTransport[] = mode === 'security-key' ? securityKeyTransports : ['internal']
  const result = await requestCredential(() => navigator.credentials.get({
    signal,
    publicKey: {
      challenge,
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: credential.credentialId, transports }],
      ...credentialHint(mode),
      userVerification: 'required',
      timeout: requestTimeout,
      extensions: { prf: { eval: { first: credential.prfSalt } } },
    },
  }), 'get', mode)
  verifyClientData(result.response, 'webauthn.get', challenge)

  if (!(result.response instanceof AuthenticatorAssertionResponse) ||
      !equalBytes(new Uint8Array(result.rawId), new Uint8Array(credential.credentialId))) {
    throw new DeviceCredentialError('Устройство вернуло другой ключ доступа.')
  }

  const authenticatorData = new Uint8Array(result.response.authenticatorData)
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(location.hostname)))
  const userPresentAndVerified = 0x01 | 0x04
  if (authenticatorData.length < 37 || (authenticatorData[32] & userPresentAndVerified) !== userPresentAndVerified ||
      !equalBytes(authenticatorData.subarray(0, 32), rpHash)) {
    throw new DeviceCredentialError('Устройство не подтвердило владельца хранилища.')
  }
  const backupEligible = 0x08
  if (mode === 'security-key' && (authenticatorData[32] & backupEligible) !== 0) {
    throw new DeviceCredentialError('Выбранный ключ допускает синхронизацию. Для этого способа нужен аппаратный ключ FIDO2.')
  }

  const secret = result.getClientExtensionResults().prf?.results?.first
  if (!secret || secret.byteLength !== 32) {
    throw new DeviceCredentialError('Провайдер ключа не вернул ключ шифрования WebAuthn PRF. Выбери другой способ хранения ключа.')
  }

  const secretBytes = secret instanceof ArrayBuffer
    ? new Uint8Array(secret)
    : new Uint8Array(secret.buffer, secret.byteOffset, secret.byteLength)
  try {
    return await crypto.subtle.importKey('raw', secretBytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
  } finally {
    secretBytes.fill(0)
  }
}
