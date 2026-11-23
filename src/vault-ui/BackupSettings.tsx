import { useId, useState, type FormEvent } from 'react'
import { useAtom } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Checkbox, CheckboxIndicator } from '@ui-sdk/react/checkbox'
import { DialogClose, DialogDescription } from '@ui-sdk/react/dialog'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { Check, Copy, Download, Upload } from 'lucide-react'
import { createBackupCode } from '../vault'
import { messageFor, type VaultAccess } from './useVaultSession'

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
      <div className="dialog-body grid content-start gap-2.5" data-slot="scroll">
        <DialogDescription className="body-text m-0">
          Данные из файла заменят все данные в этом профиле. Если нужна текущая версия, сначала скачай её копию.
        </DialogDescription>
        <div className="grid min-w-0 gap-1">
          <label htmlFor={fileId} className="text-sm font-bold">Файл резервной копии (.bmvault)</label>
          <input id={fileId} type="file" accept=".bmvault" required autoFocus disabled={pending > 0}
            className="field-input max-w-full truncate py-2 file:mr-2 file:rounded-lg file:border-0 file:bg-subtle file:px-2 file:py-1"
            onChange={(event) => {
              setFile(event.currentTarget.files?.[0])
              setConfirmed(false)
              setError('')
            }} />
        </div>
        <Field name="password" className="grid min-w-0 gap-1">
          <FieldLabel className="text-sm font-bold">Код или пароль копии</FieldLabel>
          <Input type="password" autoComplete="off" data-agent-secret required disabled={pending > 0}
            className="field-input text-base" value={password} onValueChange={(value) => {
              setPassword(value)
              if (error) setError('')
            }} />
        </Field>
        <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 px-2 text-sm font-semibold has-data-disabled:cursor-default">
          <Checkbox checked={confirmed} disabled={pending > 0} className="checkbox-control"
            onCheckedChange={(value) => setConfirmed(value === true)}>
            <CheckboxIndicator><Check size={13} aria-hidden="true" /></CheckboxIndicator>
          </Checkbox>
          Заменить все текущие данные
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <Button className="btn-secondary min-w-0 px-3" disabled={pending > 0} onClick={onBack}>Назад</Button>
        <Button type="submit" data-agent-confirm className="btn-primary min-w-0 bg-danger px-3 whitespace-normal hover:bg-danger-strong"
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
        <DialogDescription className="body-text m-0"><span role="status">Хранилище восстановлено из копии.</span></DialogDescription>
        <DialogClose autoFocus className="btn-primary w-full">Готово</DialogClose>
      </div>
    )
  }

  return (
    <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-2.5">
      <div className="dialog-body grid content-start gap-2.5" data-slot="scroll">
        <DialogDescription className="body-text m-0">Сохрани код отдельно от файла. Восстановление потребует их оба.</DialogDescription>
        <code className="select-text wrap-anywhere rounded-xl bg-subtle px-3 py-2 text-sm font-semibold" data-agent-secret>{code}</code>
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
      <div className="grid min-w-0 gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Button className="btn-secondary min-w-0 px-2 whitespace-normal" onClick={copy}>
            <Copy size={16} className="shrink-0" aria-hidden="true" />{copied ? 'Скопировано' : 'Копировать код'}
          </Button>
          <Button className="btn-primary min-w-0 px-2 whitespace-normal" disabled={pending > 0} onClick={download}>
            <Download size={16} className="shrink-0" aria-hidden="true" /> Скачать копию
          </Button>
        </div>
        <Button className="btn-text min-w-0 px-2 whitespace-normal" disabled={pending > 0} onClick={() => {
          setError('')
          setMode('restore')
        }}>
          <Upload size={16} className="shrink-0" aria-hidden="true" /> Восстановить копию
        </Button>
      </div>
    </div>
  )
}
