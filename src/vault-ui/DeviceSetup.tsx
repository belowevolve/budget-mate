import { useEffect, useRef, useState } from 'react'
import { Fingerprint, KeyRound } from 'lucide-react'
import { Button } from '../shared/ui/Button'
import { deviceUnlockAvailable, prepareDeviceUnlock, type DeviceKeyMode, type DeviceUnlockConfirmation } from '../vault'
import { messageFor } from './useVaultSession'

export function DeviceSetup({ supported, confirm, onPendingChange, showOtherOptions = false }: {
  supported?: boolean
  confirm: (confirmation: DeviceUnlockConfirmation) => Promise<void>
  onPendingChange?: (pending: boolean) => void
  showOtherOptions?: boolean
}) {
  const [stage, setStage] = useState<DeviceUnlockConfirmation>()
  const [mode, setMode] = useState<DeviceKeyMode>('platform')
  const [external, setExternal] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const android = /Android/i.test(globalThis.navigator?.userAgent ?? '')
  useEffect(() => {
    let active = true
    void deviceUnlockAvailable('security-key').then((value) => { if (active) setExternal(value) })
    return () => { active = false; request.current?.abort() }
  }, [])

  async function start(method: DeviceKeyMode) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setMode(method)
    setError('')
    setPending(true)
    onPendingChange?.(true)
    try {
      const preparation = await prepareDeviceUnlock(method, controller.signal)
      controller.signal.throwIfAborted()
      setStage(preparation)
      if (preparation.verifiedOnCreate) await confirm(preparation)
    } catch (error) {
      if (!controller.signal.aborted) setError(messageFor(error, error instanceof Error ? error.message : 'Не удалось создать ключ доступа.'))
    } finally {
      request.current = null
      if (!controller.signal.aborted) { setPending(false); onPendingChange?.(false) }
    }
  }

  async function finish() {
    if (pending || !stage) return
    setPending(true)
    onPendingChange?.(true)
    setError('')
    try {
      await confirm(stage)
    } catch (error) {
      setError(messageFor(error, 'Не удалось подтвердить ключ доступа.'))
    } finally {
      setPending(false)
      onPendingChange?.(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-2">
      {stage ? (
        <>
          {!stage.verifiedOnCreate && <p className="body-text">Подтверди вход на устройстве.</p>}
          <Button disabled={pending} onClick={finish}>{stage.verifiedOnCreate ? 'Продолжить' : 'Подтвердить вход'}</Button>
          <Button variant="text" disabled={pending} onClick={() => { setStage(undefined); setError('') }}>Выбрать другой ключ</Button>
        </>
      ) : (
        <>
          {supported && <Button disabled={pending} onClick={() => start('platform')}>
            <Fingerprint aria-hidden="true" />
            <span>Настроить отпечаток или PIN</span>
          </Button>}
          {external && (!supported || showOtherOptions) && (
            <Button variant="secondary" disabled={pending} onClick={() => start('security-key')}>
              <KeyRound aria-hidden="true" />
              <span>Использовать USB- или NFC-ключ</span>
            </Button>
          )}
          {supported === false && !external && <p className="body-text">Для настройки входа открой приложение через HTTPS или localhost в браузере с поддержкой ключей доступа.</p>}
        </>
      )}
      {error && (
        <div role="alert" className="grid gap-2">
          <p className="error-text">{error}</p>
          {android && mode === 'platform' && (
            <p className="body-text">Если Bitwarden выдаёт ошибку, выбери Google как провайдера ключей доступа в настройках Android.</p>
          )}
        </div>
      )}
    </div>
  )
}
