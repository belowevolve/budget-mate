import { Button } from '@ui-sdk/react/button'
import { ArrowLeftRight, Check, ChevronRight, Link2, Tag } from 'lucide-react'
import { useCategoryCatalog } from '../../categories/categoryContext'
import { categoryDefinition } from '../../categories/catalog'
import { banks, formatDate, money, needsTransferReview, type Transaction } from '../../finance'
import { operationTitle } from '../../operationPresentation'
import { isRefundIncome } from '../../refunds'
import { RowAction } from '../../shared/ui/RowAction'
import { CategoryIcon } from '../CategoryIcon'
import { JournalSwipeAction, JournalSwipeActions, JournalSwipeContent, JournalSwipeRow } from '../JournalSwipe'
import { PendingStatus } from '../../shared/ui/PendingStatus'
import type { JournalEntry } from './model'
import './operationList.css'

function endpoint(row: Transaction) {
  const digits = /[•*]\s*(\d{4})$/.exec(row.accountLabel)?.[1]
  return digits ? `••${digits}` : row.accountLabel.split(' · ')[1]
}

function transferRoute(row: Transaction, counterpart: Transaction) {
  const source = endpoint(row)
  const target = endpoint(counterpart)
  const sourceBank = banks[row.bank]
  const targetBank = banks[counterpart.bank]
  if (row.bank === counterpart.bank) {
    return source && target ? `${sourceBank} · ${source} → ${target}` : sourceBank
  }
  return `${[sourceBank, source].filter(Boolean).join(' ')} → ${[targetBank, target].filter(Boolean).join(' ')}`
}

type EntryProps = JournalEntry & {
  showDate?: boolean
  caption?: string
  exactAmount?: boolean
  onSelect?: (row: Transaction) => void
  onRefund?: (row: Transaction) => void
  onChangeCategory?: (row: Transaction) => void
  onQuickTransfer?: (row: Transaction) => Promise<void>
  selection?: { selected: boolean; disabled?: boolean; amountMinor?: number; linked?: boolean }
}

export default function Entry({ row, counterpart, refundTarget, refundMinor, showDate, caption, exactAmount,
  onSelect, onRefund, onChangeCategory, onQuickTransfer, selection }: EntryProps) {
  const catalog = useCategoryCatalog()
  const transfer = row.category === 'transfer'
  const review = !refundTarget && needsTransferReview(row)
  const transferAmount = transfer || review || Boolean(refundTarget)
  const gain = row.amountMinor > 0 && !transferAmount
  let title = operationTitle(row)
  let details = `${categoryDefinition(catalog, row.category, row.amountMinor > 0 ? 'income' : 'expense').label} · ${banks[row.bank]}`
  if (counterpart) {
    title = /погашение кредита/i.test(counterpart.description) ? 'Погашение кредита' : 'Между счетами'
    details = transferRoute(row, counterpart)
  } else if (review) {
    title = row.amountMinor > 0 ? 'Поступление по СБП' : 'Перевод по СБП'
    details = banks[row.bank]
  } else if (refundTarget) {
    title = 'Компенсация расхода'
    details = operationTitle(refundTarget)
  } else if (refundMinor) {
    details = `Компенсация ${money(refundMinor, row.currency, exactAmount)}`
  }

  const displayedAmount = selection?.amountMinor ?? (counterpart ? Math.abs(row.amountMinor) : row.amountMinor + (refundMinor ?? 0))
  const amount = `${gain || refundTarget ? '+' : ''}${money(displayedAmount, row.currency, exactAmount)}`
  const description = caption ?? details
  const secondaryText = showDate ? `${description} · ${formatDate(row.date)}` : description
  const OffsetIcon = refundTarget ? Link2 : ArrowLeftRight
  const categoryIcon = refundTarget || review
    ? <span className="operation-offset-icon"><OffsetIcon size={16} aria-hidden="true" /></span>
    : <CategoryIcon category={row.category} className="operation-category-icon" />
  const changeCategory = !counterpart && !refundTarget && !selection ? onChangeCategory : undefined
  const body = (
    <>
      <span className="grid min-w-0">
        <strong className="block truncate text-sm leading-tight font-bold">{title}</strong>
        <small className={counterpart ? 'operation-caption operation-caption-route' : 'operation-caption'}>
          {secondaryText}
        </small>
      </span>
      <strong className="operation-amount" data-income={gain ? '' : undefined} data-transfer={transferAmount ? '' : undefined}>
        {row.status === 'pending' && <PendingStatus />}<span>{amount}</span>
      </strong>
      {selection ? (
        <span className="operation-indicator">
          {selection.selected && <Check className="text-primary" size={16} aria-hidden="true" />}
          {selection.linked && <span className="sr-only">Отвязать компенсацию</span>}
        </span>
      ) : onSelect && <ChevronRight className="operation-indicator" size={14} aria-hidden="true" />}
    </>
  )

  const entry = changeCategory ? (
    <div className="operation-entry-split">
      <Button className="operation-category-trigger" aria-label={`Изменить категорию: ${title}`}
        data-operation-category-trigger={row.id} onClick={() => changeCategory(row)}>{categoryIcon}</Button>
      {onSelect
        ? <RowAction className="operation-entry operation-entry-details" data-operation-trigger={row.id} onClick={() => onSelect(row)}>{body}</RowAction>
        : <div className="operation-entry operation-entry-details">{body}</div>}
    </div>
  ) : onSelect ? (
    <RowAction className="operation-entry" data-operation-trigger={row.id} aria-pressed={selection?.selected}
      disabled={selection?.disabled} onClick={() => onSelect(row)}>
      {categoryIcon}
      {body}
    </RowAction>
  ) : <div className="operation-entry">{categoryIcon}{body}</div>
  if (!onSelect) return entry
  const openRefund = isRefundIncome(row) ? onRefund : undefined
  const markTransfer = review ? onQuickTransfer : undefined
  const openCategories = !transfer ? changeCategory : undefined
  if (!openRefund && !markTransfer && !openCategories) return entry

  return (
    <JournalSwipeRow value={row.id} tabIndex={-1} className="operation-swipe-row"
      data-refund-full={openRefund && !review ? '' : undefined}
      data-category-full={openCategories && !openRefund && !review ? '' : undefined}>
      <JournalSwipeActions value={row.id} className="operation-swipe-actions">
        {openRefund && (
          <JournalSwipeAction value={row.id} className="operation-swipe-button operation-swipe-refund" onAction={() => openRefund(row)}>
            <Link2 size={16} aria-hidden="true" />
            К расходу
          </JournalSwipeAction>
        )}
        {markTransfer && (
          <JournalSwipeAction value={row.id} className="operation-swipe-button operation-swipe-transfer" onAction={() => { void markTransfer(row) }}>
            <ArrowLeftRight size={16} aria-hidden="true" />
            Свой перевод
          </JournalSwipeAction>
        )}
        {openCategories && (
          <JournalSwipeAction value={row.id} className="operation-swipe-button operation-swipe-category" onAction={() => openCategories(row)}>
            <Tag size={16} aria-hidden="true" />
            Категория
          </JournalSwipeAction>
        )}
      </JournalSwipeActions>
      <JournalSwipeContent value={row.id} className="operation-swipe-content">
        {entry}
      </JournalSwipeContent>
    </JournalSwipeRow>
  )
}
