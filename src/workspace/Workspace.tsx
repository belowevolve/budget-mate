import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { wrap } from '@reatom/core'
import { reatomFactoryComponent, useAtom } from '@reatom/react'
import { CalendarDays } from 'lucide-react'
import Overview from '../components/Overview'
import Journal from '../components/Journal'
import { Choice } from '../shared/ui/Choice'
import CreditCards, { CreditOverviewReminders } from '../components/CreditCards'
import BillPage from '../bills/BillPage'
import { CategoryCatalogProvider } from '../categories/CategoryCatalog'
import { categoryCatalog } from '../categories/catalog'
import { presentTransactions, type Ledger, type Transaction } from '../finance'
import { creditReminderHash } from '../notifications/browser'
import { readPlaces, type Place } from '../places/model'
import { buildRefundIndex, type RefundIndex } from '../refunds'
import { formatMonth } from '../shared/format'
import type { VaultUnlockMethods } from '../vault'
import type { VaultAccess } from '../vault-ui/useVaultSession'
import ImportPage from './ImportPage'
import OperationDetails from './OperationDetails'
import WorkspaceSettings from './WorkspaceSettings'
import { reatomWorkspace, type Page, type SettingsView, type WorkspaceStore } from './workspaceState'
import WorkspaceShell from './WorkspaceShell'
import WorkspaceToasts from './WorkspaceToasts'

type WorkspaceProps = {
  vault: VaultAccess; ledger: Ledger; methods: VaultUnlockMethods; canReplaceKey: boolean
  onNotificationPermission: () => void
}

type SettingsRoute = { view: NonNullable<SettingsView>; from: Page }

function settingsRouteFromHistory(): SettingsRoute | undefined {
  const route: SettingsRoute | undefined = window.history.state?.budgetmatesSettings
  if (route && (route.view === 'menu' || route.view === 'access' || route.view === 'categories' || route.view === 'places')) return route
}

export default reatomFactoryComponent<WorkspaceProps>(({ ledger: initialLedger }) => {
  const initialPage = window.location.hash === creditReminderHash ? 'credits'
    : settingsRouteFromHistory()?.from ?? (initialLedger.transactions.length ? 'overview' : 'import')
  const store = reatomWorkspace(initialPage)

  return ({ vault, ledger, methods, canReplaceKey, onNotificationPermission }) => {
    const page = store.page()
    const restoreVersion = vault.screen.kind === 'open' ? vault.screen.restoreVersion : 0
    const [settings, setSettings] = useState(settingsRouteFromHistory)
    useEffect(() => store.mount(), [])
    useLayoutEffect(() => {
      if (restoreVersion > 0) store.resetAfterRestore()
    }, [restoreVersion])
    useEffect(() => {
      const syncSettings = () => setSettings(settingsRouteFromHistory())
      const openReminder = () => {
        if (window.location.hash !== creditReminderHash) return
        store.navigate('credits')
        window.history.replaceState({ ...window.history.state, budgetmatesSettings: null }, '', window.location.pathname + window.location.search)
        syncSettings()
      }
      openReminder()
      window.addEventListener('popstate', syncSettings)
      window.addEventListener('hashchange', openReminder)
      return () => {
        window.removeEventListener('popstate', syncSettings)
        window.removeEventListener('hashchange', openReminder)
      }
    }, [])
    const places = useMemo(() => readPlaces(ledger.places), [ledger.places])
    const transactions = useMemo(
      () => presentTransactions(ledger.transactions, places, categoryCatalog(ledger.categoryOverrides)),
      [ledger.transactions, ledger.categoryOverrides, places],
    )
    const refunds = useMemo(() => buildRefundIndex(transactions, ledger.refunds), [transactions, ledger.refunds])

    function openSettings(view: SettingsView) {
      const current = settingsRouteFromHistory()
      if (view === null || (view === 'menu' && current && current.view !== 'menu')) {
        if (current) window.history.back()
        return
      }
      if (view === current?.view) return
      const next = { view, from: page }
      window.history.pushState({ ...window.history.state, budgetmatesSettings: next }, '')
      store.selectOperation()
      setSettings(next)
    }

    return (
      <CategoryCatalogProvider overrides={ledger.categoryOverrides}>
        <WorkspaceShell page={page} onNavigate={wrap(store.navigate)} onOpenSettings={wrap(() => openSettings('menu'))}
          settings={settings && {
            view: settings.view,
            onBack: () => openSettings(null),
            content: <WorkspaceSettings view={settings.view} onView={wrap(openSettings)} ledger={ledger} places={places} vault={vault} methods={methods}
              canReplaceKey={canReplaceKey} savePhone={(phone) => store.setPhone(vault.write, phone)} notify={store.notifyFor(page)}
              onEditPlaceBindings={(fromId, aliases, toId) => store.editPlaceBindings(vault.write, fromId, aliases, toId)}
              onNotificationPermission={onNotificationPermission} />,
          }}>
          <WorkspacePage key={restoreVersion} page={page} store={store} ledger={ledger} transactions={transactions} write={vault.write} refunds={refunds} />
        </WorkspaceShell>
        {!settings && <WorkspaceOperation store={store} places={places} transactions={transactions} write={vault.write} refunds={refunds} />}
        <WorkspaceToasts toaster={store.toaster} fullScreen={Boolean(settings)} />
      </CategoryCatalogProvider>
    )
  }
}, 'Workspace')

