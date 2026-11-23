import { Button } from '@ui-sdk/react/button'
import { cn } from 'cn'
import { ArrowLeftRight, Check, ChevronRight, Link2, Tag } from 'lucide-react'
import { useCategoryCatalog } from '../../categories/categoryContext'
import { categoryDefinition } from '../../categories/catalog'
import { money, needsTransferReview, type Transaction } from '../../finance'
import { operationTitle } from '../../operationPresentation'
import { isRefundIncome } from '../../refunds'
import { formatDate } from '../../shared/format'
import { RowAction } from '../../shared/ui/RowAction'
import { BankIcon } from '../BankIcon'
import { CategoryIcon } from '../CategoryIcon'
import { JournalSwipeAction, JournalSwipeActions, JournalSwipeContent, JournalSwipeRow } from '../JournalSwipe'
import { PendingStatus } from '../../shared/ui/PendingStatus'
import type { JournalEntry } from './model'

function endpoint(row: Transaction) {
  const digits = /[•*]\s*(\d{4})$/.exec(row.accountLabel)?.[1]
  return digits ? `••${digits}` : row.accountLabel.split(' · ')[1]
}

function TransferRoute({ row, counterpart }: { row: Transaction; counterpart: Transaction }) {
  const source = endpoint(row)
  const target = endpoint(counterpart)
  const sameBank = row.bank === counterpart.bank

  return (
    <>
      <span className="inline-flex min-w-0 items-center gap-1">
        <BankIcon bank={row.bank} />
        {source && <span className="truncate">{source}</span>}
      </span>
      {(!sameBank || target) && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className="shrink-0">→</span>
          {!sameBank && <BankIcon bank={counterpart.bank} />}
          {target && <span className="truncate">{target}</span>}
        </span>
      )}
    </>
  )
}

type EntryProps = JournalEntry & {
  showDate?: boolean
  caption?: string
  exactAmount?: boolean
  flush?: boolean
  onSelect?: (row: Transaction) => void
  onRefund?: (row: Transaction) => void
  onChangeCategory?: (row: Transaction) => void
  onQuickTransfer?: (row: Transaction) => Promise<void>
  selection?: { selected: boolean; disabled?: boolean; amountMinor?: number; linked?: boolean }
}

