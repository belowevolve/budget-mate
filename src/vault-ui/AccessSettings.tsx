import { useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import type { VaultUnlockMethods } from '../vault'
import type { VaultAccess } from './useVaultSession'
import { DeviceSetup } from './DeviceSetup'

export function AccessSettings({ vault, methods, canReplaceKey }: {
  vault: VaultAccess
  methods: VaultUnlockMethods
  canReplaceKey: boolean
}) {
  const [replacing, setReplacing] = useState(false)

  return (
    <div className="grid min-w-0 content-start gap-2">
      {methods.device && <p className="body-text">
        {methods.deviceMode === 'security-key' ? 'Вход через USB- или NFC-ключ.' : 'Вход с подтверждением на устройстве.'}
        {methods.password && ' Вход прежним паролем также доступен.'}
      </p>}
      {methods.device && !replacing && (canReplaceKey
        ? <Button className="btn-secondary" onClick={() => setReplacing(true)}>Заменить ключ доступа</Button>
        : <p className="body-text">Чтобы заменить ключ, открой хранилище прежним паролем.</p>)}
      {(!methods.device || replacing) && <DeviceSetup supported={vault.supported} showOtherOptions confirm={async (confirmation) => {
        await vault.enableDevice(confirmation, replacing)
        setReplacing(false)
      }} />}
    </div>
  )
}
