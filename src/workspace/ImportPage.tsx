import type { ReactNode } from 'react'
import { wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Statements } from '../components/Statements'
import type { Ledger } from '../finance'
import type { VaultWrite } from '../vault-ui/vaultModel'
import { reatomImport } from './importModel'
import type { NotificationKind } from './workspaceState'

export default reatomFactoryComponent<{
  ledger: Ledger
  write: VaultWrite
  notify: (message: string, type?: NotificationKind) => void
  beforeFiles?: ReactNode
}>(() => {
  const model = reatomImport()

  return ({ ledger, write, notify, beforeFiles }) => (
    <div className="grid min-w-0 gap-3">
      {beforeFiles}
      <Statements
        busy={model.busy()}
        previews={model.previews()}
        history={ledger.imports}
        onFiles={wrap((files) => model.read(files, ledger.sbp?.key, write, notify))}
        onConfirm={wrap(() => model.confirm(write, notify))}
        onClear={wrap(model.clear)}
      />
    </div>
  )
}, 'ImportPage')
