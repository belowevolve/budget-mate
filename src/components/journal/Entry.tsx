import { Button } from '@ui-sdk/react/button'
import { ArrowLeftRight, Check, ChevronRight, Link2 } from 'lucide-react'
import { banks, categories, money, needsTransferReview, type Transaction } from '../../finance'
import { operationTitle } from '../../operationPresentation'
import { isRefundIncome } from '../../refunds'
import { CategoryIcon } from '../CategoryIcon'
import { JournalSwipeActions, JournalSwipeContent, JournalSwipeRow } from '../JournalSwipe'
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
  onSelect?: (row: Transaction) => void
  onRefund?: (row: Transaction) => void
  onQuickTransfer?: (row: Transaction) => Promise<void>
  selection?: { selected: boolean; disabled?: boolean; amountMinor?: number }
}

export default function Entry({ row, counterpart, refundTarget, refundMinor, onSelect, onRefund, onQuickTransfer, selection }: EntryProps) {
  const transfer = row.category === 'transfer'
  const review = !refundTarget && needsTransferReview(row)
  const gain = row.amountMinor > 0 && !transfer && !review && !refundTarget
  let title = operationTitle(row)
  let details = `${categories[row.category].label} · ${banks[row.bank]}`
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
    details = `Компенсация ${money(refundMinor, row.currency, true)}`
  }

  const displayedAmount = selection?.amountMinor ?? (counterpart ? Math.abs(row.amountMinor) : row.amountMinor + (refundMinor ?? 0))
  const amount = `${gain || refundTarget ? '+' : ''}${money(displayedAmount, row.currency, true)}`
  const pending = row.status === 'pending'
  const secondaryText = pending ? `В обработке · ${details}` : details
  const OffsetIcon = refundTarget ? Link2 : ArrowLeftRight
  const body = (
    <>
      {refundTarget || review ? (
        <span className="operation-offset-icon"><OffsetIcon size={16} aria-hidden="true" /></span>
      ) : <CategoryIcon category={row.category} className="operation-category-icon" />}
      <span className="grid min-w-0">
        <strong className="block truncate text-sm leading-tight font-bold" title={title}>{title}</strong>
        <small className={counterpart ? 'operation-caption operation-caption-route' : 'operation-caption'} title={secondaryText}>
          {secondaryText}
        </small>
      </span>
      <strong className="operation-amount" data-income={gain ? '' : undefined}>{amount}</strong>
      {selection ? (
        <span className="operation-indicator">
          {selection.selected && <Check className="text-primary" size={16} aria-hidden="true" />}
        </span>
      ) : onSelect && <ChevronRight className="operation-indicator" size={14} aria-hidden="true" />}
    </>
  )

  if (!onSelect) return <div className="operation-entry">{body}</div>
  const openDetails = (
    <Button className="operation-entry" data-operation-trigger={row.id} aria-pressed={selection?.selected}
      disabled={selection?.disabled} onClick={() => onSelect(row)}>
      {body}
    </Button>
  )
  const openRefund = isRefundIncome(row) ? onRefund : undefined
  const markTransfer = review ? onQuickTransfer : undefined
  if (!openRefund && !markTransfer) return openDetails

  return (
    <JournalSwipeRow value={row.id} tabIndex={-1} className="operation-swipe-row"
      data-refund-only={openRefund && !markTransfer ? '' : undefined}>
      <JournalSwipeActions value={row.id} className="operation-swipe-actions" data-two-actions={openRefund && markTransfer ? '' : undefined}>
        {openRefund && (
          <Button className="operation-swipe-button operation-swipe-refund" onClick={() => openRefund(row)}>
            <Link2 size={16} aria-hidden="true" />
            {refundTarget ? 'Изменить связь' : 'К расходу'}
          </Button>
        )}
        {markTransfer && (
          <Button className="operation-swipe-button operation-swipe-transfer" onClick={() => markTransfer(row)}>
            <ArrowLeftRight size={16} aria-hidden="true" />
            Свой перевод
          </Button>
        )}
      </JournalSwipeActions>
      <JournalSwipeContent value={row.id} className="operation-swipe-content">
        {openDetails}
      </JournalSwipeContent>
    </JournalSwipeRow>
  )
}
