import { useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog'
import { Download, X } from 'lucide-react'
import { SheetGrip } from '../components/SheetGrip'
import type { VaultUnlockMethods } from '../vault'
import type { VaultAccess } from './useVaultSession'
import { DeviceSetup } from './DeviceSetup'

export function AccessSettings({ vault, methods, canReplaceKey, open, onOpenChange }: {
  vault: VaultAccess
  methods: VaultUnlockMethods
  canReplaceKey: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [error, setError] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [pending, setPending] = useState(false)
  const unlockDescription = methods.device
    ? methods.password ? 'Ключ доступа и прежний пароль подключены.' : 'Ключ доступа подключён.'
    : 'Ключ доступа использует защиту устройства.'

  function download() {
    try {
      const backup = vault.exportPasswordBackup()
      if (!backup) return
      const url = URL.createObjectURL(backup)
      const link = document.createElement('a')
      link.href = url
      link.download = 'budgetmate.bmvault'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch {
      setError('Не удалось скачать копию хранилища.')
    }
  }

  return (
    <Dialog
      presentation="auto"
      open={open}
      onOpenChange={(next, details) => {
        if (pending) details.cancel()
        else onOpenChange(next)
      }}
      onOpenChangeComplete={(next) => {
        if (!next) {
          setError('')
          setReplacing(false)
        }
      }}
    >
      <DialogContent initialFocus="content" finalFocus="#workspace-actions" className="compact-dialog grid-rows-[auto_minmax(0,1fr)]">
        <div className="dialog-header">
          <SheetGrip />
          <DialogTitle className="min-w-0 text-lg wrap-anywhere">Способы входа</DialogTitle>
          <DialogClose className="btn-icon" aria-label="Закрыть"><X size={19} aria-hidden="true" /></DialogClose>
        </div>
        <div className="dialog-body grid content-start gap-2" data-slot="scroll">
          <DialogDescription className="body-text">{unlockDescription}</DialogDescription>
          {methods.device && !replacing && (canReplaceKey
            ? <Button className="btn-secondary" onClick={() => setReplacing(true)}>Заменить ключ доступа</Button>
            : <p className="body-text">Чтобы заменить ключ, открой хранилище прежним паролем.</p>)}
          {(!methods.device || replacing) && <DeviceSetup supported={vault.supported} onPendingChange={setPending} confirm={async (confirmation) => {
            await vault.enableDevice(confirmation, replacing)
            setReplacing(false)
          }} />}
          {methods.password && !methods.device && (
            <div className="grid gap-2 border-t border-line pt-3">
              <Button className="btn-secondary" onClick={download}><Download className="shrink-0" size={18} aria-hidden="true" /> Скачать зашифрованную копию</Button>
              <p className="body-text">На другом адресе выбери «Восстановить из файла».</p>
            </div>
          )}
          {error && <p className="error-text" role="alert">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
