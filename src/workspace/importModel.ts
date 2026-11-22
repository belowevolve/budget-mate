import { abortVar, action, atom, computed, isAbort, withAbort, withAsync, withDisconnectHook, wrap } from '@reatom/core'
import { confirmCreditRemindersFromStatement } from '../credits/creditAccounts'
import { ensureSbpKey, mergeStatements } from '../finance'
import type { ParsedStatement } from '../statements'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import type { NotificationKind } from './workspaceState'

export type ImportPreview = {
  id: string
  name: string
  statement?: ParsedStatement
  error?: string
}

type Notify = (message: string, type?: NotificationKind) => void

export function reatomImport() {
  const previews = atom<ImportPreview[]>([], 'statementImport.previews')

  const readFiles = action(async (files: File[], key: string | undefined, write: VaultWrite, notify: Notify) => {
    const { signal } = abortVar.require()
    const pending = files.map((file) => ({ id: crypto.randomUUID(), name: file.name }))
    previews.set(pending)
    try {
      const sbpKey = key ?? await wrap(write((current) => {
        const updated = ensureSbpKey(current)
        return { ledger: updated, result: updated.sbp?.key }
      }))
      const { parseStatement, StatementError } = await wrap(import('../statements'))
      for (const [index, file] of files.entries()) {
        let result: ImportPreview
        try {
          result = { ...pending[index], statement: await wrap(parseStatement(file, sbpKey, signal)) }
        } catch (error) {
          if (signal.aborted || isAbort(error)) return
          result = { ...pending[index], error: error instanceof StatementError ? error.message : 'Не удалось распознать этот PDF.' }
        }
        previews.set((items) => items.map((item) => item.id === result.id ? result : item))
      }
    } catch (error) {
      if (signal.aborted || isAbort(error)) return
      previews.set([])
      notify(messageFor(error, 'Не удалось открыть модуль PDF.'), 'error')
    }
  }, 'statementImport.read').extend(withAsync(), withAbort('first-in-win'))

  const save = action(async (write: VaultWrite, notify: Notify) => {
    const statements = previews().flatMap(({ statement }): ParsedStatement[] => statement ? [statement] : [])
    if (!statements.length) return
    try {
      const result = await wrap(write((current) => {
        const merge = mergeStatements(current, statements)
        const confirmed = confirmCreditRemindersFromStatement(merge.ledger, statements)
        return {
          ledger: merge.added || merge.updatedCredits || merge.updatedTransactions || merge.removedTransactions
            || merge.updatedPendingCoverage || confirmed !== merge.ledger ? confirmed : current,
          result: merge,
        }
      }))
      previews.set([])
      const changes = [
        result.added > 0 && `Операций: +${result.added}`,
        result.updatedTransactions > 0 && `Уточнено: ${result.updatedTransactions}`,
        result.removedTransactions > 0 && `Снято резервов: ${result.removedTransactions}`,
        result.updatedCredits > 0 && `Кредиток: ${result.updatedCredits}`,
      ].filter(Boolean).join(' · ')
      notify(changes || 'Выписки уже учтены', changes ? 'success' : 'info')
    } catch (error) {
      if (!isAbort(error)) notify(messageFor(error, 'Не удалось сохранить операции.'), 'error')
    }
  }, 'statementImport.save').extend(withAsync(), withAbort('first-in-win'))

  const busy = computed(() => readFiles.pending() > 0 || save.pending() > 0, 'statementImport.busy')

  return {
    busy,
    previews: previews.extend(withDisconnectHook(() => {
      readFiles.abort()
      save.abort()
      previews.set([])
    })),
    read(files: File[], key: string | undefined, write: VaultWrite, notify: Notify) {
      if (files.length && !busy()) void readFiles(files, key, write, notify).catch((error) => {
        if (!isAbort(error)) notify(messageFor(error, 'Не удалось начать импорт.'), 'error')
      })
    },
    confirm(write: VaultWrite, notify: Notify) {
      if (!busy()) void save(write, notify).catch((error) => {
        if (!isAbort(error)) notify(messageFor(error, 'Не удалось сохранить операции.'), 'error')
      })
    },
    clear: action(() => { if (!busy()) previews.set([]) }, 'statementImport.clear'),
  }
}
