import { abortVar, action, atom, computed, isAbort, withAbort, withAsync, withConnectHook, wrap } from '@reatom/core'
import { emptyLedger, ensureSbpKey, reconcileLedger, type Ledger } from '../finance'
import {
  createDeviceVault, deviceUnlockAvailable, readPasswordBackup, restorePasswordVault, unlockDeviceVault, unlockVault,
  vaultUnlockMethods, VaultError, type DeviceUnlockConfirmation, type VaultSession, type VaultUnlockMethods,
} from '../vault'

type ClosedScreen =
  | { kind: 'loading' | 'setup' }
  | { kind: 'locked'; methods: VaultUnlockMethods; atLaunch?: true }
  | { kind: 'unavailable'; message: string }

type OpenScreen = { kind: 'open'; ledger: Ledger; methods: VaultUnlockMethods; canReplaceKey: boolean; restoreVersion: number }
type LedgerUpdate<T> = (ledger: Ledger) => { ledger: Ledger; result: T } | Promise<{ ledger: Ledger; result: T }>
export type VaultWrite = <T>(update: LedgerUpdate<T>) => Promise<T>

const idleTimeout = 5 * 60_000

export function messageFor(error: unknown, fallback: string) {
  return error instanceof VaultError ? error.message : fallback
}

function isLedger(data: Ledger) {
  return data?.version === 1 && Array.isArray(data.transactions) && Array.isArray(data.imports) && Array.isArray(data.credits)
}

