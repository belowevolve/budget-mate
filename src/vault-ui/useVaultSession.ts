import { useState } from 'react'
import { useAtom } from '@reatom/react'
import { reatomVault } from './vaultModel'

export { messageFor } from './vaultModel'

export function useVaultSession() {
  const [model] = useState(reatomVault)
  const [screen] = useAtom(model.screen)
  const [supported] = useAtom(model.supported)
  return { ...model.access, screen, supported }
}

export type VaultAccess = ReturnType<typeof useVaultSession>
