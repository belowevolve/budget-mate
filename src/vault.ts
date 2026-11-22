import {
  DeviceCredentialError, prepareDeviceUnlock as prepareCredential, readDeviceKey,
  type DeviceCredential, type DeviceKeyMode, type DeviceUnlockConfirmation,
} from './deviceCredential'

export { deviceUnlockAvailable } from './deviceCredential'
export type { DeviceKeyMode, DeviceUnlockConfirmation } from './deviceCredential'

const databaseName = 'spending-vault'
const storeName = 'vault'
const recordId = 'local'
const passwordIterations = 600_000
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
const backupMagic = encoder.encode('budgetmate-vault-v1\n')
const backupRevisionSize = 8
const backupSaltSize = 16
const backupIvSize = 12
const backupHeaderSize = backupMagic.length + backupRevisionSize + backupSaltSize + backupIvSize
const maxBackupBytes = 64 * 1024 * 1024

type VaultErrorCode =
  | 'unavailable'
  | 'exists'
  | 'missing'
  | 'password'
  | 'device'
  | 'conflict'
  | 'corrupt'
  | 'storage'

export class VaultError extends Error {
  readonly code: VaultErrorCode

  constructor(code: VaultErrorCode, message: string) {
    super(message)
    this.name = 'VaultError'
    this.code = code
  }
}

interface Ciphertext {
  iv: ArrayBuffer
  ciphertext: ArrayBuffer
}

interface LegacyVault extends Ciphertext {
  version: 1
  revision: number
  salt: ArrayBuffer
}

interface PasswordSlot extends Ciphertext {
  salt: ArrayBuffer
}

interface RecoveryPassword {
  key: CryptoKey
  salt: ArrayBuffer
}

interface DeviceSlot extends Ciphertext, DeviceCredential {}

interface DeviceVault extends Ciphertext {
  version: 2
  revision: number
  id: ArrayBuffer
  password?: PasswordSlot
  device: DeviceSlot
}

type VaultRecord = LegacyVault | DeviceVault

export interface VaultSession<T> {
  readonly data: T
  readonly canExportPasswordVault: boolean
  readonly canReplaceDeviceUnlock: boolean
  save(data: T): Promise<void>
  enableDeviceUnlock(confirmation: DeviceUnlockConfirmation, signal?: AbortSignal): Promise<void>
  replaceDeviceUnlock(confirmation: DeviceUnlockConfirmation, signal?: AbortSignal): Promise<void>
  exportPasswordVault(): Blob
}

export interface VaultUnlockMethods {
  password: boolean
  device: boolean
  deviceMode?: DeviceKeyMode
}

function requireVaultSupport(): void {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) {
    throw new VaultError('unavailable', 'Для хранилища нужен современный браузер и HTTPS или localhost.')
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    let blocked = false

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      blocked = true
      reject(new VaultError('storage', 'Закройте другие вкладки приложения и повторите попытку.'))
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      if (blocked) database.close()
      else resolve(database)
    }
  })
}

async function withDatabase<T>(readOrWrite: (database: IDBDatabase) => Promise<T>): Promise<T> {
  requireVaultSupport()
  let database: IDBDatabase | undefined

  try {
    database = await openDatabase()
    return await readOrWrite(database)
  } catch (error) {
    if (error instanceof VaultError) throw error
    throw new VaultError('storage', 'Браузер не смог прочитать или сохранить хранилище.')
  } finally {
    database?.close()
  }
}

function readRecord(): Promise<unknown> {
  return withDatabase((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName)
    const request = transaction.objectStore(storeName).get(recordId)
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () => reject(transaction.error)
  }))
}

function isBuffer(value: unknown, size: number): value is ArrayBuffer {
  return value instanceof ArrayBuffer && value.byteLength === size
}

function isKeySlot(value: unknown): value is Ciphertext {
  if (!value || typeof value !== 'object') return false
  const slot = value as Partial<Ciphertext>
  return isBuffer(slot.iv, 12) && isBuffer(slot.ciphertext, 48)
}

function isDeviceSlot(value: unknown): value is DeviceSlot {
  if (!isKeySlot(value)) return false
  const slot = value as Partial<DeviceSlot>
  return slot.credentialId instanceof ArrayBuffer && slot.credentialId.byteLength > 0 && slot.credentialId.byteLength <= 1023 &&
    isBuffer(slot.prfSalt, 32) && typeof slot.origin === 'string' &&
    (slot.mode === undefined || slot.mode === 'platform' || slot.mode === 'security-key')
}

