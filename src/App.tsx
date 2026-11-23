import { lazy, Suspense, useEffect, useState } from 'react'
import { createBrowserReminderScheduler, openCreditRemindersFromNotification } from './notifications/browser'
import { AccessScreen } from './vault-ui/AccessScreen'
import { useVaultSession } from './vault-ui/useVaultSession'
const Workspace = lazy(() => import('./workspace/Workspace'))

export default function App() {
  const vault = useVaultSession()
  const ledger = vault.screen.kind === 'open' ? vault.screen.ledger : undefined
  const [reminders] = useState(createBrowserReminderScheduler)
  useEffect(() => reminders.mount(), [reminders])
  useEffect(openCreditRemindersFromNotification, [])
  useEffect(() => {
    if (ledger) reminders.update(ledger)
  }, [ledger, reminders])

  return vault.screen.kind === 'open'
    ? <Suspense fallback={<p role="status" className="grid min-h-dvh place-items-center text-sm text-muted">Открываем операции…</p>}>
      <Workspace vault={vault} ledger={vault.screen.ledger} methods={vault.screen.methods} canReplaceKey={vault.screen.canReplaceKey} onNotificationPermission={reminders.refresh} />
    </Suspense>
    : <AccessScreen vault={vault} />
}
