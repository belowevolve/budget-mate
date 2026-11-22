import { useEffect, useMemo } from 'react'
import { wrap } from '@reatom/core'
import { reatomFactoryComponent, useAtom } from '@reatom/react'
import { CalendarDays } from 'lucide-react'
import Overview from '../components/Overview'
import Journal from '../components/Journal'
import { Choice } from '../components/Choice'
import CreditCards, { CreditOverviewReminders } from '../components/CreditCards'
import BillPage from '../bills/BillPage'
import { formatMonth, type Ledger } from '../finance'
import { buildRefundIndex, type RefundIndex } from '../refunds'
import type { VaultUnlockMethods } from '../vault'
import type { VaultAccess } from '../vault-ui/useVaultSession'
import { AccessSettings } from '../vault-ui/AccessSettings'
import ImportPage from './ImportPage'
import OperationDetails from './OperationDetails'
import TransferSettings from './TransferSettings'
import { reatomWorkspace, type Page, type WorkspaceStore } from './workspaceState'
import WorkspaceShell from './WorkspaceShell'
import WorkspaceToasts from './WorkspaceToasts'

type WorkspaceProps = {
  vault: VaultAccess; ledger: Ledger; methods: VaultUnlockMethods; canReplaceKey: boolean
}

export default reatomFactoryComponent<WorkspaceProps>(({ ledger: initialLedger }) => {
  const store = reatomWorkspace(initialLedger.transactions.length ? 'overview' : 'import')

  return ({ vault, ledger, methods, canReplaceKey }) => {
    const page = store.page()
    useEffect(() => store.mount(), [])
    const refunds = useMemo(() => buildRefundIndex(ledger.transactions, ledger.refunds), [ledger.transactions, ledger.refunds])

    return (
      <>
        <WorkspaceShell page={page} onNavigate={wrap(store.navigate)} onOpenSettings={wrap(store.setSettingsDialog)} onLock={vault.lock}>
          <WorkspacePage page={page} store={store} ledger={ledger} write={vault.write} refunds={refunds} />
        </WorkspaceShell>
        <WorkspaceDialogs store={store} vault={vault} ledger={ledger} methods={methods} canReplaceKey={canReplaceKey} refunds={refunds} />
        <WorkspaceToasts toaster={store.toaster} />
      </>
    )
  }
}, 'Workspace')

function WorkspacePage({ page, store, ledger, write, refunds }: {
  page: Page
  store: WorkspaceStore
  ledger: Ledger
  write: VaultAccess['write']
  refunds: RefundIndex
}) {
  const [month] = useAtom(store.month)
  const [currency] = useAtom(store.currency)
  const [journalFilter] = useAtom(store.journalFilter)

  const { transactions } = ledger
  const { activeMonths, currencies } = useMemo(() => ({
    activeMonths: [...new Set(transactions.map((row) => row.date.slice(0, 7)))].sort().reverse(),
    currencies: [...new Set(transactions.map((row) => row.currency))],
  }), [transactions])
  const activeCurrency = currency ?? (currencies.includes('RUB') ? 'RUB' : currencies[0] ?? 'RUB')
  const activeMonth = month ?? activeMonths[0] ?? 'all'
  const rows = useMemo(() => transactions.filter((row) => row.currency === activeCurrency && (activeMonth === 'all' || row.date.slice(0, 7) === activeMonth)), [transactions, activeCurrency, activeMonth])
  const transferSettings = ledger.sbp?.ownPhone ? undefined : <TransferSettings onChange={(phone) => store.setPhone(write, phone)} />

  return (
    <>
      {(page === 'overview' || page === 'transactions') && (currencies.length > 1 || activeMonths.length > 0) && (
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 md:mb-4">
          {currencies.length > 1 && <Choice label="Валюта" value={activeCurrency} options={currencies.map((code) => ({ value: code, label: code }))} onChange={store.setCurrency} />}
          {activeMonths.length > 0 && <Choice label="Период" value={activeMonth} onChange={store.setMonth}
            icon={<CalendarDays size={17} className="shrink-0" aria-hidden="true" />}
            options={[{ value: 'all', label: 'Весь период' }, ...activeMonths.map((value) => ({ value, label: formatMonth(value) }))]} />}
        </div>
      )}
      {page === 'overview' && <CreditOverviewReminders ledger={ledger} onOpen={() => store.navigate('credits')} />}
      {page === 'overview' && <Overview rows={rows} currency={activeCurrency} month={activeMonth === 'all' ? '' : activeMonth} refunds={refunds}
        onImport={() => store.navigate('import')} onViewAll={(kind) => store.navigate('transactions', { kind })}
        onViewCategory={(category) => store.navigate('transactions', { kind: 'expense', category })} onSelectTransaction={store.selectOperation} />}
      {page === 'transactions' && <Journal key={`${journalFilter.kind ?? 'activity'}-${journalFilter.category ?? 'all'}`}
        rows={rows} currency={activeCurrency} periodKey={`${activeCurrency}:${activeMonth}`} editable initial={journalFilter} onSelect={store.selectOperation} refunds={refunds}
        onRefund={(row) => store.selectOperation(row, 'refund')}
        transferSettings={transferSettings}
        onQuickTransfer={async (row) => {
          try {
            await store.setCategory(write, row.id, 'transfer')
          } catch {
            store.notify('Не удалось перенести операцию в свои переводы.', 'error')
          }
        }} />}
      {page === 'credits' && <CreditCards ledger={ledger} write={write} notify={store.notify} onImport={() => store.navigate('import')} />}
      {page === 'bills' && <BillPage ledger={ledger} write={write} notify={store.notify} onOpenOperation={store.selectOperation} />}
      <div hidden={page !== 'import'}><ImportPage ledger={ledger} write={write} notify={store.notify} beforeFiles={page === 'import' ? transferSettings : undefined} /></div>
    </>
  )
}

function WorkspaceDialogs({ store, vault, ledger, methods, canReplaceKey, refunds }: WorkspaceProps & { store: WorkspaceStore; refunds: RefundIndex }) {
  const [operation] = useAtom(store.operation)
  const [settingsDialog] = useAtom(store.settingsDialog)
  const selected = operation ? ledger.transactions.find((row) => row.id === operation.id) : undefined

  return (
    <>
      <TransferSettings showTrigger={false} open={settingsDialog === 'phone'} maskedPhone={ledger.sbp?.ownPhone?.label}
        onChange={(phone) => store.setPhone(vault.write, phone)}
        onOpenChange={(open) => store.setSettingsDialog(open ? 'phone' : null)} />
      <AccessSettings vault={vault} methods={methods} canReplaceKey={canReplaceKey} open={settingsDialog === 'access'}
        onOpenChange={(open) => store.setSettingsDialog(open ? 'access' : null)} />
      {selected && operation && <OperationDetails key={selected.id} row={selected} pane={operation.pane}
        transactions={ledger.transactions} refunds={refunds} onOpen={store.selectOperation} onClose={() => store.selectOperation()}
        onSave={(category) => store.setCategory(vault.write, selected.id, category)}
        onSaveRefund={(expenseId) => store.setRefund(vault.write, selected.id, expenseId)} />}
    </>
  )
}