export function reatomVault() {
  const closed = atom<ClosedScreen>({ kind: 'loading' }, 'vault.access')
  const unlocked = atom<OpenScreen | null>(null, 'vault.unlocked')
  const supported = atom<boolean | undefined>(undefined, 'vault.deviceSupported')
  const screen = computed(() => unlocked() ?? closed(), 'vault.screen')

  let session: VaultSession<Ledger> | null = null
  let writing = false
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let lastActivity = 0

  const lock = action(() => {
    session = null
    open.abort()
    enableDevice.abort()
    clearTimeout(idleTimer)
    unlocked.set(null)
  }, 'vault.lock')

  function checkActivity() {
    clearTimeout(idleTimer)
    if (!session) return
    const left = idleTimeout - (Date.now() - lastActivity)
    if (left <= 0) lock()
    else idleTimer = setTimeout(wrap(checkActivity), left)
  }

  function activity() {
    if (!session) return
    if (Date.now() - lastActivity >= idleTimeout) lock()
    else {
      lastActivity = Date.now()
      checkActivity()
    }
  }

  const showUnlocked = action((methods: VaultUnlockMethods) => {
    if (!session) return
    const ledger = reconcileLedger(session.data)
    closed.set({ kind: 'locked', methods })
    unlocked.set({
      kind: 'open', methods, canReplaceKey: session.canReplaceDeviceUnlock, ledger, restoreVersion: 0,
    })
  }, 'vault.showUnlocked')

  const updateMethods = action((methods: VaultUnlockMethods) => {
    if (!session) return
    const canReplaceKey = session.canReplaceDeviceUnlock
    closed.set({ kind: 'locked', methods })
    unlocked.set((current) => current && { ...current, methods, canReplaceKey })
  }, 'vault.updateMethods')

  function mount() {
    const { signal } = abortVar.require()
    void deviceUnlockAvailable().then(wrap((value) => { supported.set(value) })).catch(() => {})
    void vaultUnlockMethods().then(
      wrap((methods) => {
        if (!signal.aborted) closed.set(methods ? { kind: 'locked', methods, atLaunch: true } : { kind: 'setup' })
      }),
      wrap((error: unknown) => {
        if (!signal.aborted) closed.set({ kind: 'unavailable', message: messageFor(error, 'Хранилище недоступно.') })
      }),
    ).catch(() => {})
    window.addEventListener('pointerdown', wrap(activity), { signal })
    window.addEventListener('keydown', wrap(activity), { signal })
    window.addEventListener('pagehide', wrap(lock), { signal })
    document.addEventListener('visibilitychange', wrap(checkActivity), { signal })
    return lock
  }

  const open = action(async (request: (signal: AbortSignal) => Promise<VaultSession<Ledger>>) => {
    const { signal } = abortVar.require()
    try {
      const current = await wrap(request(signal))
      if (!isLedger(current.data)) throw new Error('Unsupported ledger format')
      const methods = await wrap(vaultUnlockMethods())
      if (!methods || signal.aborted) return
      session = current
      try {
        showUnlocked(methods)
      } catch (error) {
        session = null
        throw error
      }
      lastActivity = Date.now()
      checkActivity()
    } catch (error) {
      if (error instanceof VaultError && error.code === 'exists') {
        const methods = await wrap(vaultUnlockMethods().catch(() => null))
        if (methods && !signal.aborted) closed.set({ kind: 'locked', methods })
      }
      if (!signal.aborted && !isAbort(error)) throw error
    }
  }, 'vault.open').extend(withAsync(), withAbort('first-in-win'))

  const enableDevice = action(async (confirmation: DeviceUnlockConfirmation, replace = false) => {
    const current = session
    if (!current || writing || open.pending()) throw new Error('Vault is busy')
    const { signal } = abortVar.require()
    if (replace) await wrap(current.replaceDeviceUnlock(confirmation, signal))
    else await wrap(current.enableDeviceUnlock(confirmation, signal))
    const methods = await wrap(vaultUnlockMethods())
    if (session === current && methods && !signal.aborted) updateMethods(methods)
  }, 'vault.enableDevice').extend(withAsync(), withAbort('first-in-win'))

  const write = action(async function write<T>(update: LedgerUpdate<T>): Promise<T> {
    const current = session
    if (!current || writing || open.pending() || enableDevice.pending()) throw new Error('Vault is busy')
    writing = true
    try {
      const { ledger, result } = await wrap(Promise.resolve(update(reconcileLedger(current.data))))
      if (session !== current) throw new Error('Хранилище заблокировано.')
      if (ledger !== current.data) await wrap(current.save(ledger))
      if (session === current) unlocked.set((state) => state && { ...state, ledger })
      return result
    } finally {
      writing = false
    }
  }, 'vault.write')

  const exportPasswordBackup = action(async (code: string) => {
    const current = session
    if (!current || writing || open.pending() || enableDevice.pending()) {
      throw new Error('Хранилище занято. Попробуй ещё раз.')
    }
    const backup = await wrap(current.exportPasswordVault(code))
    if (session !== current) throw new Error('Хранилище заблокировано.')
    return backup
  }, 'vault.exportPasswordBackup').extend(withAsync())

  const replaceFromBackup = action(async (file: File, password: string) => {
    const current = session
    await wrap(write(async () => {
      const data = await wrap(readPasswordBackup<Ledger>(file, password, isLedger))
      return { ledger: reconcileLedger(data), result: undefined }
    }))
    if (session === current) unlocked.set((state) => state && { ...state, restoreVersion: state.restoreVersion + 1 })
  }, 'vault.replaceFromBackup').extend(withAsync())

  return {
    screen: screen.extend(withConnectHook(mount)), supported,
    access: {
      lock, write, enableDevice,
      create: (confirmation: DeviceUnlockConfirmation) => open((signal) => createDeviceVault(ensureSbpKey(emptyLedger), confirmation, signal)),
      unlockDevice: () => open((signal) => unlockDeviceVault<Ledger>(signal)),
      unlockPassword: (password: string) => open(() => unlockVault<Ledger>(password)),
      restore: (file: File, password: string) => open(() => restorePasswordVault<Ledger>(file, password, isLedger)),
      exportPasswordBackup, replaceFromBackup,
    },
  }
}
