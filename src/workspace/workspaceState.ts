import { action, atom, withAsync, wrap } from '@reatom/core'
import { createToaster } from '@ui-sdk/react/toast'
import { categoryCatalog, CategoryError, kindForAmount } from '../categories/catalog'
import type { JournalFilter } from '../components/journal/model'
import { reconcileLedger, setOwnSbpPhone, type Category, type Ledger, type Transaction } from '../finance'
import type { Notify } from '../shared/ui/feedback'
import { movePlaceAliases, PlaceError } from '../places/model'
import { buildRefundIndex, RefundError, setRefundAllocation } from '../refunds'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'

export type Page = 'overview' | 'transactions' | 'credits' | 'import' | 'bills'
export type SettingsView = 'menu' | 'access' | 'categories' | 'places' | null
export type OperationPane = 'details' | 'refund' | 'category'
type ChangeCategory = Pick<Transaction, 'category' | 'categoryEdited'>

function updateRow(ledger: Ledger, rowId: string, category: ChangeCategory) {
  return reconcileLedger({
    ...ledger,
    transactions: ledger.transactions.map((row) => row.id === rowId ? { ...row, ...category } : row),
  })
}

export function reatomWorkspace(firstPage: Page) {
  const page = atom(firstPage, 'workspace.page')
  const journalFilter = atom<JournalFilter>({}, 'workspace.journalFilter')
  const month = atom<string | undefined>(undefined, 'workspace.month')
  const currency = atom<string | undefined>(undefined, 'workspace.currency')
  const operation = atom<{ id: string; pane: OperationPane } | null>(null, 'workspace.operation')
  const toaster = createToaster({ duration: 5000 })
  let mounted = false
  let visit = 0

  const navigate = action((nextPage: Page, filter: JournalFilter = {}) => {
    if (page() !== nextPage) {
      visit++
      toaster.dismiss()
    }
    page.set(nextPage)
    journalFilter.set(filter)
    operation.set(null)
  }, 'workspace.navigate')

  const selectOperation = action((row?: Transaction, pane: OperationPane = 'details') => {
    operation.set(row ? { id: row.id, pane } : null)
  }, 'workspace.selectOperation')

  const setMonth = action((value: string) => month.set(value), 'workspace.setMonth')
  const setCurrency = action((value: string) => currency.set(value), 'workspace.setCurrency')

  const resetAfterRestore = action(() => {
    visit++
    toaster.dismiss()
    journalFilter.set({})
    month.set(undefined)
    currency.set(undefined)
    operation.set(null)
  }, 'workspace.resetAfterRestore')

  function notifyFor(destination: Page): Notify {
    const origin = visit
    return (message, kind = 'success') => {
      if (mounted && visit === origin && page() === destination) toaster[kind](message)
    }
  }

  function notifyWithUndo(id: string, message: string, undo: () => Promise<boolean>) {
    if (!mounted) return
    const toastId = `${id}:${crypto.randomUUID()}`
    toaster.success(message, {
      id: toastId,
      duration: 6500,
      action: {
        label: 'Отменить',
        dismiss: false,
        onAction: async () => {
          try {
            const restored = await undo()
            toaster.update(toastId, {
              title: restored ? 'Изменение отменено' : 'Изменение уже заменено',
              type: restored ? 'success' : 'info',
              duration: 2200,
              action: undefined,
            })
          } catch (error) {
            toaster.update(toastId, { title: messageFor(error, 'Не удалось отменить'), type: 'error' })
            throw error
          }
        },
      },
    })
  }

  const setCategory = action(async (write: VaultWrite, rowId: string, category: Category) => {
    const origin = visit
    const before = await wrap(write((current) => {
      const row = current.transactions.find((entry) => entry.id === rowId)
      if (!row) throw new Error('Операция не найдена.')
      if (category !== 'transfer' && category !== row.category) {
        const definition = categoryCatalog(current.categoryOverrides).get(category)
        if (!definition || definition.archived || definition.kind !== kindForAmount(row.amountMinor)) {
          throw new CategoryError('Категория недоступна.')
        }
      }
      if (category === 'transfer' && current.refunds?.length) {
        const index = buildRefundIndex(current.transactions, current.refunds)
        if (index.byIncome.has(rowId) || index.byExpense.has(rowId)) throw new RefundError('Сначала отвяжи компенсацию от расхода.')
      }
      if (row.category === category && row.categoryEdited === true) return { ledger: current, result: null }
      return {
        ledger: updateRow(current, rowId, { category, categoryEdited: true }),
        result: { category: row.category, categoryEdited: row.categoryEdited ?? false },
      }
    }))
    if (!before || visit !== origin) return
    notifyWithUndo(`category-${rowId}`, category === 'transfer' ? 'Операция перенесена в свои переводы' : 'Категория обновлена', () => write((current) => {
      const row = current.transactions.find((entry) => entry.id === rowId)
      if (row?.category !== category || row.categoryEdited !== true) return { ledger: current, result: false }
      if (before.category === 'transfer' && current.refunds?.length) {
        const index = buildRefundIndex(current.transactions, current.refunds)
        if (index.byIncome.has(rowId) || index.byExpense.has(rowId)) return { ledger: current, result: false }
      }
      return { ledger: updateRow(current, rowId, before), result: true }
    }))
  }, 'workspace.setCategory').extend(withAsync())

  const setRefund = action(async (write: VaultWrite, incomeId: string, expenseId: string | null) => {
    const origin = visit
    const before = await wrap(write((current) => {
      const ledger = setRefundAllocation(current, incomeId, expenseId)
      if (ledger === current) return { ledger, result: undefined }
      return { ledger, result: current.refunds?.find((link) => link.incomeId === incomeId)?.expenseId ?? null }
    }))
    if (before === undefined || visit !== origin) return
    notifyWithUndo(`refund-${incomeId}`, expenseId ? 'Компенсация привязана' : 'Компенсация отвязана', () => write((current) => {
      const now = current.refunds?.find((link) => link.incomeId === incomeId)?.expenseId ?? null
      if (now !== expenseId) return { ledger: current, result: false }
      return { ledger: setRefundAllocation(current, incomeId, before), result: true }
    }))
  }, 'workspace.setRefund').extend(withAsync())

  const editPlaceBindings = action(async (write: VaultWrite, sourceId: string, aliases: string[], targetId: string | null) => {
    const origin = visit
    await wrap(write((current) => {
      const places = movePlaceAliases(current.places, sourceId, aliases, targetId)
      if (!places) throw new PlaceError('Привязки изменились. Выбери их заново.')
      return { ledger: { ...current, places }, result: undefined }
    }))
    if (visit !== origin) return
    const message = targetId === null ? 'Привязки сняты' : 'Привязки перенесены'
    notifyWithUndo(`place-bindings-${sourceId}`, message, () => write((current) => {
      const places = movePlaceAliases(current.places, targetId, aliases, sourceId)
      return places ? { ledger: { ...current, places }, result: true } : { ledger: current, result: false }
    }))
  }, 'workspace.editPlaceBindings').extend(withAsync())

  const setPhone = action(async (write: VaultWrite, phone: string | null) => {
    const origin = visit
    const change = await wrap(write(async (current) => {
      const ledger = await wrap(setOwnSbpPhone(current, phone))
      if (ledger === current) return { ledger, result: null }
      return {
        ledger,
        result: { before: current.sbp?.ownPhone, afterToken: ledger.sbp?.ownPhone?.token },
      }
    }))
    if (!change || visit !== origin) return
    notifyWithUndo('own-sbp-phone', phone === null ? 'Свой номер удалён' : 'Свой номер для СБП сохранён', () => write((current) => {
      if (!current.sbp || current.sbp.ownPhone?.token !== change.afterToken) return { ledger: current, result: false }
      return {
        ledger: reconcileLedger({ ...current, sbp: { ...current.sbp, ownPhone: change.before } }),
        result: true,
      }
    }))
  }, 'workspace.setPhone').extend(withAsync())

  return {
    page, journalFilter, month, currency, operation,
    navigate, selectOperation, setMonth, setCurrency, resetAfterRestore, toaster, notifyFor, notifyWithUndo, setCategory, setRefund, setPhone, editPlaceBindings,
    mount() {
      mounted = true
      return () => {
        mounted = false
        toaster.dismiss()
      }
    },
  }
}

export type WorkspaceStore = ReturnType<typeof reatomWorkspace>
