import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'
import { Input } from '@ui-sdk/react/input'
import { ArrowLeft, Fingerprint, KeyRound } from 'lucide-react'
import { Button } from '../shared/ui/Button'
import Brand from '../workspace/Brand'
import { DeviceSetup } from './DeviceSetup'
import { messageFor, type VaultAccess } from './useVaultSession'

export function AccessScreen({ vault }: { vault: VaultAccess }) {
  const { screen, supported } = vault
  const [alternate, setAlternate] = useState(false)
  const [otherOptions, setOtherOptions] = useState(false)
  const [backup, setBackup] = useState<File>()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const launchedUnlock = useRef(false)
  const locked = screen.kind === 'locked'
  const setup = screen.kind === 'setup'
  const autoUnlock = locked && screen.atLaunch && screen.methods.device && !screen.methods.password
    && screen.methods.deviceMode !== 'security-key' && supported === true
  const passwordForm = (setup && alternate && backup) || (locked && screen.methods.password && (!screen.methods.device || alternate))
  const title = setup ? alternate ? 'Восстановить копию' : 'Твоё хранилище'
    : locked ? 'Хранилище закрыто' : screen.kind === 'unavailable' ? 'Хранилище недоступно' : 'Открываем приложение'

  async function act(action: () => Promise<void>, automatic = false) {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await action()
    } catch (error) {
      if (!automatic) setError(messageFor(error, 'Не удалось открыть хранилище.'))
    } finally {
      setPending(false)
    }
  }

  const unlockOnLaunch = useEffectEvent(() => {
    if (launchedUnlock.current || pending) return
    launchedUnlock.current = true
    void act(vault.unlockDevice, true)
  })

  useEffect(() => {
    if (!autoUnlock) return
    const tryUnlock = () => {
      if (document.visibilityState === 'visible') unlockOnLaunch()
    }
    const frame = requestAnimationFrame(tryUnlock)
    document.addEventListener('visibilitychange', tryUnlock)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', tryUnlock)
    }
  }, [autoUnlock])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    event.currentTarget.reset()
    void act(() => setup && backup ? vault.restore(backup, password) : vault.unlockPassword(password))
  }

  return (
    <div className="grid min-h-dvh place-items-center content-center gap-4 px-3 py-4">
      <Brand />
      <main className="surface-panel grid w-full min-w-0 max-w-sm gap-2.5 p-3 sm:p-4" aria-labelledby="access-title">
        <h1 id="access-title" className="text-xl leading-tight wrap-anywhere sm:text-2xl">{title}</h1>
        {setup && !alternate && (
          <>
            <p className="body-text">Данные зашифрованы и хранятся в этом браузере.</p>
            <DeviceSetup supported={supported} confirm={vault.create} onPendingChange={setPending} showOtherOptions={otherOptions} />
            <div className="flex min-w-0 flex-wrap justify-between gap-x-1">
              {supported && <Button variant="text" size="compact" disabled={pending} aria-expanded={otherOptions}
                onClick={() => setOtherOptions(!otherOptions)}>Другие способы</Button>}
              <Button variant="text" size="compact" disabled={pending} onClick={() => { setAlternate(true); setError('') }}>Восстановить копию</Button>
            </div>
          </>
        )}
        {setup && alternate && (
          <>
            <label htmlFor="backup-file" className="text-sm font-bold">Файл резервной копии (.bmvault)</label>
            <input id="backup-file" type="file" accept=".bmvault" disabled={pending} className="field-input max-w-full truncate py-2 file:mr-2 file:rounded-lg file:border-0 file:bg-subtle file:px-2 file:py-1" onChange={(event) => setBackup(event.currentTarget.files?.[0])} />
          </>
        )}
        {locked && screen.methods.device && (
          <Button icon={screen.methods.deviceMode === 'security-key' ? KeyRound : Fingerprint} disabled={pending} onClick={() => {
            launchedUnlock.current = true
            return act(vault.unlockDevice)
          }}>
            {screen.methods.deviceMode === 'security-key' ? 'Открыть USB- или NFC-ключом' : 'Открыть отпечатком или PIN'}
          </Button>
        )}
        {locked && screen.methods.device && screen.methods.password && !alternate && (
          <Button variant="text" disabled={pending} onClick={() => { setAlternate(true); setError('') }}>Ввести код или пароль</Button>
        )}
        {passwordForm && (
          <form onSubmit={submit} className="grid gap-2" autoComplete={setup ? 'off' : undefined}>
            <label htmlFor="vault-password" className="text-sm font-bold">{setup ? 'Код или пароль копии' : 'Код или пароль хранилища'}</label>
            <Input id="vault-password" name="password" type="password" required autoComplete={setup ? 'off' : 'current-password'} data-agent-secret className="field-input text-base" disabled={pending} />
            <Button type="submit" disabled={pending}>{setup ? 'Открыть копию' : 'Разблокировать'}</Button>
          </form>
        )}
        {setup && alternate && (
          <Button variant="text" icon={ArrowLeft} className="justify-self-start" disabled={pending}
            onClick={() => { setAlternate(false); setBackup(undefined); setError('') }}>
            Назад
          </Button>
        )}
        {(error || screen.kind === 'unavailable') && <p role="alert" className="error-text">{screen.kind === 'unavailable' ? screen.message : error}</p>}
      </main>
    </div>
  )
}