export default function Entry({ row, counterpart, refundTarget, refundMinor, showDate, caption, exactAmount, flush,
  onSelect, onRefund, onChangeCategory, onQuickTransfer, selection }: EntryProps) {
  const catalog = useCategoryCatalog()
  const transfer = row.category === 'transfer'
  const review = !refundTarget && needsTransferReview(row)
  const transferAmount = transfer || review || Boolean(refundTarget)
  const gain = row.amountMinor > 0 && !transferAmount
  let title = operationTitle(row)
  let details = categoryDefinition(catalog, row.category, row.amountMinor > 0 ? 'income' : 'expense').label
  if (counterpart) {
    title = /погашение кредита/i.test(counterpart.description) ? 'Погашение кредита' : 'Между счетами'
  } else if (review) {
    title = row.amountMinor > 0 ? 'Поступление по СБП' : 'Перевод по СБП'
    details = ''
  } else if (refundTarget) {
    title = 'Компенсация расхода'
    details = operationTitle(refundTarget)
  } else if (refundMinor) {
    details = `Компенсация ${money(refundMinor, row.currency, exactAmount)}`
  }

  const displayedAmount = selection?.amountMinor ?? (counterpart ? Math.abs(row.amountMinor) : row.amountMinor + (refundMinor ?? 0))
  const amount = `${gain || refundTarget ? '+' : ''}${money(displayedAmount, row.currency, exactAmount)}`
  const route = counterpart && caption === undefined ? counterpart : undefined
  const date = showDate ? formatDate(row.date) : ''
  const description = [caption ?? details, date].filter(Boolean).join(' ')
  const OffsetIcon = refundTarget ? Link2 : ArrowLeftRight
  const categoryIcon = refundTarget || review
    ? <span className="grid size-7 place-items-center rounded-lg bg-transfer-soft text-transfer sm:size-8"><OffsetIcon size={16} aria-hidden="true" /></span>
    : <CategoryIcon category={row.category} className="size-7 rounded-lg sm:size-8" />
  const changeCategory = !counterpart && !refundTarget && !selection ? onChangeCategory : undefined
  const body = (
    <>
      <span className="grid min-w-0">
        <strong className="block truncate text-sm leading-tight font-bold">{title}</strong>
        <small className={cn('flex min-w-0 items-center gap-1 text-xs leading-tight font-medium text-muted', route && 'flex-wrap')}>
          {route ? (
            <>
              <TransferRoute row={row} counterpart={route} />
              {date && <span className="truncate">{date}</span>}
            </>
          ) : (
            <>
              <BankIcon bank={row.bank} />
              {description && <span className="truncate">{description}</span>}
            </>
          )}
        </small>
      </span>
      <strong className={cn(
        'flex max-w-[min(11rem,39vw)] min-w-0 items-center justify-end gap-1 text-right text-xs font-extrabold wrap-anywhere tabular-nums sm:text-sm',
        gain && 'text-income',
        transferAmount && 'text-muted',
      )}>
        {row.status === 'pending' && <PendingStatus />}<span>{amount}</span>
      </strong>
      {selection ? (
        <span className="grid size-4 place-items-center text-muted">
          {selection.selected && <Check className="text-primary" size={16} aria-hidden="true" />}
          {selection.linked && <span className="sr-only">Отвязать компенсацию</span>}
        </span>
      ) : onSelect && <ChevronRight className="size-4 text-muted" size={14} aria-hidden="true" />}
    </>
  )

  const layout = cn(
    'grid h-auto min-h-12 w-full min-w-0 items-center gap-2 px-2 text-start',
    flush ? 'rounded-none py-0' : 'rounded-lg py-1',
    changeCategory ? 'ps-11 sm:ps-12' : '',
    changeCategory
      ? onSelect ? 'grid-cols-[minmax(0,1fr)_minmax(0,auto)_1rem]' : 'grid-cols-[minmax(0,1fr)_minmax(0,auto)]'
      : onSelect ? 'grid-cols-[auto_minmax(0,1fr)_minmax(0,auto)_1rem]' : 'grid-cols-[auto_minmax(0,1fr)_minmax(0,auto)]',
  )
  const entry = changeCategory ? (
    <div className="relative min-w-0">
      <Button
        className="peer/category absolute inset-s-2 top-1/2 z-1 grid size-7 min-h-0 -translate-y-1/2 place-items-center rounded-lg border-0 bg-transparent p-0 shadow-none hover:[&>span]:bg-selected focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:size-8"
        aria-label={`Изменить категорию: ${title}`}
        data-operation-category-trigger={row.id} onClick={() => changeCategory(row)}>{categoryIcon}</Button>
      {onSelect
        ? <RowAction className={cn(layout, 'peer-hover/category:bg-subtle')} data-operation-trigger={row.id} onClick={() => onSelect(row)}>{body}</RowAction>
        : <div className={layout}>{body}</div>}
    </div>
  ) : onSelect ? (
    <RowAction className={layout} data-operation-trigger={row.id} aria-pressed={selection?.selected}
      disabled={selection?.disabled} onClick={() => onSelect(row)}>
      {categoryIcon}
      {body}
    </RowAction>
  ) : <div className={layout}>{categoryIcon}{body}</div>
  if (!onSelect) return entry
  const openRefund = isRefundIncome(row) ? onRefund : undefined
  const markTransfer = review ? onQuickTransfer : undefined
  const openCategories = !transfer ? changeCategory : undefined
  if (!openRefund && !markTransfer && !openCategories) return entry

  return (
    <JournalSwipeRow value={row.id} tabIndex={-1} flush={flush}
      data-refund-full={openRefund && !review ? '' : undefined}
      data-category-full={openCategories && !openRefund && !review ? '' : undefined}>
      <JournalSwipeActions value={row.id}>
        {openRefund && (
          <JournalSwipeAction value={row.id} tone="refund" onAction={() => openRefund(row)}>
            <Link2 aria-hidden="true" />
            К расходу
          </JournalSwipeAction>
        )}
        {markTransfer && (
          <JournalSwipeAction value={row.id} tone="transfer" onAction={() => { void markTransfer(row) }}>
            <ArrowLeftRight aria-hidden="true" />
            Свой перевод
          </JournalSwipeAction>
        )}
        {openCategories && (
          <JournalSwipeAction value={row.id} tone="category" onAction={() => openCategories(row)}>
            <Tag aria-hidden="true" />
            Категория
          </JournalSwipeAction>
        )}
      </JournalSwipeActions>
      <JournalSwipeContent value={row.id}>
        {entry}
      </JournalSwipeContent>
    </JournalSwipeRow>
  )
}
