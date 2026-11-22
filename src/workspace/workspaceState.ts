import { action, atom, withAsync, wrap } from '@reatom/core'
import { createToaster } from '@ui-sdk/react/toast'
import type { JournalFilter } from '../components/journal/model'
import { reconcileLedger, setOwnSbpPhone, type Category, type Ledger, type Transaction } from '../finance'
import { buildRefundIndex, RefundError, setRefundAllocation } from '../refunds'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'

export type Page = 'overview' | 'transactions' | 'credits' | 'import' | 'bills'
export type SettingsDialog = 'phone' | 'access' | null
export type NotificationKind = 'success' | 'info' | 'error'
export type OperationPane = 'details' | 'refund'
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
  const settingsDialog = atom<SettingsDialog>(null, 'workspace.settingsDialog')
  const toaster = createToaster({ duration: 5000 })
  let undoToastId: string | undefined
  let mounted = false

  const navigate = action((nextPage: Page, filter: JournalFilter = {}) => {
    page.set(nextPage)
    journalFilter.set(filter)
    operation.set(null)
    settingsDialog.set(null)
  }, 'workspace.navigate')

  const selectOperation = action((row?: Transaction, pane: OperationPane = 'details') => {
    operation.set(row ? { id: row.id, pane } : null)
  }, 'workspace.selectOperation')

  const setMonth = action((value: string) => month.set(value), 'workspace.setMonth')
  const setCurrency = action((value: string) => currency.set(value), 'workspace.setCurrency')
  const setSettingsDialog = action((value: SettingsDialog) => settingsDialog.set(value), 'workspace.setSettingsDialog')

  function notify(message: string, kind: NotificationKind = 'success') {
    if (mounted) toaster[kind](message)
  }

  function notifyWithUndo(id: string, message: string, undo: () => Promise<boolean>) {
    if (!mounted) return
    if (undoToastId) toaster.dismiss(undoToastId)
    const toastId = `${id}:${crypto.randomUUID()}`
    undoToastId = toastId
    toaster.success(message, {
      id: toastId,
      duration: 6500,
      onDismiss: () => { if (undoToastId === toastId) undoToastId = undefined },
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
    const before = await wrap(write((current) => {
      const row = current.transactions.find((entry) => entry.id === rowId)
      if (!row) throw new Error('Операция не найдена.')
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
    if (!before) return
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
    const before = await wrap(write((current) => {
      const ledger = setRefundAllocation(current, incomeId, expenseId)
      if (ledger === current) return { ledger, result: undefined }
      return { ledger, result: current.refunds?.find((link) => link.incomeId === incomeId)?.expenseId ?? null }
    }))
    if (before === undefined) return
    notifyWithUndo(`refund-${incomeId}`, expenseId ? 'Компенсация привязана' : 'Компенсация отвязана', () => write((current) => {
      const now = current.refunds?.find((link) => link.incomeId === incomeId)?.expenseId ?? null
      if (now !== expenseId) return { ledger: current, result: false }
      return { ledger: setRefundAllocation(current, incomeId, before), result: true }
    }))
  }, 'workspace.setRefund').extend(withAsync())

  const setPhone = action(async (write: VaultWrite, phone: string | null) => {
    const change = await wrap(write(async (current) => {
      const ledger = await wrap(setOwnSbpPhone(current, phone))
      if (ledger === current) return { ledger, result: null }
      return {
        ledger,
        result: { before: current.sbp?.ownPhone, afterToken: ledger.sbp?.ownPhone?.token },
      }
    }))
    if (!change) return
    notifyWithUndo('own-sbp-phone', phone === null ? 'Свой номер удалён' : 'Свой номер для СБП сохранён', () => write((current) => {
      if (!current.sbp || current.sbp.ownPhone?.token !== change.afterToken) return { ledger: current, result: false }
      return {
        ledger: reconcileLedger({ ...current, sbp: { ...current.sbp, ownPhone: change.before } }),
        result: true,
      }
    }))
  }, 'workspace.setPhone').extend(withAsync())

  return {
    page, journalFilter, month, currency, operation, settingsDialog,
    navigate, selectOperation, setMonth, setCurrency, setSettingsDialog, toaster, notify, setCategory, setRefund, setPhone,
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
