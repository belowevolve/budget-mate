import { useId, useState, type FormEvent } from 'react'
import { useAtom } from '@reatom/react'
import { DialogClose, DialogDescription } from '@ui-sdk/react/dialog'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Copy, Download, Upload } from 'lucide-react'
import { DialogBody } from '../shared/ui/DialogSurface'
import { Button, buttonVariants } from '../shared/ui/Button'
import { Checkbox } from '../shared/ui/Checkbox'
import { createBackupCode } from '../vault'
import { messageFor, type VaultAccess } from './useVaultSession'
import { FileField, FieldInput } from '../shared/ui/FieldInput'
import { BodyText, ErrorText } from '../shared/ui/Text'

function RestoreBackup({ vault, onBack, onRestored }: { vault: VaultAccess; onBack: () => void; onRestored: () => void }) {
  const fileId = useId()
  const [file, setFile] = useState<File>()
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending] = useAtom(vault.replaceFromBackup.pending)
  const [error, setError] = useState('')

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || !password || !confirmed || vault.replaceFromBackup.pending()) return
    setPassword('')
    setError('')
    try {
      await vault.replaceFromBackup(file, password)
      onRestored()
    } catch (error) {
      setConfirmed(false)
      setError(messageFor(error, 'Не удалось восстановить хранилище.'))
    }
  }

  return (
    <form autoComplete="off" onSubmit={restore} className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-2.5">
      <DialogBody className="grid content-start gap-2.5">
        <DialogDescription render={<BodyText />} className="m-0">
          Данные из файла заменят все данные в этом профиле. Если нужна текущая версия, сначала скачай её копию.
        </DialogDescription>
        <div className="grid min-w-0 gap-1">
          <label htmlFor={fileId} className="text-sm font-bold">Файл резервной копии (.bmvault)</label>
          <FileField id={fileId} accept=".bmvault" required autoFocus disabled={pending > 0}
            onChange={(event) => {
              setFile(event.currentTarget.files?.[0])
              setConfirmed(false)
              setError('')
            }} />
        </div>
        <Field name="password" className="grid min-w-0 gap-1">
          <FieldLabel className="text-sm font-bold">Код или пароль копии</FieldLabel>
          <FieldInput type="password" autoComplete="off" data-agent-secret required disabled={pending > 0}
            className="text-base" value={password} onValueChange={(value) => {
              setPassword(value)
              if (error) setError('')
            }} />
        </Field>
        <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 px-2 text-sm font-semibold has-data-disabled:cursor-default">
          <Checkbox checked={confirmed} disabled={pending > 0}
            onCheckedChange={(value) => setConfirmed(value === true)} />
          Заменить все текущие данные
        </label>
        {error && <ErrorText role="alert">{error}</ErrorText>}
      </DialogBody>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <Button variant="secondary" disabled={pending > 0} onClick={onBack}>Назад</Button>
        <Button variant="danger" type="submit" data-agent-confirm
          disabled={!file || !password || !confirmed || pending > 0}>
          {pending ? 'Восстанавливаем…' : 'Восстановить хранилище'}
        </Button>
      </div>
    </form>
  )
}

export default function BackupSettings({ vault }: { vault: VaultAccess }) {
  const [mode, setMode] = useState<'backup' | 'restore' | 'done'>('backup')
  const [code] = useState(createBackupCode)
  const [copied, setCopied] = useState(false)
  const [pending] = useAtom(vault.exportPasswordBackup.pending)
  const [error, setError] = useState('')

  async function download() {
    if (pending) return
    setError('')
    try {
      const backup = await vault.exportPasswordBackup(code)
      const url = URL.createObjectURL(backup)
      const link = document.createElement('a')
      link.href = url
      link.download = 'budget-mate.bmvault'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (error) {
      setError(messageFor(error, 'Не удалось скачать копию хранилища.'))
    }
  }

  async function copy() {
    setError('')
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setError('Выдели и скопируй код вручную.')
    }
  }

  if (mode === 'restore') return <RestoreBackup vault={vault} onBack={() => setMode('backup')} onRestored={() => setMode('done')} />

  if (mode === 'done') {
    return (
      <div className="grid min-w-0 gap-2.5">
        <DialogDescription render={<BodyText />} className="m-0"><span role="status">Хранилище восстановлено из копии.</span></DialogDescription>
        <DialogClose autoFocus className={buttonVariants({ className: 'w-full' })}>Готово</DialogClose>
      </div>
    )
  }

  return (
    <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-2.5">
      <DialogBody className="grid content-start gap-2.5">
        <DialogDescription render={<BodyText />} className="m-0">Сохрани код отдельно от файла. Восстановление потребует их оба.</DialogDescription>
        <code className="select-text wrap-anywhere rounded-xl bg-subtle px-3 py-2 text-sm font-semibold" data-agent-secret>{code}</code>
        {error && <ErrorText role="alert">{error}</ErrorText>}
      </DialogBody>
      <div className="grid min-w-0 gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="compact" onClick={copy}>
            <Copy aria-hidden="true" />
            <span>{copied ? 'Скопировано' : 'Копировать код'}</span>
          </Button>
          <Button size="compact" disabled={pending > 0} onClick={download}>
            <Download aria-hidden="true" />
            <span>Скачать копию</span>
          </Button>
        </div>
        <Button variant="text" disabled={pending > 0} onClick={() => {
          setError('')
          setMode('restore')
        }}>
          <Upload aria-hidden="true" data-icon="inline-start" />
          <span>Восстановить копию</span>
        </Button>
      </div>
    </div>
  )
}