function isPasswordSlot(value: unknown): value is PasswordSlot {
  return isKeySlot(value) && isBuffer((value as Partial<PasswordSlot>).salt, 16)
}

function isVaultRecord(value: unknown): value is VaultRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<VaultRecord>

  if (typeof record.revision !== 'number' || !Number.isSafeInteger(record.revision) || record.revision < 0 ||
      !isBuffer(record.iv, 12) || !(record.ciphertext instanceof ArrayBuffer) || record.ciphertext.byteLength < 16) {
    return false
  }

  if (record.version === 1) return isBuffer(record.salt, 16)
  return record.version === 2 && isBuffer(record.id, 16) &&
    isDeviceSlot(record.device) && (record.password === undefined || isPasswordSlot(record.password))
}

function sameIdentity(first: VaultRecord, second: VaultRecord): boolean {
  if (first.version !== second.version) return false
  const firstId = new Uint8Array(first.version === 1 ? first.salt : first.id)
  const secondId = new Uint8Array(second.version === 1 ? second.salt : second.id)
  return firstId.every((byte, index) => byte === secondId[index])
}

function writeRecord(record: VaultRecord, previous?: VaultRecord): Promise<void> {
  return withDatabase((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.get(recordId)
    let error: VaultError | undefined

    request.onsuccess = () => {
      const latest: unknown = request.result
      if (previous === undefined) {
        if (latest !== undefined) {
          error = new VaultError('exists', 'Локальное хранилище уже создано. Откройте его на экране входа.')
        }
      } else if (!isVaultRecord(latest) || latest.revision !== previous.revision || !sameIdentity(latest, previous)) {
        error = new VaultError('conflict', 'Хранилище изменилось в другой вкладке. Заблокируйте и откройте его заново.')
      }

      if (error) transaction.abort()
      else store.put(record, recordId)
    }
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(error ?? transaction.error)
  }))
}

async function getVaultRecord(): Promise<VaultRecord | undefined> {
  const record = await readRecord()
  if (record !== undefined && !isVaultRecord(record)) {
    throw new VaultError('corrupt', 'Не удалось прочитать формат хранилища.')
  }
  return record
}

async function requireVaultRecord(): Promise<VaultRecord> {
  const record = await getVaultRecord()
  if (!record) throw new VaultError('missing', 'Локальное хранилище ещё не создано.')
  return record
}

async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const passwordBytes = encoder.encode(password)

  try {
    const material = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey'])
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: passwordIterations },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  } finally {
    passwordBytes.fill(0)
  }
}

function vaultContext(id: ArrayBuffer, use: string): Uint8Array<ArrayBuffer> {
  const label = encoder.encode(databaseName + ':2:' + use + ':')
  const context = new Uint8Array(label.length + id.byteLength)
  context.set(label)
  context.set(new Uint8Array(id), label.length)
  return context
}

function payloadContext(record: Pick<LegacyVault, 'version' | 'revision'> | Pick<DeviceVault, 'version' | 'revision' | 'id'>): Uint8Array<ArrayBuffer> {
  return record.version === 1
    ? encoder.encode(databaseName + ':1:' + record.revision)
    : vaultContext(record.id, 'data:' + record.revision)
}

async function encryptBytes(key: CryptoKey, plaintext: BufferSource, additionalData: BufferSource): Promise<Ciphertext> {
  const iv = crypto.getRandomValues(new Uint8Array(12)).buffer
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, plaintext)
  return { iv, ciphertext }
}

function decryptBytes(key: CryptoKey, encrypted: Ciphertext, additionalData: BufferSource): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: encrypted.iv, additionalData }, key, encrypted.ciphertext)
}

async function encryptData<T>(
  data: T,
  key: CryptoKey,
  record: Parameters<typeof payloadContext>[0],
): Promise<Ciphertext> {
  const json = JSON.stringify(data)
  if (json === undefined) throw new VaultError('storage', 'Эти данные нельзя сохранить в хранилище.')
  const plaintext = encoder.encode(json)

  try {
    return await encryptBytes(key, plaintext, payloadContext(record))
  } finally {
    plaintext.fill(0)
  }
}

