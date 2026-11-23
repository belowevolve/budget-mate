import { wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Statements } from '../components/Statements'
import type { Ledger } from '../finance'
import type { VaultWrite } from '../vault-ui/vaultModel'
import { reatomImport } from './importModel'
import type { Notify } from '../notifications/presentation'

export default reatomFactoryComponent<{
  ledger: Ledger
  write: VaultWrite
  notify: Notify
}>(() => {
  const model = reatomImport()

  return ({ ledger, write, notify }) => (
    <div className="grid min-w-0 gap-3">
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
