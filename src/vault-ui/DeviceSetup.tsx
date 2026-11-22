import { useEffect, useRef, useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Fingerprint, KeyRound } from 'lucide-react'
import { deviceUnlockAvailable, prepareDeviceUnlock, type DeviceKeyMode, type DeviceUnlockConfirmation } from '../vault'
import { messageFor } from './useVaultSession'

export function DeviceSetup({ supported, confirm, onPendingChange }: {
  supported?: boolean
  confirm: (confirmation: DeviceUnlockConfirmation) => Promise<void>
  onPendingChange?: (pending: boolean) => void
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
      if (!controller.signal.aborted) setStage(preparation)
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
          <p className="body-text">Подтверди, что ключ открывает хранилище.</p>
          <Button className="btn-primary" disabled={pending} onClick={finish}>Подтвердить ключ</Button>
          <Button className="btn-text" disabled={pending} onClick={() => { setStage(undefined); setError('') }}>Выбрать другой ключ</Button>
        </>
      ) : (
        <>
          {supported && <Button className="btn-primary" disabled={pending} onClick={() => start('platform')}><Fingerprint size={19} aria-hidden="true" /> Создать ключ доступа</Button>}
          {supported && <p className="body-text">{android
            ? 'Android попросит отпечаток или PIN устройства.'
            : 'Провайдера ключа предложит браузер.'}</p>}
          {external && <Button className="btn-secondary" disabled={pending} onClick={() => start('security-key')}><KeyRound size={18} aria-hidden="true" /> Использовать USB или NFC ключ</Button>}
          {supported === false && !external && <p className="body-text">Для нового хранилища нужен совместимый ключ доступа. На компьютере открой приложение через localhost, на телефоне — через HTTPS-домен.</p>}
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
