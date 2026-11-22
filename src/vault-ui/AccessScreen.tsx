import { useState, type FormEvent } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Input } from '@ui-sdk/react/input'
import { Fingerprint, KeyRound } from 'lucide-react'
import Brand from '../workspace/Brand'
import { DeviceSetup } from './DeviceSetup'
import { messageFor, type VaultAccess } from './useVaultSession'

export function AccessScreen({ vault }: { vault: VaultAccess }) {
  const { screen, supported } = vault
  const [alternate, setAlternate] = useState(false)
  const [backup, setBackup] = useState<File>()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const locked = screen.kind === 'locked'
  const setup = screen.kind === 'setup'
  const passwordForm = (setup && alternate && backup) || (locked && screen.methods.password && (!screen.methods.device || alternate))
  const title = setup ? alternate ? 'Восстановить хранилище' : 'Настроить хранилище'
    : locked ? 'Хранилище закрыто' : screen.kind === 'unavailable' ? 'Хранилище недоступно' : 'Открываем приложение'

  async function act(action: () => Promise<void>) {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await action()
    } catch (error) {
      setError(messageFor(error, 'Не удалось открыть хранилище.'))
    } finally {
      setPending(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    event.currentTarget.reset()
    void act(() => setup && backup ? vault.restore(backup, password) : vault.unlockPassword(password))
  }

  return (
    <div className="grid min-h-dvh place-items-center content-center gap-4 p-3">
      <Brand />
      <main className="surface-panel grid w-full min-w-0 max-w-[440px] gap-3 p-4 sm:p-5" aria-labelledby="access-title">
        <h1 id="access-title" className="text-xl leading-tight wrap-anywhere sm:text-2xl">{title}</h1>
        {setup && !alternate && (
          <>
            <p className="body-text">Выписки хранятся зашифрованными в браузере.</p>
            <DeviceSetup supported={supported} confirm={vault.create} />
            <Button className="btn-text" onClick={() => { setAlternate(true); setError('') }}>Восстановить из файла</Button>
          </>
        )}
        {setup && alternate && (
          <>
            <label htmlFor="backup-file" className="text-sm font-bold">Зашифрованная копия budgetmate</label>
            <input id="backup-file" type="file" accept=".bmvault" disabled={pending} className="field-input max-w-full truncate py-2 file:mr-2 file:rounded-lg file:border-0 file:bg-subtle file:px-2 file:py-1" onChange={(event) => setBackup(event.currentTarget.files?.[0])} />
            <Button className="btn-text" disabled={pending} onClick={() => { setAlternate(false); setBackup(undefined); setError('') }}>Назад</Button>
          </>
        )}
        {locked && screen.methods.device && (
          <Button className="btn-primary" disabled={pending} onClick={() => act(vault.unlockDevice)}>{screen.methods.deviceMode === 'security-key' ? <KeyRound size={19} aria-hidden="true" /> : <Fingerprint size={19} aria-hidden="true" />} {screen.methods.deviceMode === 'security-key' ? 'Открыть USB или NFC ключом' : 'Открыть ключом доступа'}</Button>
        )}
        {locked && screen.methods.device && screen.methods.password && !alternate && (
          <Button className="btn-text" disabled={pending} onClick={() => { setAlternate(true); setError('') }}>Ввести прежний пароль</Button>
        )}
        {passwordForm && (
          <form onSubmit={submit} className="grid gap-2">
            <label htmlFor="vault-password" className="text-sm font-bold">Пароль существующего хранилища</label>
            <Input id="vault-password" name="password" type="password" required autoComplete="current-password" data-agent-secret className="field-input" />
            <Button type="submit" disabled={pending} className="btn-primary">{setup ? 'Открыть копию' : 'Разблокировать'}</Button>
          </form>
        )}
        {(error || screen.kind === 'unavailable') && <p role="alert" className="error-text">{screen.kind === 'unavailable' ? screen.message : error}</p>}
      </main>
    </div>
  )
}
