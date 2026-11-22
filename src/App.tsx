import { lazy, Suspense } from 'react'
import { AccessScreen } from './vault-ui/AccessScreen'
import { useVaultSession } from './vault-ui/useVaultSession'
const Workspace = lazy(() => import('./workspace/Workspace'))

export default function App() {
  const vault = useVaultSession()
  return vault.screen.kind === 'open'
    ? <Suspense fallback={<p role="status" className="grid min-h-dvh place-items-center text-sm text-muted">Открываем операции…</p>}>
      <Workspace vault={vault} ledger={vault.screen.ledger} methods={vault.screen.methods} canReplaceKey={vault.screen.canReplaceKey} />
    </Suspense>
    : <AccessScreen vault={vault} />
}