function WorkspacePage({ page, store, ledger, transactions, write, refunds }: {
  page: Page
  store: WorkspaceStore
  ledger: Ledger
  transactions: Transaction[]
  write: VaultAccess['write']
  refunds: RefundIndex
}) {
  const [month] = useAtom(store.month)
  const [currency] = useAtom(store.currency)
  const [journalFilter] = useAtom(store.journalFilter)

  const { activeMonths, currencies } = useMemo(() => ({
    activeMonths: [...new Set(transactions.map((row) => row.date.slice(0, 7)))].sort().reverse(),
    currencies: [...new Set(transactions.map((row) => row.currency))],
  }), [transactions])
  const activeCurrency = currency ?? (currencies.includes('RUB') ? 'RUB' : currencies[0] ?? 'RUB')
  const activeMonth = month ?? activeMonths[0] ?? 'all'
  const rows = useMemo(() => transactions.filter((row) => row.currency === activeCurrency && (activeMonth === 'all' || row.date.slice(0, 7) === activeMonth)), [transactions, activeCurrency, activeMonth])
  const notify = store.notifyFor(page)

  return (
    <>
      {(page === 'overview' || page === 'transactions') && (currencies.length > 1 || activeMonths.length > 0) && (
        <div className={`mb-3 flex min-w-0 flex-wrap items-center gap-2 md:mb-4 ${page === 'transactions' ? 'px-3 sm:px-0' : ''}`}>
          {currencies.length > 1 && <Choice label="Валюта" value={activeCurrency} options={currencies.map((code) => ({ value: code, label: code }))} onChange={store.setCurrency} />}
          {activeMonths.length > 0 && <Choice label="Период" value={activeMonth} onChange={store.setMonth}
            icon={<CalendarDays size={17} className="shrink-0" aria-hidden="true" />}
            options={[{ value: 'all', label: 'Весь период' }, ...activeMonths.map((value) => ({ value, label: formatMonth(value) }))]} />}
        </div>
      )}
      {page === 'overview' && <CreditOverviewReminders ledger={ledger} onOpen={() => store.navigate('credits')} />}
      {page === 'overview' && <Overview rows={rows} currency={activeCurrency} month={activeMonth === 'all' ? '' : activeMonth} refunds={refunds}
        onImport={() => store.navigate('import')} onViewTransfers={() => store.navigate('transactions', { kind: 'transfer' })}
        onViewCategory={(category) => store.navigate('transactions', { kind: 'expense', category })} />}
      {page === 'transactions' && <Journal key={`${journalFilter.kind ?? 'activity'}-${journalFilter.category ?? 'all'}`}
        rows={rows} currency={activeCurrency} periodKey={`${activeCurrency}:${activeMonth}`} editable initial={journalFilter} onSelect={store.selectOperation} refunds={refunds}
        onRefund={(row) => store.selectOperation(row, 'refund')}
        onChangeCategory={(row) => store.selectOperation(row, 'category')}
        onQuickTransfer={async (row) => {
          try {
            await store.setCategory(write, row.id, 'transfer')
          } catch {
            notify('Не удалось перенести операцию в свои переводы.', 'error')
          }
        }} />}
      {page === 'credits' && <CreditCards ledger={ledger} write={write} notify={notify} onImport={() => store.navigate('import')} />}
      {page === 'bills' && <BillPage ledger={ledger} write={write} notify={notify} notifyWithUndo={store.notifyWithUndo} onOpenOperation={store.selectOperation} />}
      <div hidden={page !== 'import'}><ImportPage ledger={ledger} write={write} notify={store.notifyFor('import')} /></div>
    </>
  )
}

function WorkspaceOperation({ store, places, transactions, write, refunds }: {
  store: WorkspaceStore; places: Place[]; transactions: Transaction[]; write: VaultAccess['write']; refunds: RefundIndex
}) {
  const [operation] = useAtom(store.operation)
  const selected = operation ? transactions.find((row) => row.id === operation.id) : undefined

  if (!operation || !selected) return null
  return <OperationDetails key={selected.id} row={selected} pane={operation.pane}
    transactions={transactions} places={places} write={write} refunds={refunds} onOpen={store.selectOperation} onClose={() => store.selectOperation()}
    onSave={(category) => store.setCategory(write, selected.id, category)}
    onSaveRefund={(expenseId) => store.setRefund(write, selected.id, expenseId)} />
}
