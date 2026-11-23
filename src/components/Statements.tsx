import { useState } from 'react'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible'
import { FileInput, FileInputDropzone, FileInputTrigger } from '@ui-sdk/react/file-input'
import { Check, ChevronDown, FileText, FileUp } from 'lucide-react'
import { banks, type ImportEntry } from '../finance'
import { formatDate } from '../shared/format'
import { cn } from '../shared/cn'
import { Button, buttonVariants } from '../shared/ui/Button'
import { Panel } from '../shared/ui/Panel'
import type { ImportPreview } from '../workspace/importModel'

const fileList = 'mt-1 list-none divide-y divide-line'
const fileRow = 'grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 py-2 text-sm'
const fileDetail = 'text-xs leading-snug text-muted wrap-anywhere'
const uploadError = 'text-sm text-danger wrap-anywhere'

export function Statements({ busy, previews, history, onFiles, onConfirm, onClear }: {
  busy: boolean
  previews: ImportPreview[]
  history: ImportEntry[]
  onFiles: (files: File[]) => void
  onConfirm: () => void
  onClear: () => void
}) {
  const [rejection, setRejection] = useState('')
  const readyCount = previews.filter((item) => item.statement).length

  return (
    <div className="grid min-w-0 gap-3">
      <Panel aria-label="Импорт выписок">
        <FileInput
          className="w-full max-w-none"
          accept={['application/pdf', '.pdf']}
          multiple
          disabled={busy}
          maxFiles={20}
          maxSize={25 * 1024 * 1024}
          value={[]}
          onValueChange={(files) => {
            if (!files.length) return
            setRejection('')
            onFiles(files)
          }}
          onReject={() => setRejection('До 20 PDF, до 25 МБ на файл.')}
        >
          <FileInputDropzone className="grid min-w-0 justify-items-center gap-2 rounded-2xl border-0 px-3 py-4 text-center text-ink data-drag-accept:bg-income-soft sm:py-6">
            <span className="dialog-icon"><FileUp size={18} aria-hidden="true" /></span>
            <h2 className="section-heading">Банковские выписки</h2>
            <p className={fileDetail}>Альфа-Банк, ВТБ, Ozon Банк</p>
            <FileInputTrigger className={cn(buttonVariants(), 'mt-1')}>{busy ? 'Обработка…' : 'Выбрать PDF'}</FileInputTrigger>
          </FileInputDropzone>
        </FileInput>
        {rejection && <p className={`${uploadError} px-3 pb-3`} role="alert">{rejection}</p>}
      </Panel>

      {previews.length > 0 && (
        <Panel padded>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <h2 className="section-heading">Предпросмотр</h2>
            <p className={fileDetail} aria-live="polite">{busy ? 'Обработка…' : `${readyCount} из ${previews.length}`}</p>
          </div>
          <ul className={fileList}>
            {previews.map((item) => (
              <li key={item.id} className={fileRow}>
                <span className="dialog-icon"><FileText size={16} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <strong className="block truncate" title={item.name}>{item.name}</strong>
                  <p className={item.error ? uploadError : fileDetail}>
                    {item.error ?? (item.statement
                      ? `${banks[item.statement.bank]} · ${item.statement.transactions.length} оп.`
                      : 'В очереди')}
                  </p>
                  {item.statement?.warnings.map((warning) => <p key={warning} className={`${fileDetail} mt-1`}>{warning}</p>)}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={onClear}>Очистить</Button>
            <Button disabled={busy || !readyCount} onClick={onConfirm}>Сохранить операции</Button>
          </div>
        </Panel>
      )}

      {history.length > 0 && (
        <Collapsible render={<Panel as="div" />}>
          <CollapsibleTrigger className="group flex min-h-12 w-full min-w-0 items-center justify-between gap-2 rounded-[inherit] border-0 bg-transparent px-3 text-left text-sm font-bold text-ink shadow-none after:content-none hover:bg-subtle sm:px-4">
            <span>История импорта</span>
            <ChevronDown size={16} className="shrink-0 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsiblePanel className="min-w-0 px-3 pb-2 sm:px-4">
            <ul className={fileList}>
              {history.map((entry) => (
                <li key={entry.id} className={fileRow}>
                  <span className="dialog-icon"><Check size={16} aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
                      <strong className="truncate" title={entry.accountLabel}>{entry.accountLabel}</strong>
                      <small className="font-bold tabular-nums text-primary">+{entry.added}</small>
                    </div>
                    <p className={fileDetail}>{entry.periodStart && entry.periodEnd
                      ? `${formatDate(entry.periodStart)} – ${formatDate(entry.periodEnd)}`
                      : formatDate(entry.importedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CollapsiblePanel>
        </Collapsible>
      )}
    </div>
  )
}