async function openSession<T>(
  key: CryptoKey,
  record: VaultRecord,
  errorCode: 'password' | 'device' | 'corrupt',
  password?: RecoveryPassword,
): Promise<VaultSession<T>> {
  let plaintext: ArrayBuffer
  try {
    plaintext = await decryptBytes(key, record, payloadContext(record))
  } catch {
    throw new VaultError(
      errorCode,
      errorCode === 'password' ? 'Пароль не подошёл или хранилище повреждено.' : 'Не удалось расшифровать хранилище.',
    )
  }

  try {
    return vaultSession(key, JSON.parse(decoder.decode(plaintext)) as T, record, password)
  } catch {
    throw new VaultError('corrupt', 'Не удалось прочитать данные хранилища.')
  } finally {
    new Uint8Array(plaintext).fill(0)
  }
}

async function performDeviceRequest<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request()
  } catch (error) {
    if (error instanceof DeviceCredentialError) throw new VaultError('device', error.message)
    throw error
  }
}

export function prepareDeviceUnlock(mode: DeviceKeyMode, signal?: AbortSignal): Promise<DeviceUnlockConfirmation> {
  return performDeviceRequest(() => prepareCredential(mode, signal))
}

async function buildDeviceVault<T>(
  data: T,
  revision: number,
  registration: Awaited<ReturnType<DeviceUnlockConfirmation['confirm']>>,
  password?: RecoveryPassword,
): Promise<{ record: DeviceVault; dataKey: CryptoKey }> {
  const id = crypto.getRandomValues(new Uint8Array(16)).buffer
  const keyBytes = crypto.getRandomValues(new Uint8Array(32))

  try {
    const header = { version: 2 as const, revision, id }
    const dataKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
    const deviceKeySlot = await encryptBytes(registration.key, keyBytes, vaultContext(id, 'device-key'))
    const passwordKeySlot = password
      ? { salt: password.salt, ...await encryptBytes(password.key, keyBytes, vaultContext(id, 'password-key')) }
      : undefined
    const encrypted = await encryptData(data, dataKey, header)
    const record: DeviceVault = {
      ...header,
      ...encrypted,
      device: { ...registration.credential, ...deviceKeySlot },
      password: passwordKeySlot,
    }
    return { record, dataKey }
  } finally {
    keyBytes.fill(0)
  }
}

async function unwrapKey(
  key: CryptoKey,
  record: DeviceVault,
  method: 'device' | 'password',
): Promise<CryptoKey> {
  const slot = record[method]
  if (!slot) throw new VaultError(method, 'Этот способ открытия хранилища не настроен.')

  let master: ArrayBuffer
  try {
    master = await decryptBytes(key, slot, vaultContext(record.id, method + '-key'))
  } catch {
    throw new VaultError(method, method === 'password'
      ? 'Пароль не подошёл или хранилище повреждено.'
      : 'Ключ устройства не подошёл или хранилище повреждено.')
  }

  try {
    if (master.byteLength !== 32) throw new VaultError('corrupt', 'Не удалось прочитать ключ хранилища.')
    return await crypto.subtle.importKey('raw', master, 'AES-GCM', false, ['encrypt', 'decrypt'])
  } finally {
    new Uint8Array(master).fill(0)
  }
}

function vaultSession<T>(
  initialKey: CryptoKey,
  initialData: T,
  record: VaultRecord,
  recoveryPassword?: RecoveryPassword,
): VaultSession<T> {
  let data = initialData
  let key = initialKey
  let current = record
  let password = recoveryPassword

  async function configureDeviceUnlock(previous: VaultRecord, confirmation: DeviceUnlockConfirmation, signal?: AbortSignal) {
    const nextPassword = previous.version === 1 ? { salt: previous.salt, key } : password
    const registration = await performDeviceRequest(() => confirmation.confirm(signal))
    const next = await buildDeviceVault(data, previous.revision + 1, registration, nextPassword)
    signal?.throwIfAborted()
    await writeRecord(next.record, previous)
    current = next.record
    key = next.dataKey
    password = nextPassword
  }

  return {
    get data() {
      return data
    },
    get canExportPasswordVault() {
      return current.version === 1
    },
    get canReplaceDeviceUnlock() {
      return current.version === 2 && (!current.password || !!password)
    },
    async save(nextData: T) {
      const previous = current
      const header = { ...previous, revision: previous.revision + 1 }
      const next = { ...header, ...await encryptData(nextData, key, header) }
      await writeRecord(next, previous)
      current = next
      data = nextData
    },
    async enableDeviceUnlock(confirmation: DeviceUnlockConfirmation, signal?: AbortSignal) {
      const previous = current
      if (previous.version === 2) return
      await configureDeviceUnlock(previous, confirmation, signal)
    },
    async replaceDeviceUnlock(confirmation: DeviceUnlockConfirmation, signal?: AbortSignal) {
      const previous = current
      if (previous.version === 1) throw new VaultError('device', 'Для замены сначала настрой ключ доступа.')
      if (previous.password && !password) {
        throw new VaultError('device', 'Открой хранилище прежним паролем, чтобы сохранить пароль при замене ключа.')
      }
      await configureDeviceUnlock(previous, confirmation, signal)
    },
    exportPasswordVault() {
      if (current.version !== 1) {
        throw new VaultError('storage', 'Файл переноса доступен для хранилища, которое открывается только паролем.')
      }
      if (backupHeaderSize + current.ciphertext.byteLength > maxBackupBytes) {
        throw new VaultError('storage', 'Хранилище слишком большое для переноса одним файлом.')
      }
      const revision = new ArrayBuffer(backupRevisionSize)
      new DataView(revision).setBigUint64(0, BigInt(current.revision))
      return new Blob([backupMagic, revision, current.salt, current.iv, current.ciphertext], { type: 'application/octet-stream' })
    },
  }
}

