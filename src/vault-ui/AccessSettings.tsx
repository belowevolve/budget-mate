import { useState } from 'react'
import { Button } from '../shared/ui/Button'
import type { VaultUnlockMethods } from '../vault'
import type { VaultAccess } from './useVaultSession'
import { DeviceSetup } from './DeviceSetup'
import { BodyText } from '../shared/ui/Text'

export function AccessSettings({ vault, methods, canReplaceKey }: {
  vault: VaultAccess
  methods: VaultUnlockMethods
  canReplaceKey: boolean
}) {
  const [replacing, setReplacing] = useState(false)

  return (
    <div className="grid min-w-0 content-start gap-2">
      {methods.device && <BodyText>
        {methods.deviceMode === 'security-key' ? 'Вход через USB- или NFC-ключ.' : 'Вход с подтверждением на устройстве.'}
        {methods.password && ' Вход прежним паролем также доступен.'}
      </BodyText>}
      {methods.device && !replacing && (canReplaceKey
        ? <Button variant="secondary" onClick={() => setReplacing(true)}>Заменить ключ доступа</Button>
        : <BodyText>Чтобы заменить ключ, открой хранилище прежним паролем.</BodyText>)}
      {(!methods.device || replacing) && <DeviceSetup supported={vault.supported} showOtherOptions confirm={async (confirmation) => {
        await vault.enableDevice(confirmation, replacing)
        setReplacing(false)
      }} />}
    </div>
  )
}