export async function restorePasswordVault<T>(
  file: File,
  password: string,
  validate: (data: T) => boolean,
): Promise<VaultSession<T>> {
  requireVaultSupport()
  if (file.size > maxBackupBytes || file.size < backupHeaderSize + 16) {
    throw new VaultError('corrupt', 'Этот файл переноса пуст, повреждён или больше 64 МБ.')
  }

  let bytes: ArrayBuffer
  try {
    bytes = await file.arrayBuffer()
  } catch {
    throw new VaultError('storage', 'Не удалось прочитать файл переноса.')
  }
  const magic = new Uint8Array(bytes, 0, backupMagic.length)
  const revision = Number(new DataView(bytes).getBigUint64(backupMagic.length))
  if (!Number.isSafeInteger(revision) || !magic.every((byte, index) => byte === backupMagic[index])) {
    throw new VaultError('corrupt', 'Не удалось распознать формат файла переноса.')
  }

  const saltStart = backupMagic.length + backupRevisionSize
  const ivStart = saltStart + backupSaltSize
  const record: LegacyVault = {
    version: 1,
    revision,
    salt: bytes.slice(saltStart, ivStart),
    iv: bytes.slice(ivStart, backupHeaderSize),
    ciphertext: bytes.slice(backupHeaderSize),
  }
  const session = await openSession<T>(await deriveKey(password, record.salt), record, 'password')
  let valid = false
  try {
    valid = validate(session.data)
  } catch {
    // A payload may decrypt successfully and still contain an unsupported data format.
  }
  if (!valid) throw new VaultError('corrupt', 'Файл переноса содержит данные в неизвестном формате.')
  await writeRecord(record)
  return session
}

export async function vaultUnlockMethods(): Promise<VaultUnlockMethods | null> {
  const record = await getVaultRecord()
  if (!record) return null
  return record.version === 1
    ? { password: true, device: false }
    : { password: !!record.password, device: true, deviceMode: record.device.mode ?? 'platform' }
}

export async function unlockVault<T>(password: string): Promise<VaultSession<T>> {
  const record = await requireVaultRecord()
  if (record.version === 1) return openSession(await deriveKey(password, record.salt), record, 'password')
  if (!record.password) throw new VaultError('password', 'Для этого хранилища настроен вход с устройства.')
  const salt = record.password.salt
  const passwordKey = await deriveKey(password, salt)
  return openSession(await unwrapKey(passwordKey, record, 'password'), record, 'corrupt', { salt, key: passwordKey })
}

export async function createDeviceVault<T>(
  initialData: T,
  confirmation: DeviceUnlockConfirmation,
  signal?: AbortSignal,
): Promise<VaultSession<T>> {
  requireVaultSupport()
  const registration = await performDeviceRequest(() => confirmation.confirm(signal))
  const { record, dataKey } = await buildDeviceVault(initialData, 0, registration)
  signal?.throwIfAborted()
  await writeRecord(record)
  return vaultSession(dataKey, initialData, record)
}

export async function unlockDeviceVault<T>(signal?: AbortSignal): Promise<VaultSession<T>> {
  const record = await requireVaultRecord()
  if (record.version === 1) throw new VaultError('device', 'Для этого хранилища вход с устройства ещё не настроен.')
  const wrappingKey = await performDeviceRequest(() => readDeviceKey(record.device, signal))
  signal?.throwIfAborted()
  return openSession(await unwrapKey(wrappingKey, record, 'device'), record, 'corrupt')
}
